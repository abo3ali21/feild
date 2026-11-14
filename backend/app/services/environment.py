from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx

from app.core.calculations import (
    calculate_crop_heat_stress,
    calculate_effective_water,
    calculate_gdd,
    convert_soc_to_som,
    precipitation_anomaly,
    rainfall_status,
)
from app.models.schemas import Crop, DataStatus, EnvironmentalContext, FarmRequest, Provenance

logger = logging.getLogger(__name__)
DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@dataclass
class AdapterResult:
    payload: dict[str, Any]
    status: DataStatus
    source_name: str = ""
    retrieval_timestamp: str = ""
    observation_period: str = ""


class TTLCache:
    def __init__(self, ttl_seconds: int = 86400):
        self.ttl_seconds = ttl_seconds
        self._items: dict[str, tuple[float, dict]] = {}

    def get(self, key: str) -> dict | None:
        item = self._items.get(key)
        if item and time.time() - item[0] < self.ttl_seconds:
            return item[1]
        return None

    def set(self, key: str, value: dict) -> None:
        self._items[key] = (time.time(), value)

    def clear(self) -> None:
        self._items.clear()


# Application-level shared cache and retrying HTTP client
SHARED_CACHE = TTLCache(ttl_seconds=86400)
SHARED_CLIENT: RetryingClient | None = None


class RetryingClient:
    def __init__(self, timeout: float = 8.0, attempts: int = 3):
        self.timeout = timeout
        self.attempts = attempts

    async def get_json(self, url: str, params: list[tuple[str, str]] | dict[str, str]) -> dict:
        last_error: Exception | None = None
        async with httpx.AsyncClient(timeout=self.timeout, follow_redirects=True) as client:
            for attempt in range(self.attempts):
                try:
                    response = await client.get(url, params=params)
                    response.raise_for_status()
                    payload = response.json()
                    if not isinstance(payload, dict):
                        raise ValueError("External response was not a JSON object")
                    return payload
                except (httpx.HTTPError, ValueError) as exc:
                    last_error = exc
                    if attempt < self.attempts - 1:
                        await asyncio.sleep(0.2 * (2**attempt))
        raise RuntimeError("Environmental data service unavailable") from last_error


def get_shared_client() -> RetryingClient:
    global SHARED_CLIENT
    if SHARED_CLIENT is None:
        SHARED_CLIENT = RetryingClient()
    return SHARED_CLIENT


def demo_profiles() -> list[dict]:
    return json.loads((DATA_DIR / "demo_profiles.json").read_text())


def _load_all_crops() -> list[Crop]:
    return [Crop.model_validate(item) for item in json.loads((DATA_DIR / "crops.json").read_text())]


class NasaPowerAdapter:
    url = "https://power.larc.nasa.gov/api/temporal/daily/point"

    def __init__(self, client: RetryingClient, cache: TTLCache = SHARED_CACHE):
        self.client, self.cache = client, cache

    async def fetch(self, latitude: float, longitude: float) -> AdapterResult:
        key = f"nasa:{latitude:.3f}:{longitude:.3f}:v2"
        now_iso = datetime.now(timezone.utc).isoformat()
        if cached := self.cache.get(key):
            return AdapterResult(
                payload=cached,
                status=DataStatus.CACHED,
                source_name="NASA POWER (Daily Agroclimatology)",
                retrieval_timestamp=now_iso,
                observation_period="Recent 4 years multi-year climatology",
            )

        end = date.today() - timedelta(days=30)
        start = end - timedelta(days=365 * 4)
        period_str = f"{start.strftime('%Y-%m-%d')} to {end.strftime('%Y-%m-%d')}"

        payload = await self.client.get_json(self.url, {
            "parameters": "T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN",
            "community": "AG",
            "longitude": str(longitude),
            "latitude": str(latitude),
            "start": start.strftime("%Y%m%d"),
            "end": end.strftime("%Y%m%d"),
            "format": "JSON",
        })

        parameter = payload.get("properties", {}).get("parameter", {})
        if not all(name in parameter for name in ("T2M_MAX", "T2M_MIN", "PRECTOTCORR")):
            raise ValueError("NASA POWER response omitted required variables")

        years: dict[str, dict[str, list[float]]] = {}
        for variable in ("T2M_MAX", "T2M_MIN", "PRECTOTCORR"):
            for day, value in parameter[variable].items():
                if value <= -900:  # NASA POWER missing value flag is -999.0
                    continue
                years.setdefault(day[:4], {}).setdefault(variable, []).append(float(value))

        complete = [values for values in years.values() if all(v in values for v in ("T2M_MAX", "T2M_MIN", "PRECTOTCORR"))]
        if len(complete) < 2:
            raise ValueError("NASA POWER response lacks enough complete years")

        recent, history = complete[-1], complete[:-1]
        season_slice = slice(-180, None)
        recent_rain = sum(recent["PRECTOTCORR"][season_slice])
        historical_rain = sum(sum(year["PRECTOTCORR"][season_slice]) for year in history) / len(history)
        tmax = recent["T2M_MAX"][season_slice]
        tmin = recent["T2M_MIN"][season_slice]

        # Calculate base-10 general GDD and crop-specific GDD and heat-stress days
        crops = _load_all_crops()
        crop_gdd = {c.crop_id: calculate_gdd(tmax, tmin, c.base_temp_c, c.max_temp_c) for c in crops}
        crop_heat = {c.crop_id: calculate_crop_heat_stress(tmax, c.max_temp_c) for c in crops}

        result = {
            "annual_gdd": calculate_gdd(tmax, tmin, 10.0, 35.0),
            "crop_gdd": crop_gdd,
            "seasonal_rainfall_mm": round(recent_rain, 1),
            "historical_rainfall_mm": round(historical_rain, 1),
            "heat_stress_days": sum(1 for temp in tmax if temp > 35.0),
            "crop_heat_stress_days": crop_heat,
        }
        self.cache.set(key, result)
        return AdapterResult(
            payload=result,
            status=DataStatus.LIVE,
            source_name="NASA POWER (Daily Agroclimatology)",
            retrieval_timestamp=now_iso,
            observation_period=period_str,
        )


class SoilProvider(ABC):
    @abstractmethod
    async def fetch(self, latitude: float, longitude: float) -> AdapterResult:
        pass


class SoilGridsProvider(SoilProvider):
    url = "https://rest.isric.org/soilgrids/v2.0/properties/query"

    def __init__(self, client: RetryingClient, cache: TTLCache = SHARED_CACHE):
        self.client, self.cache = client, cache

    async def fetch(self, latitude: float, longitude: float) -> AdapterResult:
        key = f"soil:{latitude:.3f}:{longitude:.3f}:v2"
        now_iso = datetime.now(timezone.utc).isoformat()
        if cached := self.cache.get(key):
            return AdapterResult(
                payload=cached,
                status=DataStatus.CACHED,
                source_name="ISRIC SoilGrids 2.0 (0-30cm)",
                retrieval_timestamp=now_iso,
                observation_period="ISRIC Global Soil Profile Database v2020",
            )

        params = [("lon", str(longitude)), ("lat", str(latitude)), ("depth", "0-30cm"), ("value", "mean")]
        params += [("property", item) for item in ("clay", "sand", "silt", "phh2o", "soc")]
        payload = await self.client.get_json(self.url, params)

        layers = payload.get("properties", {}).get("layers", [])
        means: dict[str, float] = {}
        for layer in layers:
            depth = next((d for d in layer.get("depths", []) if d.get("label") == "0-30cm"), None)
            if depth:
                val = depth.get("values", {}).get("mean")
                if val is not None:
                    means[layer["name"]] = float(val)

        if not {"clay", "sand", "silt", "phh2o"}.issubset(means):
            raise ValueError("SoilGrids response omitted required layers")

        clay = means["clay"] / 10.0
        sand = means["sand"] / 10.0
        texture = "CLAY" if clay > 45 else "SANDY" if sand > 70 else "CLAY_LOAM" if clay > 32 else "SANDY_LOAM" if sand > 52 else "LOAM"
        ph = round(means["phh2o"] / 10.0, 1)

        # Convert SOC (dg/kg) to SOM (%) using verified Van Bemmelen formula
        raw_soc = means.get("soc")
        if raw_soc is not None:
            som_pct = convert_soc_to_som(raw_soc)
        else:
            som_pct = 1.2  # Conservative estimate when SOC is unavailable

        result = {
            "soil_texture": texture,
            "soil_ph": ph,
            "soil_organic_matter_pct": som_pct,
            "raw_soc_dg_kg": raw_soc,
        }
        self.cache.set(key, result)
        return AdapterResult(
            payload=result,
            status=DataStatus.LIVE,
            source_name="ISRIC SoilGrids 2.0 (0-30cm)",
            retrieval_timestamp=now_iso,
            observation_period="ISRIC Global Soil Profile Database v2020",
        )


class SoilDataService:
    def __init__(self, primary_provider: SoilProvider, cache: TTLCache = SHARED_CACHE):
        self.primary_provider = primary_provider
        self.cache = cache

    async def get_soil_data(self, latitude: float, longitude: float) -> AdapterResult:
        try:
            return await self.primary_provider.fetch(latitude, longitude)
        except Exception as exc:
            logger.warning("Primary soil provider failed for (%f, %f): %s. Using regional estimate.", latitude, longitude, exc)
            raise


def fallback_for(request: FarmRequest) -> tuple[EnvironmentalContext, list[Provenance]]:
    profiles = demo_profiles()
    selected = next((p for p in profiles if p["id"] == request.demo_profile_id), None)
    if selected is None:
        selected = min(profiles, key=lambda p: (p["latitude"] - request.latitude) ** 2 + (p["longitude"] - request.longitude) ** 2)

    values = selected["context"]
    rainfall = values["seasonal_rainfall_mm"]
    historical = values["historical_rainfall_mm"]
    anomaly = precipitation_anomaly(rainfall, historical)
    crops = _load_all_crops()

    # Determine texture and provenance
    chosen_texture = (request.soil_texture_override or request.soil_texture or selected["soil_texture"]).upper()
    texture_source = "OVERRIDE" if (request.soil_texture_override or request.soil_texture) else "ESTIMATED"

    # Effective water calculation
    eff_water = calculate_effective_water(rainfall, 300.0 if request.is_irrigated else 0.0)

    # Estimate crop-specific GDD and heat stress from profile baseline
    base_annual_gdd = values["annual_gdd"]
    crop_gdd = {}
    crop_heat = {}
    for c in crops:
        temp_ratio = max(0.4, (30.0 - c.base_temp_c) / 20.0)
        crop_gdd[c.crop_id] = round(base_annual_gdd * temp_ratio)
        crop_heat[c.crop_id] = values["heat_stress_days"] if c.max_temp_c < 36 else max(0, values["heat_stress_days"] - 8)

    now_iso = datetime.now(timezone.utc).isoformat()
    context = EnvironmentalContext(
        annual_gdd=base_annual_gdd,
        seasonal_rainfall_mm=rainfall,
        historical_rainfall_mm=historical,
        precipitation_anomaly_pct=round(anomaly, 1),
        rainfall_status=rainfall_status(anomaly),
        heat_stress_days=values["heat_stress_days"],
        soil_moisture_state="UNAVAILABLE",
        soil_texture=chosen_texture,
        soil_texture_source=texture_source,
        soil_ph=values["soil_ph"],
        soil_organic_matter_pct=values["soil_organic_matter_pct"],
        effective_water_mm=eff_water,
        crop_gdd=crop_gdd,
        crop_heat_stress_days=crop_heat,
        data_quality={
            "climate": DataStatus.FALLBACK,
            "soil": DataStatus.ESTIMATED if texture_source != "OVERRIDE" else DataStatus.ESTIMATED,
            "soil_moisture": DataStatus.UNAVAILABLE,
        },
    )

    soil_source_label = "User manual override" if texture_source == "OVERRIDE" else "Demonstration soil estimate"
    provenance = [
        Provenance(
            variable="temperature_and_rainfall",
            source="Demonstration regional profile",
            status=DataStatus.FALLBACK,
        ),
        Provenance(
            variable="soil_properties",
            source=soil_source_label,
            status=DataStatus.ESTIMATED,
        ),
        Provenance(
            variable="root_zone_moisture",
            source="Optional SMAP adapter not configured",
            status=DataStatus.UNAVAILABLE,
        ),
    ]
    return context, provenance


async def build_context(request: FarmRequest) -> tuple[EnvironmentalContext, list[Provenance]]:
    if os.getenv("DEMO_MODE", "false").lower() == "true" or request.demo_profile_id:
        return fallback_for(request)

    client = get_shared_client()
    climate_adapter = NasaPowerAdapter(client, SHARED_CACHE)
    soil_service = SoilDataService(SoilGridsProvider(client, SHARED_CACHE), SHARED_CACHE)

    climate_result, soil_result = await asyncio.gather(
        climate_adapter.fetch(request.latitude, request.longitude),
        soil_service.get_soil_data(request.latitude, request.longitude),
        return_exceptions=True,
    )

    fallback_context, _ = fallback_for(request)
    now_iso = datetime.now(timezone.utc).isoformat()

    # Process climate data
    if isinstance(climate_result, AdapterResult):
        climate = climate_result.payload
        climate_status = climate_result.status
        climate_source = climate_result.source_name
        climate_period = climate_result.observation_period
    else:
        logger.warning("NASA POWER unavailable for (%f, %f): %s. Using regional profile.", request.latitude, request.longitude, climate_result)
        climate = fallback_context.model_dump()
        climate_status = DataStatus.FALLBACK
        climate_source = "Demonstration regional profile (NASA POWER fallback)"
        climate_period = "Historical profile"

    # Process soil data
    if isinstance(soil_result, AdapterResult):
        soil = soil_result.payload
        soil_status = soil_result.status
        soil_source = soil_result.source_name
    else:
        logger.warning("ISRIC SoilGrids unavailable for (%f, %f): %s. Using regional soil estimate.", request.latitude, request.longitude, soil_result)
        soil = fallback_context.model_dump()
        soil_status = DataStatus.ESTIMATED
        soil_source = "Demonstration soil estimate (SoilGrids fallback)"

    anomaly = precipitation_anomaly(climate["seasonal_rainfall_mm"], climate["historical_rainfall_mm"])

    # Soil texture precedence:
    # 1. User manual override (request.soil_texture_override or request.soil_texture)
    # 2. Provider data (SoilGrids)
    # 3. Fallback estimate
    user_override = request.soil_texture_override or request.soil_texture
    if user_override:
        texture = user_override.upper()
        texture_source = "OVERRIDE"
        soil_provenance_source = f"User manual override ({user_override.upper()})"
    else:
        texture = soil["soil_texture"].upper()
        texture_source = soil_status.value
        soil_provenance_source = soil_source

    eff_water = calculate_effective_water(
        climate["seasonal_rainfall_mm"],
        request.irrigation_supply_mm if request.irrigation_supply_mm is not None else (300.0 if request.is_irrigated else 0.0),
    )

    context = EnvironmentalContext(
        annual_gdd=climate["annual_gdd"],
        seasonal_rainfall_mm=climate["seasonal_rainfall_mm"],
        historical_rainfall_mm=climate["historical_rainfall_mm"],
        precipitation_anomaly_pct=round(anomaly, 1),
        rainfall_status=rainfall_status(anomaly),
        heat_stress_days=climate["heat_stress_days"],
        soil_moisture_state="UNAVAILABLE",
        soil_texture=texture,
        soil_texture_source=texture_source,
        soil_ph=soil["soil_ph"],
        soil_organic_matter_pct=soil["soil_organic_matter_pct"],
        effective_water_mm=eff_water,
        crop_gdd=climate.get("crop_gdd", fallback_context.crop_gdd),
        crop_heat_stress_days=climate.get("crop_heat_stress_days", fallback_context.crop_heat_stress_days),
        data_quality={
            "climate": climate_status,
            "soil": soil_status,
            "soil_moisture": DataStatus.UNAVAILABLE,
        },
    )

    provenance = [
        Provenance(
            variable="temperature_and_rainfall",
            source=climate_source,
            status=climate_status,
            unit="°C / mm",
            observation_period=climate_period,
            retrieval_timestamp=now_iso,
        ),
        Provenance(
            variable="soil_properties",
            source=soil_provenance_source,
            status=soil_status if texture_source != "OVERRIDE" else DataStatus.ESTIMATED,
            unit="texture, pH, SOM %",
            retrieval_timestamp=now_iso,
        ),
        Provenance(
            variable="root_zone_moisture",
            source="Optional SMAP adapter not configured",
            status=DataStatus.UNAVAILABLE,
            unit="m³/m³",
            retrieval_timestamp=now_iso,
        ),
    ]

    return context, provenance
