from __future__ import annotations

import hmac
import logging
import os
import time
from collections import OrderedDict, deque
from copy import deepcopy
from datetime import timedelta
from uuid import uuid4

from fastapi import Body, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.core.calculations import precipitation_anomaly, rainfall_status
from app.core.engine import load_crops, rank_rotations
from app.models.schemas import EvaluationResponse, FarmRequest, SensorReadingIn, SimulationRequest
from app.services import sensor_store
from app.services.environment import build_context, demo_profiles
from app.services.sensor_context import apply_sensor_context

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("field_shift")

app = FastAPI(
    title="Field Shift API",
    version="0.1.0",
    description="Transparent, deterministic climate-resilient crop rotation decision support.",
)
origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if item.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=["GET", "POST"], allow_headers=["*"])

EVALUATIONS: dict[str, tuple[FarmRequest, EvaluationResponse]] = {}


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "field-shift-api", "engine": "deterministic"}


@app.get("/api/v1/crops")
def crops():
    return {"crops": [crop.model_dump() for crop in load_crops()]}


@app.get("/api/v1/demo-profiles")
def profiles():
    return {"profiles": [{key: value for key, value in profile.items() if key != "context"} for profile in demo_profiles()]}


INGEST_WINDOW: OrderedDict[str, deque[float]] = OrderedDict()
MAX_INGEST_KEYS = 10_000


def _rate_limited(device_id: str) -> bool:
    try:
        limit = max(1, int(os.getenv("SENSOR_RATE_LIMIT_PER_MINUTE", "10")))
    except ValueError:
        limit = 10
    now = time.monotonic()
    cutoff = now - 60
    events = INGEST_WINDOW.pop(device_id, deque())
    while events and events[0] < cutoff:
        events.popleft()
    if len(events) >= limit:
        INGEST_WINDOW[device_id] = events
        return True
    events.append(now)
    INGEST_WINDOW[device_id] = events
    while len(INGEST_WINDOW) > MAX_INGEST_KEYS:
        INGEST_WINDOW.popitem(last=False)
    return False


def _require_internal_token(token: str | None) -> None:
    expected = os.getenv("SENSOR_INTERNAL_TOKEN")
    if not expected or not token or not hmac.compare_digest(token, expected):
        raise HTTPException(status_code=403, detail="Valid X-Internal-Token required for sensor query endpoints")


@app.post("/api/v1/sensors/readings")
async def ingest_sensor_reading(
    reading: SensorReadingIn,
    x_device_id: str | None = Header(default=None),
    x_device_key: str | None = Header(default=None),
):
    if not x_device_id or not x_device_key:
        raise HTTPException(status_code=401, detail="X-Device-Id and X-Device-Key headers are required")
    if reading.device_id != x_device_id:
        raise HTTPException(status_code=403, detail="Payload device_id does not match authenticated device")
    status, device = sensor_store.check_credentials(x_device_id, x_device_key)
    if status == "unknown_device":
        logger.warning("sensor_ingest_rejected reason=unknown_device device=%s", x_device_id)
        raise HTTPException(status_code=401, detail="Unknown device")
    if status != "ok":
        logger.warning("sensor_ingest_reason=unauthorized device=%s", x_device_id)
        raise HTTPException(status_code=401, detail="Device authentication failed")
    if _rate_limited(x_device_id):
        raise HTTPException(status_code=429, detail="Device submission rate limit exceeded")
    moment = sensor_store.parse_timestamp(reading.device_timestamp.isoformat())
    now = sensor_store.now_utc()
    if moment > now + timedelta(minutes=15):
        raise HTTPException(status_code=422, detail="device_timestamp is implausibly far in the future")
    if moment < now - timedelta(days=400):
        raise HTTPException(status_code=422, detail="device_timestamp is older than the accepted backfill window")
    outcome = sensor_store.insert_reading(device, reading.model_dump(exclude={"device_id", "device_timestamp"}), reading.device_timestamp.isoformat())
    logger.info("sensor_ingest device=%s farm=%s outcome=%s", device["device_id"], device["farm_id"], outcome)
    return {"status": outcome, "farm_id": device["farm_id"], "duplicate": outcome == "duplicate"}


@app.get("/api/v1/sensors/{farm_id}/latest")
def sensor_latest(farm_id: str, x_internal_token: str | None = Header(default=None)):
    _require_internal_token(x_internal_token)
    readings = sensor_store.latest_readings(farm_id)
    if readings is None:
        raise HTTPException(status_code=404, detail="Farm not registered")
    return {"farm_id": farm_id, "fresh_window_hours": sensor_store.max_age_hours(), "readings": readings}


@app.get("/api/v1/sensors/{farm_id}/history")
def sensor_history(farm_id: str, hours: float = Query(default=168, gt=0, le=8760), limit: int = Query(default=1000, ge=1, le=1000), x_internal_token: str | None = Header(default=None)):
    _require_internal_token(x_internal_token)
    readings = sensor_store.reading_history(farm_id, hours=hours, limit=limit)
    if readings is None:
        raise HTTPException(status_code=404, detail="Farm not registered")
    return {"farm_id": farm_id, "hours": hours, "readings": readings}


@app.get("/api/v1/sensors/{farm_id}/status")
def sensor_status(farm_id: str, x_internal_token: str | None = Header(default=None)):
    _require_internal_token(x_internal_token)
    status = sensor_store.farm_status(farm_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Farm not registered")
    return status


async def evaluate_request(request: FarmRequest, evaluation_id: str | None = None) -> EvaluationResponse:
    try:
        context, provenance = await build_context(request)
        apply_sensor_context(context, provenance, request)
        if request.soil_moisture_override is not None:
            context.soil_moisture_index = max(0.0, min(1.0, request.soil_moisture_override / 100.0))
            context.soil_moisture_state = "HARDWARE_CALIBRATED"
        rotations, rejected = rank_rotations(
            context,
            request.current_crop_id,
            request.is_irrigated,
            request.farmer_priority,
            irrigation_supply_mm=request.irrigation_supply_mm,
            use_ml_blend=request.use_ml_blend,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not rotations:
        raise HTTPException(status_code=422, detail="No safe three-year sequence passed the current hard filters. Review irrigation or local crop constraints.")
    identifier = evaluation_id or str(uuid4())
    response = EvaluationResponse(
        evaluation_id=identifier, environmental_context=context, data_provenance=provenance,
        recommended_rotations=rotations, rejected_examples=rejected,
    )
    EVALUATIONS[identifier] = (request, response)
    try:
        sensor_store.save_evaluation(identifier, request.model_dump(), response.model_dump())
    except Exception as exc:
        logger.warning("Could not persist evaluation to disk: %s", exc)
    logger.info("evaluation_complete id=%s profile=%s rotations=%s", identifier, request.demo_profile_id or "custom", len(rotations))
    return response


@app.post("/api/v1/farms/evaluate", response_model=EvaluationResponse)
async def evaluate(request: FarmRequest):
    return await evaluate_request(request)


@app.post("/api/v1/farms/simulate", response_model=EvaluationResponse)
async def simulate(request: SimulationRequest):
    stored = EVALUATIONS.get(request.evaluation_id)
    if not stored:
        persisted = sensor_store.load_evaluation(request.evaluation_id)
        if persisted:
            req_dict, resp_dict = persisted
            stored = (FarmRequest.model_validate(req_dict), EvaluationResponse.model_validate(resp_dict))
            EVALUATIONS[request.evaluation_id] = stored
    if not stored:
        raise HTTPException(status_code=404, detail="Evaluation not found; run an evaluation before simulating.")
    farm_request, original = stored
    context = deepcopy(original.environmental_context)
    context.seasonal_rainfall_mm *= 1 + request.rainfall_change_pct / 100
    context.historical_rainfall_mm = original.environmental_context.historical_rainfall_mm
    context.precipitation_anomaly_pct = precipitation_anomaly(context.seasonal_rainfall_mm, context.historical_rainfall_mm)
    context.rainfall_status = rainfall_status(context.precipitation_anomaly_pct)
    context.heat_stress_days = min(90, context.heat_stress_days + round(request.temperature_change_c * 6))
    context.annual_gdd *= 1 + request.temperature_change_c * .035
    rotations, rejected = rank_rotations(context, farm_request.current_crop_id, request.irrigation_available, farm_request.farmer_priority)
    if not rotations:
        raise HTTPException(status_code=422, detail="No sequence passed the scenario's conservative hard filters.")
    simulated_id = str(uuid4())
    response = EvaluationResponse(
        evaluation_id=simulated_id, environmental_context=context, data_provenance=original.data_provenance,
        recommended_rotations=rotations, rejected_examples=rejected,
    )
    updated_req = farm_request.model_copy(update={"is_irrigated": request.irrigation_available})
    EVALUATIONS[simulated_id] = (updated_req, response)
    try:
        sensor_store.save_evaluation(simulated_id, updated_req.model_dump(), response.model_dump())
    except Exception as exc:
        logger.warning("Could not persist simulated evaluation: %s", exc)
    return response


LATEST_HARDWARE_TELEMETRY: dict[str, Any] = {
    "active": False,
    "device_id": "esp32-field-node-01",
    "temperature_c": 28.4,
    "humidity_pct": 42.0,
    "pressure_hpa": 1010.5,
    "gas_resistance_kohm": 138.2,
    "soil_moisture_pct": 34.5,
    "soil_raw_adc": 2480,
    "rssi_dbm": -68,
    "timestamp": time.time(),
    "is_synthetic": True,
}


@app.post("/api/sensors/ingest")
@app.post("/api/v1/sensors/ingest")
async def ingest_hardware_telemetry(payload: dict[str, Any] = Body(...)):
    global LATEST_HARDWARE_TELEMETRY
    now = time.time()
    LATEST_HARDWARE_TELEMETRY = {
        "active": True,
        "device_id": str(payload.get("device_id", "esp32-field-node-01")),
        "temperature_c": float(payload.get("temperature_c", 28.0)),
        "humidity_pct": float(payload.get("humidity_pct", payload.get("humidity_percent", 45.0))),
        "pressure_hpa": float(payload.get("pressure_hpa", 1012.0)),
        "gas_resistance_kohm": float(payload.get("gas_resistance_kohm", payload.get("gas_resistance_ohms", 145000) / 1000.0)),
        "soil_moisture_pct": float(payload.get("soil_moisture_pct", 50.0)),
        "soil_raw_adc": int(payload.get("soil_raw_adc", payload.get("soil_moisture_raw", 2000))),
        "rssi_dbm": int(payload.get("rssi_dbm", -70)),
        "timestamp": now,
        "is_synthetic": False,
    }
    logger.info("hardware_telemetry_ingested device=%s temp=%.1f moisture=%.1f", LATEST_HARDWARE_TELEMETRY["device_id"], LATEST_HARDWARE_TELEMETRY["temperature_c"], LATEST_HARDWARE_TELEMETRY["soil_moisture_pct"])
    return {"status": "ok", "received": True, "device_id": LATEST_HARDWARE_TELEMETRY["device_id"], "timestamp": now}


@app.get("/api/sensors/latest")
@app.get("/api/v1/sensors/latest")
def get_latest_hardware_telemetry():
    global LATEST_HARDWARE_TELEMETRY
    return {"status": "ok", **LATEST_HARDWARE_TELEMETRY}


@app.post("/api/sensors/override")
@app.post("/api/v1/sensors/override")
def override_hardware_telemetry(payload: dict[str, Any] = Body(...)):
    global LATEST_HARDWARE_TELEMETRY
    now = time.time()
    LATEST_HARDWARE_TELEMETRY.update(payload)
    LATEST_HARDWARE_TELEMETRY["timestamp"] = now
    LATEST_HARDWARE_TELEMETRY["active"] = True
    return {"status": "ok", **LATEST_HARDWARE_TELEMETRY}

