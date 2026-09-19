from app.core.calculations import calculate_gdd, normalize_weights, precipitation_anomaly
from app.core.engine import family_break, load_crops, rank_rotations, suitability
from app.models.schemas import DataStatus, EnvironmentalContext, Priority


def context(**changes):
    base = dict(annual_gdd=1500, seasonal_rainfall_mm=520, historical_rainfall_mm=650,
                precipitation_anomaly_pct=-20, rainfall_status="MODERATE_DEFICIT", heat_stress_days=12,
                soil_moisture_state="UNAVAILABLE", soil_texture="LOAM", soil_ph=6.4,
                soil_organic_matter_pct=1.5,
                data_quality={"climate": DataStatus.FALLBACK, "soil": DataStatus.ESTIMATED, "soil_moisture": DataStatus.UNAVAILABLE})
    base.update(changes)
    return EnvironmentalContext(**base)


def test_gdd_calculation():
    assert calculate_gdd([30, 20], [10, 10], 10, 35) == 15


def test_precipitation_anomaly():
    assert precipitation_anomaly(490, 680) == pytest.approx(-27.941, .001)


def test_weight_normalization():
    assert sum(normalize_weights({"a": 2, "b": 3}).values()) == 1


def test_ph_filtering():
    potato = next(c for c in load_crops() if c.crop_id == "potato")
    assert any(not d.passed and d.rule == "SOIL_PH" for d in suitability(potato, context(soil_ph=8.2), True))


def test_family_break_and_same_family_adjacency():
    by_id = {c.crop_id: c for c in load_crops()}
    result = family_break((by_id["sorghum"], by_id["cowpea"], by_id["sunflower"]), by_id["maize"])
    assert not result.passed


def test_water_score_bounds_and_score_range():
    rotations, _ = rank_rotations(context(seasonal_rainfall_mm=900), "maize", False, Priority.balanced)
    assert rotations
    assert all(0 <= value <= 100 for r in rotations for value in r.scores.model_dump().values())


def test_stable_ranking():
    first, _ = rank_rotations(context(), "maize", False, Priority.balanced)
    second, _ = rank_rotations(context(), "maize", False, Priority.balanced)
    assert [[c.crop_id for c in r.sequence] for r in first] == [[c.crop_id for c in r.sequence] for r in second]


import pytest
