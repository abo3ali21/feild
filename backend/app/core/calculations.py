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
