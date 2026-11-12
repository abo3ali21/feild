from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class Priority(str, Enum):
    balanced = "balanced"
    drought_resilience = "drought_resilience"
    soil_recovery = "soil_recovery"
    crop_diversity = "crop_diversity"


class DataStatus(str, Enum):
    LIVE = "LIVE"
    CACHED = "CACHED"
    ESTIMATED = "ESTIMATED"
    FALLBACK = "FALLBACK"
    UNAVAILABLE = "UNAVAILABLE"
    SENSOR = "SENSOR"


class FarmRequest(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    current_crop_id: str
    soil_texture: str | None = None
    is_irrigated: bool = False
    farmer_priority: Priority = Priority.balanced
    demo_profile_id: str | None = None


class SimulationRequest(BaseModel):
    evaluation_id: str
    rainfall_change_pct: float = Field(ge=-40, le=20)
    temperature_change_c: float = Field(ge=0, le=4)
    irrigation_available: bool


class Crop(BaseModel):
    crop_id: str
    common_name: str
    family: str
    base_temp_c: float
    max_temp_c: float
    minimum_gdd: float
    minimum_water_mm: float
    maximum_water_mm: float
    drought_tolerance: float = Field(ge=0, le=1)
    minimum_ph: float
    maximum_ph: float
    root_depth: Literal["SHALLOW", "MEDIUM", "DEEP"]
    is_legume: bool
    nitrogen_credit_kg_ha: float
    nitrogen_removal_index: float = Field(ge=0, le=1)
    residue_score: float = Field(ge=0, le=1)
    irrigation_required: bool = False
    source_notes: str


class EnvironmentalContext(BaseModel):
    annual_gdd: float
    seasonal_rainfall_mm: float
    historical_rainfall_mm: float
    precipitation_anomaly_pct: float
    rainfall_status: str
    heat_stress_days: int
    soil_moisture_state: str
    soil_moisture_index: float | None = Field(default=None, ge=0, le=1)
    soil_texture: str
    soil_ph: float
    soil_organic_matter_pct: float
    data_quality: dict[str, DataStatus]


class Decision(BaseModel):
    passed: bool
    rule: str
    reason: str


class ScoreSet(BaseModel):
    overall: int = Field(ge=0, le=100)
    climate: int = Field(ge=0, le=100)
    water: int = Field(ge=0, le=100)
    soil: int = Field(ge=0, le=100)
    diversity: int = Field(ge=0, le=100)


class SequenceItem(BaseModel):
    year: int
    crop_id: str
    name: str


class Rotation(BaseModel):
    rank: int
    sequence: list[SequenceItem]
    scores: ScoreSet
    explanations: list[str]
    warnings: list[str]
    factors: dict[str, list[str]]


class Provenance(BaseModel):
    variable: str
    source: str
    status: DataStatus


class EvaluationResponse(BaseModel):
    status: str = "success"
    evaluation_id: str
    environmental_context: EnvironmentalContext
    data_provenance: list[Provenance]
    recommended_rotations: list[Rotation]
    rejected_examples: list[Decision] = []


class WeightSet(BaseModel):
    climate: float
    water: float
    soil: float
    diversity: float

    @field_validator("diversity")
    @classmethod
    def weights_sum_to_one(cls, value: float, info):
        values = info.data
        if values and abs(sum(values.values()) + value - 1.0) > 1e-6:
            raise ValueError("MCDA weights must sum to 1.0")
        return value


class SensorReadingIn(BaseModel):
    """Payload from an authenticated ESP32 device.

    Ranges are physical plausibility bounds for the BME680 and the ESP32 12-bit
    ADC, not agronomic thresholds. A channel may be absent when that sensor is
    disconnected; at least one channel must be present.
    """
    device_id: str = Field(min_length=1, max_length=128)
    temperature_c: float | None = Field(default=None, ge=-40, le=85)
    humidity_percent: float | None = Field(default=None, ge=0, le=100)
    pressure_hpa: float | None = Field(default=None, ge=300, le=1100)
    gas_resistance_ohms: float | None = Field(default=None, gt=0, le=10_000_000)
    soil_moisture_raw: int | None = Field(default=None, ge=0, le=4095)
    device_timestamp: datetime

    @model_validator(mode="after")
    def at_least_one_measurement(self):
        channels = (self.temperature_c, self.humidity_percent, self.pressure_hpa, self.gas_resistance_ohms, self.soil_moisture_raw)
        if all(value is None for value in channels):
            raise ValueError("Reading must contain at least one sensor measurement")
        return self
