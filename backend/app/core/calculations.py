from __future__ import annotations


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def precipitation_anomaly(current: float, historical: float) -> float:
    if historical <= 0:
        return 0.0
    return ((current - historical) / historical) * 100


def calculate_gdd(tmax: list[float], tmin: list[float], base: float, cutoff: float) -> float:
    if len(tmax) != len(tmin):
        raise ValueError("Temperature series must have the same length")
    return sum(max(0, min((hi + lo) / 2, cutoff) - base) for hi, lo in zip(tmax, tmin))


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
