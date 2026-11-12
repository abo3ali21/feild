from __future__ import annotations

import logging
import os

from app.models.schemas import DataStatus, EnvironmentalContext, FarmRequest, Provenance
from app.services import sensor_store

logger = logging.getLogger(__name__)


def water_influence() -> float:
    """Bounded strength of the fresh soil-moisture correction on the water score.

    Documented heuristic, not an agronomic standard: a sensor-relative moisture
    index of 0.5 (mid-band) applies no correction; the effect is linear to
    ±influence at the dry/wet ends. Set SENSOR_WATER_INFLUENCE=0 to disable.
    """
    try:
        return max(0.0, min(0.25, float(os.getenv("SENSOR_WATER_INFLUENCE", "0.10"))))
    except ValueError:
        return 0.10


def _moisture_band(percent: float) -> str:
    if percent < 33:
        return "DRY"
    if percent > 66:
        return "WET"
    return "GOOD"


def apply_sensor_context(context: EnvironmentalContext, provenance: list[Provenance], request: FarmRequest) -> None:
    """Overlay fresh, calibrated farm sensor data on the existing context in place.

    Degrades silently to the original context when no farm, device, or fresh
    reading is available; missing sensor data is never treated as zero.
    """
    try:
        farm_id = sensor_store.farm_for_coordinates(request.latitude, request.longitude)
        if farm_id is None:
            return
        aggregate = sensor_store.fresh_aggregate(farm_id)
        if aggregate is None:
            return
        percent = aggregate.get("soil_moisture_percent")
        if percent is None or aggregate.get("soil_stuck_sensor"):
            logger.info("sensor readings present but soil moisture unusable farm=%s stuck=%s", farm_id, aggregate.get("soil_stuck_sensor"))
            return
        context.soil_moisture_index = percent / 100.0
        context.soil_moisture_state = f"SENSOR_{_moisture_band(percent)}"
        context.data_quality["soil_moisture"] = DataStatus.SENSOR
        for entry in provenance:
            if entry.variable == "root_zone_moisture":
                entry.source = "ESP32 field sensor (device-relative two-point index)"
                entry.status = DataStatus.SENSOR
        # Temperature, humidity, pressure and gas resistance are stored and
        # validated but intentionally not scored: the existing model has no
        # validated pathway to fold instantaneous readings into seasonal
        # climate suitability (see README sensor integration limitations).
        logger.info("sensor_context_applied farm=%s moisture=%.0f%% samples=%s", farm_id, percent, aggregate["sample_count"])
    except Exception:
        logger.exception("sensor context overlay failed; continuing with existing data sources")
