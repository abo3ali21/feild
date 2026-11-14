from __future__ import annotations


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def precipitation_anomaly(current: float, historical: float) -> float:
    if historical <= 0:
        return 0.0
    return ((current - historical) / historical) * 100


def calculate_gdd(tmax: list[float], tmin: list[float], base: float, cutoff: float | None = None) -> float:
    """Calculate Growing Degree Days (GDD) for a temperature series.
    
    Standard daily GDD calculation:
        daily_gdd = max(0, min(avg_temp, cutoff) - base)
    where avg_temp = (tmax + tmin) / 2.
    """
    if len(tmax) != len(tmin):
        raise ValueError("Temperature series must have the same length")
    total = 0.0
    for hi, lo in zip(tmax, tmin):
        if hi is None or lo is None:
            continue
        avg = (hi + lo) / 2.0
        if cutoff is not None:
            avg = min(avg, cutoff)
        total += max(0.0, avg - base)
    return total


def convert_soc_to_som(soc_raw_dg_kg: float | None) -> float | None:
    """Convert SoilGrids Soil Organic Carbon (SOC) in dg/kg to Soil Organic Matter (SOM) percentage.

    SoilGrids v2 reports SOC in dg/kg (decigrams per kilogram).
    1 dg/kg = 0.1 g/kg = 0.01% SOC (i.e. divide by 100 to get SOC %).
    Using the standard Van Bemmelen conversion factor of 1.724:
        SOM (%) = SOC (%) * 1.724 = (soc_raw_dg_kg / 100.0) * 1.724
    
    Plausibility check: Typical mineral soils range from 0.1% to 15% SOM.
    Values exceeding 1000 dg/kg (10% SOC / ~17.2% SOM) are flagged/capped for agricultural soils.
    """
    if soc_raw_dg_kg is None:
        return None
    if soc_raw_dg_kg < 0:
        raise ValueError(f"Soil organic carbon cannot be negative: {soc_raw_dg_kg}")
    if soc_raw_dg_kg > 3000:
        raise ValueError(f"Soil organic carbon value is out of plausible bounds: {soc_raw_dg_kg} dg/kg")
    
    soc_percent = soc_raw_dg_kg / 100.0
    som_percent = soc_percent * 1.724
    return round(som_percent, 2)


def calculate_crop_heat_stress(tmax: list[float], threshold_c: float) -> int:
    """Count days where maximum temperature strictly exceeds the crop-specific threshold."""
    return sum(1 for temp in tmax if temp is not None and temp > threshold_c)


def calculate_effective_water(rainfall_mm: float, irrigation_mm: float = 0.0, irrigation_efficiency: float = 0.75) -> float:
    """Calculate effective water supply available to crops in mm.

    Effective rainfall accounts for surface runoff and deep percolation using
    the USDA Soil Conservation Service (SCS) method approximation:
        If rainfall <= 250 mm: effective = rainfall * 0.8
        If rainfall > 250 mm:  effective = 125 + (rainfall * 0.5)
    Effective irrigation accounts for system application efficiency (default 75%).
    """
    if rainfall_mm < 0:
        rainfall_mm = 0.0
    if irrigation_mm < 0:
        irrigation_mm = 0.0

    if rainfall_mm <= 250:
        eff_rain = rainfall_mm * 0.8
    else:
        eff_rain = 125.0 + (rainfall_mm * 0.5)

    eff_irrig = irrigation_mm * clamp(irrigation_efficiency, 0.4, 0.95)
    return round(eff_rain + eff_irrig, 1)


def rainfall_status(anomaly: float) -> str:
    if anomaly < -25:
        return "SIGNIFICANT_DEFICIT"
    if anomaly < -10:
        return "MODERATE_DEFICIT"
    if anomaly > 15:
        return "ABOVE_NORMAL"
    return "NEAR_NORMAL"


def normalize_weights(weights: dict[str, float]) -> dict[str, float]:
    if any(value < 0 for value in weights.values()):
        raise ValueError("Weights cannot be negative")
    total = sum(weights.values())
    if total <= 0:
        raise ValueError("At least one weight must be positive")
    return {key: value / total for key, value in weights.items()}


def compute_ml_crop_suitability(
    crop: any,
    temp_c: float,
    soil_moisture_pct: float,
    soil_ph: float = 7.2,
    soil_n_ppm: float = 45.0,
) -> float:
    """
    Lightweight Gaussian Likelihood ML Scorer (P(Crop | EO + Sensor Features)).
    Models each agronomic feature as a Gaussian distribution around the crop's optimal window
    to produce a calibrated probability [0.0 - 100.0] alongside the Rule-Based score.
    """
    import math

    if hasattr(crop, "model_dump"):
        c_dict = crop.model_dump()
    elif isinstance(crop, dict):
        c_dict = crop
    else:
        c_dict = getattr(crop, "__dict__", {})

    temp_min = c_dict.get("temp_min") or c_dict.get("base_temp_c") or 15.0
    temp_max = c_dict.get("temp_max") or c_dict.get("max_temp_c") or 30.0
    temp_mu = (temp_min + temp_max) / 2.0
    temp_sigma = max(3.5, (temp_max - temp_min) / 2.0)

    # Optimal moisture target derived from crop water demand
    water_need = c_dict.get("water_mm") or c_dict.get("minimum_water_mm") or 450.0
    moisture_mu = min(80.0, max(30.0, (water_need / 700.0) * 75.0))
    moisture_sigma = 18.0

    ph_optimal = c_dict.get("ph_optimal")
    if ph_optimal is None:
        ph_min = c_dict.get("ph_min") or c_dict.get("minimum_ph") or 6.0
        ph_max = c_dict.get("ph_max") or c_dict.get("maximum_ph") or 7.5
        ph_optimal = (ph_min + ph_max) / 2.0
    ph_mu = ph_optimal
    ph_sigma = 0.8

    # Gaussian log-likelihoods
    ll_temp = math.exp(-0.5 * ((temp_c - temp_mu) / temp_sigma) ** 2)
    ll_moisture = math.exp(-0.5 * ((soil_moisture_pct - moisture_mu) / moisture_sigma) ** 2)
    ll_ph = math.exp(-0.5 * ((soil_ph - ph_mu) / ph_sigma) ** 2)

    # Nitrogen synergy boost for legumes in low-N soil
    is_legume = c_dict.get("is_legume", False) or str(c_dict.get("family", "")).lower() in ("fabaceae", "leguminosae", "بقوليات")
    n_factor = 1.08 if (is_legume and soil_n_ppm < 40) else 0.96

    combined_prob = (0.45 * ll_temp + 0.40 * ll_moisture + 0.15 * ll_ph) * n_factor
    return round(min(99.4, max(12.0, combined_prob * 100.0)), 1)


def compute_hybrid_plan_score(rule_score: float, crop_ml_probs: list[float], use_ml_blend: bool = True) -> dict[str, any]:
    """
    Combines deterministic Rule-Based MCDA score (75% weight) with ML Recommender probability (25% weight).
    """
    ml_plan_prob = round(sum(crop_ml_probs) / max(1, len(crop_ml_probs)), 1)
    norm_rule = rule_score * 100.0 if rule_score <= 1.0 else rule_score
    if use_ml_blend:
        final_score = round(0.75 * norm_rule + 0.25 * ml_plan_prob, 1)
    else:
        final_score = round(norm_rule, 1)

    return {
        "rule_based_score": round(norm_rule, 1),
        "ml_confidence_pct": ml_plan_prob,
        "final_hybrid_score": final_score,
        "scoring_mode": "Hybrid (Rule-Based + ML)" if use_ml_blend else "Rule-Based Only",
    }
