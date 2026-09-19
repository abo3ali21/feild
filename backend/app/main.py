from __future__ import annotations

import logging
import os
from copy import deepcopy
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.calculations import precipitation_anomaly, rainfall_status
from app.core.engine import load_crops, rank_rotations
from app.models.schemas import EvaluationResponse, FarmRequest, SimulationRequest
from app.services.environment import build_context, demo_profiles

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("field_shift")

app = FastAPI(
    title="Field Shift API",
    version="0.1.0",
    description="Transparent, deterministic climate-resilient crop rotation decision support.",
)
origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if item.strip()]
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


async def evaluate_request(request: FarmRequest, evaluation_id: str | None = None) -> EvaluationResponse:
    try:
        context, provenance = await build_context(request)
        rotations, rejected = rank_rotations(context, request.current_crop_id, request.is_irrigated, request.farmer_priority)
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
    logger.info("evaluation_complete id=%s profile=%s rotations=%s", identifier, request.demo_profile_id or "custom", len(rotations))
    return response


@app.post("/api/v1/farms/evaluate", response_model=EvaluationResponse)
async def evaluate(request: FarmRequest):
    return await evaluate_request(request)


@app.post("/api/v1/farms/simulate", response_model=EvaluationResponse)
async def simulate(request: SimulationRequest):
    stored = EVALUATIONS.get(request.evaluation_id)
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
    EVALUATIONS[simulated_id] = (farm_request.model_copy(update={"is_irrigated": request.irrigation_available}), response)
    return response
