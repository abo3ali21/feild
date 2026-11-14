from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import httpx

from app.core.calculations import calculate_gdd, precipitation_anomaly, rainfall_status
from app.models.schemas import DataStatus, EnvironmentalContext, FarmRequest, Provenance

logger = logging.getLogger(__name__)
DATA_DIR = Path(__file__).resolve().parents[1] / "data"


@dataclass
class AdapterResult:
    payload: dict[str, Any]
    status: DataStatus


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
                        await asyncio.sleep(.2 * (2**attempt))
        raise RuntimeError("Environmental data service unavailable") from last_error


class NasaPowerAdapter:
    url = "https://power.larc.nasa.gov/api/temporal/daily/point"

    def __init__(self, client: RetryingClient, cache: TTLCache):
        self.client, self.cache = client, cache

    async def fetch(self, latitude: float, longitude: float) -> AdapterResult:
        key = f"nasa:{latitude:.3f}:{longitude:.3f}"
        if cached := self.cache.get(key):
            return AdapterResult(cached, DataStatus.CACHED)
        end = date.today() - timedelta(days=30)
        start = end - timedelta(days=365 * 4)
        payload = await self.client.get_json(self.url, {
            "parameters": "T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,ALLSKY_SFC_SW_DWN",
            "community": "AG", "longitude": str(longitude), "latitude": str(latitude),
            "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"), "format": "JSON",
        })
        parameter = payload.get("properties", {}).get("parameter", {})
        if not all(name in parameter for name in ("T2M_MAX", "T2M_MIN", "PRECTOTCORR")):
            raise ValueError("NASA POWER response omitted required variables")
        years: dict[str, dict[str, list[float]]] = {}
        for variable in ("T2M_MAX", "T2M_MIN", "PRECTOTCORR"):
            for day, value in parameter[variable].items():
                if value <= -900:
                    continue
                years.setdefault(day[:4], {}).setdefault(variable, []).append(float(value))
        complete = [values for values in years.values() if all(v in values for v in ("T2M_MAX", "T2M_MIN", "PRECTOTCORR"))]
        if len(complete) < 2:
            raise ValueError("NASA POWER response lacks enough complete years")
        recent, history = complete[-1], complete[:-1]
        season_slice = slice(-180, None)
        recent_rain = sum(recent["PRECTOTCORR"][season_slice])
        historical_rain = sum(sum(year["PRECTOTCORR"][season_slice]) for year in history) / len(history)
        tmax, tmin = recent["T2M_MAX"][season_slice], recent["T2M_MIN"][season_slice]
        result = {
            "annual_gdd": calculate_gdd(tmax, tmin, 10, 35),
            "seasonal_rainfall_mm": recent_rain,
            "historical_rainfall_mm": historical_rain,
            "heat_stress_days": sum(temp > 35 for temp in tmax),
        }
        self.cache.set(key, result)
        return AdapterResult(result, DataStatus.LIVE)


class SoilGridsAdapter:
    url = "https://rest.isric.org/soilgrids/v2.0/properties/query"

    def __init__(self, client: RetryingClient, cache: TTLCache):
        self.client, self.cache = client, cache

    async def fetch(self, latitude: float, longitude: float) -> AdapterResult:
        key = f"soil:{latitude:.3f}:{longitude:.3f}"
        if cached := self.cache.get(key):
            return AdapterResult(cached, DataStatus.CACHED)
        params = [("lon", str(longitude)), ("lat", str(latitude)), ("depth", "0-30cm"), ("value", "mean")]
        params += [("property", item) for item in ("clay", "sand", "silt", "phh2o", "soc")]
        payload = await self.client.get_json(self.url, params)
        layers = payload.get("properties", {}).get("layers", [])
        means = {}
        for layer in layers:
            depth = next((d for d in layer.get("depths", []) if d.get("label") == "0-30cm"), None)
            if depth:
                means[layer["name"]] = depth.get("values", {}).get("mean")
        if not {"clay", "sand", "silt", "phh2o"}.issubset(means):
            raise ValueError("SoilGrids response omitted required layers")
        clay, sand = means["clay"] / 10, means["sand"] / 10
        texture = "CLAY" if clay > 45 else "SANDY" if sand > 70 else "CLAY_LOAM" if clay > 32 else "SANDY_LOAM" if sand > 52 else "LOAM"
        result = {"soil_texture": texture, "soil_ph": means["phh2o"] / 10, "soil_organic_matter_pct": (means.get("soc") or 12) / 10 * 1.724}
        self.cache.set(key, result)
        return AdapterResult(result, DataStatus.LIVE)


def demo_profiles() -> list[dict]:
    return json.loads((DATA_DIR / "demo_profiles.json").read_text())


def fallback_for(request: FarmRequest) -> tuple[EnvironmentalContext, list[Provenance]]:
    profiles = demo_profiles()
    selected = next((p for p in profiles if p["id"] == request.demo_profile_id), None)
    if selected is None:
        selected = min(profiles, key=lambda p: (p["latitude"] - request.latitude) ** 2 + (p["longitude"] - request.longitude) ** 2)
    values = selected["context"]
    rainfall = values["seasonal_rainfall_mm"]
    historical = values["historical_rainfall_mm"]
    anomaly = precipitation_anomaly(rainfall, historical)
    context = EnvironmentalContext(
        annual_gdd=values["annual_gdd"], seasonal_rainfall_mm=rainfall, historical_rainfall_mm=historical,
        precipitation_anomaly_pct=anomaly, rainfall_status=rainfall_status(anomaly),
        heat_stress_days=values["heat_stress_days"], soil_moisture_state="UNAVAILABLE",
        soil_texture=(request.soil_texture or selected["soil_texture"]).upper(), soil_ph=values["soil_ph"],
        soil_organic_matter_pct=values["soil_organic_matter_pct"],
        data_quality={"climate": DataStatus.FALLBACK, "soil": DataStatus.ESTIMATED, "soil_moisture": DataStatus.UNAVAILABLE},
    )
    provenance = [
        Provenance(variable="temperature_and_rainfall", source="Demonstration regional profile", status=DataStatus.FALLBACK),
        Provenance(variable="soil_properties", source="Demonstration soil estimate", status=DataStatus.ESTIMATED),
        Provenance(variable="root_zone_moisture", source="Optional SMAP adapter not configured", status=DataStatus.UNAVAILABLE),
    ]
    return context, provenance


async def build_context(request: FarmRequest) -> tuple[EnvironmentalContext, list[Provenance]]:
    if os.getenv("DEMO_MODE", "false").lower() == "true" or request.demo_profile_id:
        return fallback_for(request)
    client, cache = RetryingClient(), TTLCache()
    climate_adapter, soil_adapter = NasaPowerAdapter(client, cache), SoilGridsAdapter(client, cache)
    climate_result, soil_result = await asyncio.gather(
        climate_adapter.fetch(request.latitude, request.longitude), soil_adapter.fetch(request.latitude, request.longitude),
        return_exceptions=True,
    )
    fallback_context, _ = fallback_for(request)
    climate = climate_result.payload if isinstance(climate_result, AdapterResult) else fallback_context.model_dump()
    soil = soil_result.payload if isinstance(soil_result, AdapterResult) else fallback_context.model_dump()
    climate_status = climate_result.status if isinstance(climate_result, AdapterResult) else DataStatus.FALLBACK
    soil_status = soil_result.status if isinstance(soil_result, AdapterResult) else DataStatus.ESTIMATED
    anomaly = precipitation_anomaly(climate["seasonal_rainfall_mm"], climate["historical_rainfall_mm"])
    context = EnvironmentalContext(
        annual_gdd=climate["annual_gdd"], seasonal_rainfall_mm=climate["seasonal_rainfall_mm"],
        historical_rainfall_mm=climate["historical_rainfall_mm"], precipitation_anomaly_pct=anomaly,
        rainfall_status=rainfall_status(anomaly), heat_stress_days=climate["heat_stress_days"], soil_moisture_state="UNAVAILABLE",
        soil_texture=(request.soil_texture or soil["soil_texture"]).upper(), soil_ph=soil["soil_ph"],
        soil_organic_matter_pct=soil["soil_organic_matter_pct"],
        data_quality={"climate": climate_status, "soil": soil_status, "soil_moisture": DataStatus.UNAVAILABLE},
    )
    return context, [
        Provenance(variable="temperature_and_rainfall", source="NASA POWER" if climate_status != DataStatus.FALLBACK else "Demonstration regional profile", status=climate_status),
        Provenance(variable="soil_properties", source="ISRIC SoilGrids" if soil_status in (DataStatus.LIVE, DataStatus.CACHED) else "Demonstration soil estimate", status=soil_status),
        Provenance(variable="root_zone_moisture", source="Optional SMAP adapter not configured", status=DataStatus.UNAVAILABLE),
    ]
