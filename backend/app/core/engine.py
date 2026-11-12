from __future__ import annotations

import itertools
import json
from functools import lru_cache
from pathlib import Path

from app.core.calculations import clamp, normalize_weights
from app.models.schemas import Crop, Decision, EnvironmentalContext, Priority, Rotation, ScoreSet, SequenceItem

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

WEIGHT_PRESETS = {
    Priority.balanced: {"climate": .30, "water": .30, "soil": .25, "diversity": .15},
    Priority.drought_resilience: {"climate": .25, "water": .45, "soil": .20, "diversity": .10},
    Priority.soil_recovery: {"climate": .20, "water": .20, "soil": .45, "diversity": .15},
    Priority.crop_diversity: {"climate": .20, "water": .20, "soil": .20, "diversity": .40},
}


@lru_cache
def load_crops() -> tuple[Crop, ...]:
    return tuple(Crop.model_validate(item) for item in json.loads((DATA_DIR / "crops.json").read_text()))


@lru_cache
def load_families() -> dict:
    return json.loads((DATA_DIR / "families.json").read_text())


def suitability(crop: Crop, context: EnvironmentalContext, irrigated: bool) -> list[Decision]:
    checks: list[Decision] = []
    checks.append(Decision(
        passed=context.annual_gdd >= crop.minimum_gdd,
        rule="MINIMUM_GDD",
        reason=f"Seasonal heat accumulation is {context.annual_gdd:.0f} GDD; {crop.common_name} needs about {crop.minimum_gdd:.0f} in this reference set.",
    ))
    ph_ok = crop.minimum_ph - .3 <= context.soil_ph <= crop.maximum_ph + .3
    checks.append(Decision(
        passed=ph_ok,
        rule="SOIL_PH",
        reason=f"Estimated pH {context.soil_ph:.1f} is {'within' if ph_ok else 'materially outside'} the configured {crop.minimum_ph:.1f}–{crop.maximum_ph:.1f} range.",
    ))
    effective_water = context.seasonal_rainfall_mm * (1.25 if irrigated else 1)
    water_ok = irrigated or effective_water >= crop.minimum_water_mm * .68
    checks.append(Decision(
        passed=water_ok,
        rule="CRITICAL_WATER",
        reason=f"Available seasonal water ({effective_water:.0f} mm equivalent) is {'adequate' if water_ok else 'critically below'} the conservative threshold for {crop.common_name}.",
    ))
    irrigation_ok = irrigated or not crop.irrigation_required
    checks.append(Decision(
        passed=irrigation_ok,
        rule="IRRIGATION_REQUIRED",
        reason=f"{crop.common_name} {'can be screened as rainfed' if irrigation_ok else 'is treated as irrigation-dependent under these conditions'}.",
    ))
    extreme_heat_limit = 48 if crop.drought_tolerance > .7 else 30
    heat_ok = context.heat_stress_days <= extreme_heat_limit
    checks.append(Decision(
        passed=heat_ok,
        rule="EXTREME_HEAT",
        reason=f"{context.heat_stress_days} repeated heat-threshold exceedance days are {'within' if heat_ok else 'above'} the configured extreme-heat limit ({extreme_heat_limit}).",
    ))
    return checks


def family_break(sequence: tuple[Crop, ...], current: Crop) -> Decision:
    history = [current, *sequence]
    families = load_families()
    for index, crop in enumerate(history):
        break_years = families[crop.family]["minimum_break_years"]
        for later_index in range(index + 1, min(len(history), index + break_years + 1)):
            if history[later_index].family == crop.family:
                return Decision(
                    passed=False,
                    rule="FAMILY_BREAK",
                    reason=f"{crop.common_name} and {history[later_index].common_name} belong to {families[crop.family]['family_name']}; the configured {break_years}-year break has not been met.",
                )
    return Decision(passed=True, rule="FAMILY_BREAK", reason="The sequence respects configured crop-family breaks.")


def score_rotation(sequence: tuple[Crop, ...], context: EnvironmentalContext, irrigated: bool, priority: Priority) -> Rotation:
    climate_parts = [clamp(context.annual_gdd / crop.minimum_gdd) * clamp(1 - max(0, context.heat_stress_days - 8) / (70 if crop.max_temp_c >= 36 else 45)) for crop in sequence]
    climate = sum(climate_parts) / 3

    texture_factor = {"SANDY": .82, "SANDY_LOAM": .90, "LOAM": 1.0, "CLAY_LOAM": .96, "CLAY": .88}.get(context.soil_texture, .90)
    anomaly_factor = clamp(1 + context.precipitation_anomaly_pct / 100)
    water_parts = []
    for crop in sequence:
        supply_ratio = context.seasonal_rainfall_mm / crop.minimum_water_mm
        irrigation_bonus = .16 if irrigated and supply_ratio < 1 else 0
        water_parts.append(clamp(.48 * supply_ratio + .30 * crop.drought_tolerance + .12 * texture_factor + .10 * anomaly_factor + irrigation_bonus))
    water = sum(water_parts) / 3
    if context.soil_moisture_index is not None:
        # Fresh, calibrated on-farm moisture nudges the water dimension within
        # a documented bound; the weighted MCDA structure is unchanged and
        # without sensor data this block never executes.
        from app.services.sensor_context import water_influence
        water = clamp(water * (1 + water_influence() * (context.soil_moisture_index - .5) * 2))

    legume_credit = min(sum(c.nitrogen_credit_kg_ha for c in sequence) / 70, 1)
    removal = sum(c.nitrogen_removal_index for c in sequence) / 3
    residue = sum(c.residue_score for c in sequence) / 3
    root_diversity = len({c.root_depth for c in sequence}) / 3
    ph_compat = sum(1 for c in sequence if c.minimum_ph <= context.soil_ph <= c.maximum_ph) / 3
    organic_need = clamp((2.5 - context.soil_organic_matter_pct) / 2)
    soil = clamp(.26 * legume_credit + .18 * (1 - removal) + .18 * residue + .16 * root_diversity + .14 * ph_compat + .08 * organic_need * (legume_credit + residue) / 2)

    unique_families = len({c.family for c in sequence}) / 3
    roots = len({c.root_depth for c in sequence}) / 3
    diversity = clamp(.68 * unique_families + .22 * roots + .10)

    weights = normalize_weights(WEIGHT_PRESETS[priority])
    overall = sum(weights[key] * value for key, value in {"climate": climate, "water": water, "soil": soil, "diversity": diversity}.items())
    score = ScoreSet(**{key: round(value * 100) for key, value in {
        "overall": overall, "climate": climate, "water": water, "soil": soil, "diversity": diversity
    }.items()})
    explanations = []
    if sum(c.is_legume for c in sequence):
        legumes = ", ".join(c.common_name for c in sequence if c.is_legume)
        explanations.append(f"{legumes} adds a legume phase and can support nitrogen cycling under suitable inoculation and management.")
    if water >= .7:
        explanations.append("The crops are comparatively well matched to the available seasonal water and configured drought tolerance.")
    if len({c.root_depth for c in sequence}) > 1:
        explanations.append("The sequence alternates root architectures, spreading pressure through the soil profile.")
    explanations.append("Crop families are separated according to the configured disease-break rules.")
    return Rotation(
        rank=0,
        sequence=[SequenceItem(year=i + 1, crop_id=c.crop_id, name=c.common_name) for i, c in enumerate(sequence)],
        scores=score,
        explanations=explanations[:3],
        warnings=["Regional observations may not reflect field-level drainage, cultivar choice, pest pressure, or seed availability."],
        factors={
            "climate": [f"Seasonal GDD: {context.annual_gdd:.0f}", f"Heat-stress days: {context.heat_stress_days}"],
            "water": [f"Rainfall: {context.seasonal_rainfall_mm:.0f} mm", f"Anomaly: {context.precipitation_anomaly_pct:+.1f}%"],
            "soil": [f"Legume years: {sum(c.is_legume for c in sequence)}", f"Root profiles: {len({c.root_depth for c in sequence})}"],
            "diversity": [f"Unique families: {len({c.family for c in sequence})}", "Family break passed"],
        },
    )


def rank_rotations(context: EnvironmentalContext, current_crop_id: str, irrigated: bool, priority: Priority) -> tuple[list[Rotation], list[Decision]]:
    crops = load_crops()
    by_id = {crop.crop_id: crop for crop in crops}
    if current_crop_id not in by_id:
        raise ValueError(f"Unknown crop: {current_crop_id}")
    current = by_id[current_crop_id]
    viable: list[Crop] = []
    rejected: list[Decision] = []
    for crop in crops:
        checks = suitability(crop, context, irrigated)
        failures = [check for check in checks if not check.passed]
        if failures:
            rejected.extend(failures[:1])
        else:
            viable.append(crop)

    candidates: list[Rotation] = []
    for sequence in itertools.permutations(viable, 3):
        if not family_break(sequence, current).passed:
            continue
        if len({crop.family for crop in sequence}) < 3:
            continue
        candidates.append(score_rotation(sequence, context, irrigated, priority))

    candidates.sort(key=lambda item: (-item.scores.overall, -item.scores.water, tuple(c.crop_id for c in item.sequence)))
    selected: list[Rotation] = []
    signatures: set[tuple[str, ...]] = set()
    for candidate in candidates:
        family_signature = tuple(by_id[item.crop_id].family for item in candidate.sequence)
        if family_signature in signatures:
            continue
        signatures.add(family_signature)
        candidate.rank = len(selected) + 1
        selected.append(candidate)
        if len(selected) == 3:
            break
    return selected, rejected[:6]
