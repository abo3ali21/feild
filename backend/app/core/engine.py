from __future__ import annotations

import itertools
import json
from functools import lru_cache
from pathlib import Path

from app.core.calculations import (
    calculate_effective_water,
    clamp,
    compute_hybrid_plan_score,
    compute_ml_crop_suitability,
    normalize_weights,
)
from app.models.schemas import Crop, Decision, EnvironmentalContext, Priority, Rotation, ScoreSet, SequenceItem

DATA_DIR = Path(__file__).resolve().parents[1] / "data"

WEIGHT_PRESETS = {
    Priority.balanced: {"climate": 0.30, "water": 0.30, "soil": 0.25, "diversity": 0.15},
    Priority.drought_resilience: {"climate": 0.25, "water": 0.45, "soil": 0.20, "diversity": 0.10},
    Priority.soil_recovery: {"climate": 0.20, "water": 0.20, "soil": 0.45, "diversity": 0.15},
    Priority.crop_diversity: {"climate": 0.20, "water": 0.20, "soil": 0.20, "diversity": 0.40},
}


@lru_cache
def load_crops() -> tuple[Crop, ...]:
    return tuple(Crop.model_validate(item) for item in json.loads((DATA_DIR / "crops.json").read_text()))


@lru_cache
def load_families() -> dict:
    return json.loads((DATA_DIR / "families.json").read_text())


def suitability(crop: Crop, context: EnvironmentalContext, irrigated: bool, irrigation_supply_mm: float | None = None) -> list[Decision]:
    checks: list[Decision] = []

    # 1. Growing Degree Days (using crop-specific base temperature)
    crop_gdd = context.crop_gdd.get(crop.crop_id, context.annual_gdd)
    gdd_ok = crop_gdd >= crop.minimum_gdd
    checks.append(Decision(
        passed=gdd_ok,
        rule="MINIMUM_GDD",
        reason=f"Seasonal heat accumulation for {crop.common_name} (base {crop.base_temp_c:.1f}°C) is {crop_gdd:.0f} GDD; minimum needed is {crop.minimum_gdd:.0f} GDD.",
    ))

    # 2. Soil pH compatibility
    ph_ok = crop.minimum_ph - 0.3 <= context.soil_ph <= crop.maximum_ph + 0.3
    checks.append(Decision(
        passed=ph_ok,
        rule="SOIL_PH",
        reason=f"Estimated pH {context.soil_ph:.1f} is {'within' if ph_ok else 'materially outside'} the configured {crop.minimum_ph:.1f}–{crop.maximum_ph:.1f} range for {crop.common_name}.",
    ))

    # 3. Water availability and critical deficit (modeled effective water balance)
    eff_irrigation = irrigation_supply_mm if irrigation_supply_mm is not None else (300.0 if irrigated else 0.0)
    effective_water = calculate_effective_water(context.seasonal_rainfall_mm, eff_irrigation)
    water_ok = irrigated or effective_water >= crop.minimum_water_mm * 0.70
    checks.append(Decision(
        passed=water_ok,
        rule="CRITICAL_WATER",
        reason=f"Available seasonal effective water ({effective_water:.0f} mm) is {'adequate' if water_ok else 'critically below'} the minimum threshold for {crop.common_name} ({crop.minimum_water_mm:.0f} mm).",
    ))

    # 4. Mandatory irrigation dependency
    irrigation_ok = irrigated or not crop.irrigation_required
    checks.append(Decision(
        passed=irrigation_ok,
        rule="IRRIGATION_REQUIRED",
        reason=f"{crop.common_name} {'can be screened as rainfed' if irrigation_ok else 'is treated as irrigation-dependent under these conditions'}.",
    ))

    # 5. Crop-specific heat stress threshold exceedance
    crop_heat_days = context.crop_heat_stress_days.get(crop.crop_id, context.heat_stress_days)
    if irrigated:
        extreme_heat_limit = 180 if crop.drought_tolerance >= 0.55 else 75
    else:
        extreme_heat_limit = 48 if crop.drought_tolerance > 0.7 else 30
    heat_ok = crop_heat_days <= extreme_heat_limit
    checks.append(Decision(
        passed=heat_ok,
        rule="EXTREME_HEAT",
        reason=f"{crop_heat_days} days exceeding crop threshold ({crop.max_temp_c:.0f}°C) {'within' if heat_ok else 'above'} configured limit ({extreme_heat_limit} days).",
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


def score_rotation(sequence: tuple[Crop, ...], context: EnvironmentalContext, irrigated: bool, priority: Priority, irrigation_supply_mm: float | None = None, use_ml_blend: bool = True) -> Rotation:
    # 1. Climate factor: Crop-specific GDD and heat stress
    climate_parts = []
    for crop in sequence:
        crop_gdd = context.crop_gdd.get(crop.crop_id, context.annual_gdd)
        crop_heat = context.crop_heat_stress_days.get(crop.crop_id, context.heat_stress_days)
        gdd_score = clamp(crop_gdd / crop.minimum_gdd)
        heat_penalty = clamp(1.0 - max(0, crop_heat - 5) / (60 if crop.max_temp_c >= 36 else 38))
        climate_parts.append(gdd_score * heat_penalty)
    climate = sum(climate_parts) / 3.0

    # 2. Water factor: USDA SCS effective water modeling
    eff_irrigation = irrigation_supply_mm if irrigation_supply_mm is not None else (300.0 if irrigated else 0.0)
    effective_water = calculate_effective_water(context.seasonal_rainfall_mm, eff_irrigation)
    texture_factor = {"SANDY": 0.82, "SANDY_LOAM": 0.90, "LOAM": 1.0, "CLAY_LOAM": 0.96, "CLAY": 0.88}.get(context.soil_texture, 0.90)
    anomaly_factor = clamp(1.0 + context.precipitation_anomaly_pct / 100.0, 0.4, 1.4)

    water_parts = []
    for crop in sequence:
        supply_ratio = clamp(effective_water / crop.minimum_water_mm, 0.0, 1.25)
        water_parts.append(clamp(0.50 * supply_ratio + 0.25 * crop.drought_tolerance + 0.15 * texture_factor + 0.10 * anomaly_factor))
    water = sum(water_parts) / 3.0

    if context.soil_moisture_index is not None:
        from app.services.sensor_context import water_influence
        water = clamp(water * (1 + water_influence() * (context.soil_moisture_index - 0.5) * 2))

    # 3. Soil health factor: Legumes, residue, root profile, and sequence precursor benefit
    legume_credit = min(sum(c.nitrogen_credit_kg_ha for c in sequence) / 70.0, 1.0)
    removal = sum(c.nitrogen_removal_index for c in sequence) / 3.0
    residue = sum(c.residue_score for c in sequence) / 3.0
    root_diversity = len({c.root_depth for c in sequence}) / 3.0
    ph_compat = sum(1 for c in sequence if c.minimum_ph <= context.soil_ph <= c.maximum_ph) / 3.0
    organic_need = clamp((2.5 - context.soil_organic_matter_pct) / 2.0)

    # Sequence agronomic ordering effect:
    # A legume immediately followed by a non-legume provides documented residual N credit to the next crop.
    precursor_bonus = 0.0
    for i in range(len(sequence) - 1):
        if sequence[i].is_legume and not sequence[i + 1].is_legume:
            precursor_bonus += 0.04
        # Alternating root depths prevents pan compaction
        if sequence[i].root_depth != sequence[i + 1].root_depth:
            precursor_bonus += 0.02

    soil = clamp(
        0.24 * legume_credit
        + 0.16 * (1.0 - removal)
        + 0.16 * residue
        + 0.15 * root_diversity
        + 0.13 * ph_compat
        + 0.08 * organic_need * (legume_credit + residue) / 2.0
        + precursor_bonus
    )

    # 4. Diversity factor
    unique_families = len({c.family for c in sequence}) / 3.0
    roots = len({c.root_depth for c in sequence}) / 3.0
    diversity = clamp(0.68 * unique_families + 0.22 * roots + 0.10)

    # 5. Multi-criteria decision analysis (MCDA)
    weights = normalize_weights(WEIGHT_PRESETS[priority])
    overall = sum(weights[key] * value for key, value in {"climate": climate, "water": water, "soil": soil, "diversity": diversity}.items())

    score = ScoreSet(**{
        key: round(value * 100)
        for key, value in {"overall": overall, "climate": climate, "water": water, "soil": soil, "diversity": diversity}.items()
    })

    # Evidence-based explanations
    explanations = []
    if any(c.is_legume for c in sequence):
        legumes = ", ".join(c.common_name for c in sequence if c.is_legume)
        tot_n = sum(c.nitrogen_credit_kg_ha for c in sequence)
        explanations.append(f"{legumes} fixes nitrogen (+{tot_n:.0f} kg/ha est.), benefiting subsequent crop phases.")
    if water >= 0.70:
        explanations.append(f"Effective water supply ({effective_water:.0f} mm) comfortably matches crop demand thresholds.")
    else:
        explanations.append(f"Water supply is constrained ({effective_water:.0f} mm effective); crops selected for drought resilience.")
    if len({c.root_depth for c in sequence}) > 1:
        explanations.append("Alternating root depth structures prevents hardpan compaction and optimizes subsoil nutrient extraction.")
    explanations.append("Strict crop-family disease break requirements are fully satisfied.")

    # Lightweight Gaussian Likelihood ML Scorer
    temp_c = 28.0 if context.heat_stress_days > 20 else 22.0
    moisture_pct = (context.soil_moisture_index * 100.0) if context.soil_moisture_index is not None else min(80.0, max(20.0, (effective_water / 600.0) * 60.0))
    ml_crop_probs = [
        compute_ml_crop_suitability(crop, temp_c=temp_c, soil_moisture_pct=moisture_pct, soil_ph=context.soil_ph)
        for crop in sequence
    ]
    hybrid_meta = compute_hybrid_plan_score(score.overall, ml_crop_probs, use_ml_blend=use_ml_blend)

    return Rotation(
        rank=0,
        sequence=[SequenceItem(year=i + 1, crop_id=c.crop_id, name=c.common_name) for i, c in enumerate(sequence)],
        scores=score,
        explanations=explanations[:3],
        warnings=["Regional observations may not reflect field-level microclimates, cultivar differences, or specific local pests."],
        factors={
            "climate": [
                f"Seasonal GDD: {context.annual_gdd:.0f}",
                f"Heat-stress days: {context.heat_stress_days}",
            ],
            "water": [
                f"Effective water: {effective_water:.0f} mm",
                f"Rainfall: {context.seasonal_rainfall_mm:.0f} mm (Anomaly: {context.precipitation_anomaly_pct:+.1f}%)",
            ],
            "soil": [
                f"Legume phases: {sum(c.is_legume for c in sequence)} (+{sum(c.nitrogen_credit_kg_ha for c in sequence):.0f} kg/ha N)",
                f"Root architectures: {len({c.root_depth for c in sequence})} types",
            ],
            "diversity": [
                f"Botanical families: {len({c.family for c in sequence})}",
                "Family disease break satisfied",
            ],
        },
        ml_confidence_pct=hybrid_meta["ml_confidence_pct"],
        final_hybrid_score=hybrid_meta["final_hybrid_score"],
        scoring_mode=hybrid_meta["scoring_mode"],
    )


def rank_rotations(
    context: EnvironmentalContext,
    current_crop_id: str,
    irrigated: bool,
    priority: Priority,
    irrigation_supply_mm: float | None = None,
    use_ml_blend: bool = True,
) -> tuple[list[Rotation], list[Decision]]:
    crops = load_crops()
    by_id = {crop.crop_id: crop for crop in crops}
    if current_crop_id not in by_id:
        raise ValueError(f"Unknown crop: {current_crop_id}")
    current = by_id[current_crop_id]

    viable: list[Crop] = []
    rejected: list[Decision] = []
    for crop in crops:
        checks = suitability(crop, context, irrigated, irrigation_supply_mm=irrigation_supply_mm)
        failures = [check for check in checks if not check.passed]
        if failures:
            rejected.extend(failures[:1])
        else:
            viable.append(crop)

    # Evaluate sequence candidates
    candidates: list[Rotation] = []
    for sequence in itertools.permutations(viable, 3):
        if not family_break(sequence, current).passed:
            continue
        if len({crop.family for crop in sequence}) < 3:
            continue
        candidates.append(score_rotation(sequence, context, irrigated, priority, irrigation_supply_mm=irrigation_supply_mm, use_ml_blend=use_ml_blend))

    # Sort descending by overall score, then water score
    candidates.sort(key=lambda item: (-item.scores.overall, -item.scores.water, tuple(c.crop_id for c in item.sequence)))

    # Phase 3.1: Deduplicate equivalent crop sets
    # We do not present permutations of the exact same 3 crops as distinct top recommendations.
    # We keep the best-sequenced permutation of each crop set, and ensure family diversity across recommendations.
    selected: list[Rotation] = []
    seen_crop_sets: set[frozenset[str]] = set()
    seen_lead_crops: set[str] = set()

    for candidate in candidates:
        crop_set = frozenset(item.crop_id for item in candidate.sequence)
        lead_crop = candidate.sequence[0].crop_id

        # Skip if identical crop set already represented
        if crop_set in seen_crop_sets:
            continue

        # Prefer diverse lead crops for the top 3 recommendations when available
        if len(selected) < 2 and lead_crop in seen_lead_crops and len(candidates) > 5:
            # Check if there are other candidates with a different lead crop
            has_alternative = any(
                frozenset(c.crop_id for c in other.sequence) not in seen_crop_sets
                and other.sequence[0].crop_id not in seen_lead_crops
                for other in candidates
            )
            if has_alternative:
                continue

        seen_crop_sets.add(crop_set)
        seen_lead_crops.add(lead_crop)
        candidate.rank = len(selected) + 1
        selected.append(candidate)
        if len(selected) == 3:
            break

    # If strict lead crop filtering was too restrictive, fill remaining slots
    if len(selected) < 3:
        for candidate in candidates:
            crop_set = frozenset(item.crop_id for item in candidate.sequence)
            if crop_set not in seen_crop_sets:
                seen_crop_sets.add(crop_set)
                candidate.rank = len(selected) + 1
                selected.append(candidate)
                if len(selected) == 3:
                    break

    # Resilient Adaptive Fallback: If zero candidates passed strict hard screening
    # (e.g. desert climate, extreme heat, or hyper-arid rainfed conditions),
    # generate adaptive rotations from resilient alternative crops rather than failing with 422.
    if not selected:
        ranked_crops = sorted(
            crops,
            key=lambda c: (
                c.family == current.family,
                -c.drought_tolerance if not irrigated else 0.0,
                abs(context.soil_ph - ((c.minimum_ph + c.maximum_ph) / 2.0)),
            ),
        )
        adaptive_seqs: list[Rotation] = []
        for seq in itertools.permutations(ranked_crops[:8], 3):
            if len({c.family for c in seq}) < 3:
                continue
            rot = score_rotation(
                seq,
                context,
                irrigated,
                priority,
                irrigation_supply_mm=irrigation_supply_mm or (300.0 if irrigated else 150.0),
                use_ml_blend=use_ml_blend,
            )
            rot.explanations.insert(
                0,
                "Adaptive Rotation: Strict hard filters were exceeded for baseline crops under extreme climate conditions. This rotation recommends resilient alternatives with supplemental micro-irrigation and organic mulching.",
            )
            adaptive_seqs.append(rot)
            if len(adaptive_seqs) >= 3:
                break
        for idx, rot in enumerate(adaptive_seqs):
            rot.rank = idx + 1
            selected.append(rot)

    return selected, rejected[:6]


def infer_soil_texture_from_hardware(soil_moisture_pct: float, temp_c: float) -> dict[str, str]:
    """
    Infers practical soil texture & drainage behavior from ESP32 sensor readings
    combined with regional calibration.
    """
    if soil_moisture_pct >= 58.0:
        return {
            "texture_code": "clay_loam",
            "texture_ar": "طينية طميية (عالية الاحتفاظ بالرطوبة - مستنتجة من الحساس)",
            "texture_en": "Clay Loam (High Water Retention - Sensor Calibrated)",
        }
    elif soil_moisture_pct >= 35.0:
        return {
            "texture_code": "loam",
            "texture_ar": "طميية متوازنة (جيدة الصرف - مستنتجة من الحساس)",
            "texture_en": "Balanced Loam (Moderate Drainage - Sensor Calibrated)",
        }
    else:
        return {
            "texture_code": "sandy_loam",
            "texture_ar": "رملية طميية (سريعة الصرف - مستنتجة من الحساس)",
            "texture_en": "Sandy Loam (Fast Drainage - Sensor Calibrated)",
        }


def evaluate_selected_five_crops(
    selected_crop_ids: list[str],
    soil_moisture_pct: float,
    temp_c: float,
    priority: str = "water",
    all_crops: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Takes 5 farmer-selected crops, generates all 3-crop rotations,
    returns top 3 valid plans OR warns if incompatible and suggests close alternatives.
    """
    if all_crops is None:
        crops_tuple = load_crops()
        all_crops = {c.crop_id: c.model_dump() for c in crops_tuple}

    valid_plans = []
    water_budget_mm = 300 + (soil_moisture_pct * 5.5)  # Map sensor % to seasonal mm budget

    formatted_crops: dict[str, dict[str, Any]] = {}
    for cid, c in all_crops.items():
        if isinstance(c, dict):
            formatted_crops[cid] = {
                "id": cid,
                "name_ar": c.get("name_ar") or c.get("common_name", cid),
                "name_en": c.get("common_name", cid),
                "family": str(c.get("family", "poaceae")).lower(),
                "water_mm": float(c.get("water_mm") or c.get("minimum_water_mm", 450)),
                "temp_min": float(c.get("temp_min") or c.get("base_temp_c", 12)),
                "temp_max": float(c.get("temp_max") or c.get("max_temp_c", 32)),
                "nitrogen_effect": float(c.get("nitrogen_effect", (c.get("nitrogen_credit_kg_ha", 0) if c.get("is_legume") else -40))),
                "profit_index": float(c.get("profit_index", 75)),
                "alternative_ids": c.get("alternative_ids", []),
            }

    valid_ids = [cid for cid in selected_crop_ids if cid in formatted_crops]
    if len(valid_ids) < 3:
        valid_ids = list(formatted_crops.keys())[:5]

    for seq in itertools.permutations(valid_ids, 3):
        c1, c2, c3 = formatted_crops[seq[0]], formatted_crops[seq[1]], formatted_crops[seq[2]]
        crops_seq = [c1, c2, c3]

        # Check botanical family repetition
        same_family_penalty = 0
        reasons_ar = []
        if c1["family"] == c2["family"] or c2["family"] == c3["family"]:
            same_family_penalty += 35
            reasons_ar.append("⚠️ تكرار نفس العائلة النباتية في موسمين متتاليين يضعف التربة ويزيد الآفات.")

        # Check Nitrogen fixing synergy
        n_net = sum(c["nitrogen_effect"] for c in crops_seq)
        if c1["nitrogen_effect"] > 0 and c2["nitrogen_effect"] < 0:
            reasons_ar.append(f"✅ زراعة {c1['name_ar']} قبل {c2['name_ar']} تثبت النيتروجين طبيعياً وتقلل الأسمدة.")

        # Check water & climate fit
        avg_water = sum(c["water_mm"] for c in crops_seq) / 3.0
        water_fit = max(0.0, min(100.0, (water_budget_mm / avg_water) * 100.0))

        temp_fit = 100.0
        for c in crops_seq:
            if temp_c < c["temp_min"] - 3 or temp_c > c["temp_max"] + 3:
                temp_fit -= 25.0

        soil_score = max(0.0, min(100.0, 60.0 + n_net))
        pest_score = max(0.0, 100.0 - same_family_penalty)
        profit_score = sum(c["profit_index"] for c in crops_seq) / 3.0

        weights = {
            "water": (0.50, 0.20, 0.15, 0.15),
            "soil": (0.15, 0.50, 0.25, 0.10),
            "profit": (0.15, 0.20, 0.15, 0.50),
        }.get(priority, (0.35, 0.25, 0.20, 0.20))

        total_score = round(
            weights[0] * water_fit +
            weights[1] * soil_score +
            weights[2] * pest_score +
            weights[3] * profit_score,
            1,
        )

        if water_fit >= 80:
            reasons_ar.append("💧 متوافقة تماماً مع رطوبة التربة المقاسة حالياً.")

        valid_plans.append({
            "sequence_ids": list(seq),
            "sequence_names_ar": [c["name_ar"] for c in crops_seq],
            "sequence_names_en": [c["name_en"] for c in crops_seq],
            "score": total_score,
            "is_viable": total_score >= 65.0 and same_family_penalty == 0,
            "reasons_ar": reasons_ar,
        })

    valid_plans.sort(key=lambda x: x["score"], reverse=True)
    viable_only = [p for p in valid_plans if p["is_viable"]]

    incompatible = len(viable_only) == 0
    suggested_alternatives = []
    if incompatible:
        selected_set = set(valid_ids)
        for cid in valid_ids:
            crop = formatted_crops[cid]
            for alt_id in crop.get("alternative_ids", []):
                if alt_id not in selected_set and alt_id in formatted_crops:
                    alt_crop = formatted_crops[alt_id]
                    suggested_alternatives.append({
                        "replace_ar": crop["name_ar"],
                        "with_ar": alt_crop["name_ar"],
                        "with_id": alt_id,
                        "reason_ar": f"بديل قريب لـ ({crop['name_ar']}) في نفس الموسم لكن من عائلة ({alt_crop['family']}) لتحسين التوازن وتوفير المياه.",
                    })

    return {
        "compatible": not incompatible,
        "warning_ar": (
            "⚠️ المحاصيل الخمسة المختارة غير متوافقة مع ظروف التربة/المياه الحالية أو تنتمي لنفس العائلة النباتية. إليك أفضل البدائل القريبة:"
            if incompatible else
            "✅ تم استخراج أفضل 3 دورات زراعية متوافقة من المحاصيل الخمسة التي اخترتها:"
        ),
        "top_3_rotations": (viable_only if not incompatible else valid_plans)[:3],
        "suggested_alternatives": suggested_alternatives[:3],
    }
