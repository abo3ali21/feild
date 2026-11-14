import pytest
from app.core.calculations import (
    calculate_crop_heat_stress,
    calculate_effective_water,
    calculate_gdd,
    convert_soc_to_som,
    normalize_weights,
    precipitation_anomaly,
)
from app.core.engine import family_break, load_crops, rank_rotations, score_rotation, suitability
from app.models.schemas import DataStatus, EnvironmentalContext, Priority


def context(**changes):
    base = dict(
        annual_gdd=1500,
        seasonal_rainfall_mm=520,
        historical_rainfall_mm=650,
        precipitation_anomaly_pct=-20,
        rainfall_status="MODERATE_DEFICIT",
        heat_stress_days=12,
        soil_moisture_state="UNAVAILABLE",
        soil_texture="LOAM",
        soil_ph=6.4,
        soil_organic_matter_pct=1.5,
        data_quality={"climate": DataStatus.FALLBACK, "soil": DataStatus.ESTIMATED, "soil_moisture": DataStatus.UNAVAILABLE},
    )
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


# Phase 1.1 Tests: Soil Organic Matter conversion
def test_soc_to_som_conversion():
    # 120 dg/kg = 12 g/kg = 1.2% SOC -> 1.2 * 1.724 = 2.07% SOM
    assert convert_soc_to_som(120.0) == 2.07
    # 58 dg/kg = 0.58% SOC -> 0.58 * 1.724 = 1.0% SOM
    assert convert_soc_to_som(58.0) == 1.00
    # Missing SOC returns None
    assert convert_soc_to_som(None) is None
    # Negative SOC raises error
    with pytest.raises(ValueError, match="negative"):
        convert_soc_to_som(-10.0)
    # Impossible high SOC for mineral soil raises error
    with pytest.raises(ValueError, match="out of plausible bounds"):
        convert_soc_to_som(5000.0)


# Phase 1.2 Tests: Crop-specific GDD and heat stress
def test_crop_specific_gdd_differences():
    tmax = [28.0, 32.0, 30.0, 25.0]
    tmin = [12.0, 14.0, 16.0, 10.0]
    # Barley base 0 should accumulate significantly more GDD than maize base 10
    barley_gdd = calculate_gdd(tmax, tmin, base=0.0, cutoff=30.0)
    maize_gdd = calculate_gdd(tmax, tmin, base=10.0, cutoff=35.0)
    assert barley_gdd > maize_gdd


def test_crop_heat_stress_counts():
    tmax = [31.0, 34.0, 36.5, 38.0, 29.0]
    # Potato max temp is 29°C -> 4 days exceed
    assert calculate_crop_heat_stress(tmax, threshold_c=29.0) == 4
    # Sorghum max temp is 38°C -> 0 days strictly exceed
    assert calculate_crop_heat_stress(tmax, threshold_c=38.0) == 0


# Phase 1.4 Tests: Effective water and irrigation balance
def test_effective_water_usda_scs():
    # <= 250 mm scales at 0.8
    assert calculate_effective_water(rainfall_mm=200.0, irrigation_mm=0.0) == 160.0
    # > 250 mm: 125 + (500 * 0.5) = 375 mm
    assert calculate_effective_water(rainfall_mm=500.0, irrigation_mm=0.0) == 375.0
    # With 100 mm irrigation at 75% efficiency: 375 + 75 = 450 mm
    assert calculate_effective_water(rainfall_mm=500.0, irrigation_mm=100.0) == 450.0


# Phase 3.1 Tests: Rotation diversity and deduplication
def test_rotation_deduplication_of_equivalent_crop_sets():
    rotations, _ = rank_rotations(context(), "maize", False, Priority.balanced)
    assert len(rotations) <= 3
    crop_sets = [frozenset(c.crop_id for c in r.sequence) for r in rotations]
    # Verify no two recommendations share the exact same set of 3 crops
    assert len(crop_sets) == len(set(crop_sets))


def test_legume_precursor_agronomic_benefit():
    by_id = {c.crop_id: c for c in load_crops()}
    cowpea = by_id["cowpea"]  # Legume
    sorghum = by_id["sorghum"]  # Poaceae (non-legume)
    sunflower = by_id["sunflower"]  # Asteraceae (non-legume)

    # Legume -> Cereal -> Sunflower has precursor bonus
    seq_optimal = (cowpea, sorghum, sunflower)
    # Cereal -> Sunflower -> Legume puts legume last
    seq_delayed = (sorghum, sunflower, cowpea)

    ctx = context()
    score_opt = score_rotation(seq_optimal, ctx, False, Priority.soil_recovery)
    score_del = score_rotation(seq_delayed, ctx, False, Priority.soil_recovery)
    assert score_opt.scores.soil >= score_del.scores.soil
