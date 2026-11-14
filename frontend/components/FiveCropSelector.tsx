"use client";

import React from "react";
import { Check, AlertTriangle, ArrowRight, RefreshCw, Sprout, Sparkles } from "lucide-react";

export type FiveCropEvaluation = {
  compatible: boolean;
  warning_ar: string;
  top_3_rotations: {
    sequence_ids: string[];
    sequence_names_ar: string[];
    sequence_names_en: string[];
    score: number;
    is_viable: boolean;
    reasons_ar: string[];
  }[];
  suggested_alternatives: {
    replace_ar: string;
    with_ar: string;
    with_id: string;
    reason_ar: string;
  }[];
};

export const AVAILABLE_FIVE_CROPS = [
  { id: "wheat", name_ar: "قمح بلدي", name_en: "Wheat", family: "poaceae", is_legume: false, water: "متوسط (450 mm)", season: "شتوي" },
  { id: "berseem", name_ar: "برسيم مصري", name_en: "Berseem Clover", family: "fabaceae", is_legume: true, water: "متوسط (480 mm)", season: "شتوي" },
  { id: "fava_bean", name_ar: "فول بلدي", name_en: "Fava Bean", family: "fabaceae", is_legume: true, water: "منخفض (320 mm)", season: "شتوي" },
  { id: "maize", name_ar: "ذرة شامية", name_en: "Maize", family: "poaceae", is_legume: false, water: "متوسط (450 mm)", season: "صيفي" },
  { id: "soybean", name_ar: "فول صويا", name_en: "Soybean", family: "fabaceae", is_legume: true, water: "متوسط (450 mm)", season: "صيفي" },
  { id: "potato", name_ar: "بطاطس", name_en: "Potato", family: "solanaceae", is_legume: false, water: "مرتفع (500 mm)", season: "شتوي / صيفي" },
  { id: "tomato", name_ar: "طماطم", name_en: "Tomato", family: "solanaceae", is_legume: false, water: "مرتفع (450 mm)", season: "متعدد العروات" },
  { id: "sorghum", name_ar: "ذرة رفيعة", name_en: "Sorghum", family: "poaceae", is_legume: false, water: "منخفض (300 mm)", season: "صيفي متحمل للحرارة" },
  { id: "pearl_millet", name_ar: "دخن لؤلؤي", name_en: "Pearl Millet", family: "poaceae", is_legume: false, water: "منخفض جداً (250 mm)", season: "صيفي قاحل" },
  { id: "sunflower", name_ar: "عباد الشمس", name_en: "Sunflower", family: "asteraceae", is_legume: false, water: "متوسط (350 mm)", season: "صيفي" },
  { id: "cotton", name_ar: "قطن مصري", name_en: "Egyptian Cotton", family: "malvaceae", is_legume: false, water: "مرتفع (500 mm)", season: "صيفي نقدي" },
  { id: "barley", name_ar: "شعير", name_en: "Barley", family: "poaceae", is_legume: false, water: "منخفض (300 mm)", season: "شتوي متحمل للملوحة" },
  { id: "sweet_potato", name_ar: "بطاطا حلوة", name_en: "Sweet Potato", family: "convolvulaceae", is_legume: false, water: "متوسط (400 mm)", season: "صيفي" },
];

type Props = {
  selectedCrops: string[];
  onChangeSelected: (crops: string[]) => void;
  lang: "ar" | "en";
  results: FiveCropEvaluation | null;
  isEvaluating: boolean;
  onEvaluate: () => void;
  onApplyAlternative: (replaceId: string, withId: string) => void;
};

export function FiveCropSelector({
  selectedCrops,
  onChangeSelected,
  lang,
  results,
  isEvaluating,
  onEvaluate,
  onApplyAlternative,
}: Props) {
  const isAr = lang === "ar";

  const toggleCrop = (id: string) => {
    if (selectedCrops.includes(id)) {
      onChangeSelected(selectedCrops.filter((c) => c !== id));
    } else {
      if (selectedCrops.length < 5) {
        onChangeSelected([...selectedCrops, id]);
      }
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Intro Box */}
      <div
        style={{
          background: "rgba(36, 92, 73, 0.06)",
          border: "1px solid rgba(36, 92, 73, 0.18)",
          borderRadius: "10px",
          padding: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <strong style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--forest)", fontSize: "0.95rem" }}>
            <Sparkles size={18} style={{ color: "var(--forest-2)" }} />
            {isAr ? "محدد الـ 5 محاصيل لمزرعتك" : "5-Crop Rotation Planner"}
          </strong>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "999px",
              background: selectedCrops.length === 5 ? "var(--forest)" : "#e2e8f0",
              color: selectedCrops.length === 5 ? "#ffffff" : "#475569",
              fontSize: "0.78rem",
              fontWeight: 700,
            }}
          >
            {isAr
              ? `المحاصيل المختارة: ${selectedCrops.length} من 5`
              : `Selected Crops: ${selectedCrops.length} of 5`}
          </span>
        </div>
        <p style={{ margin: "6px 0 0", fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.5 }}>
          {isAr
            ? "اختر 5 محاصيل تخطط لزراعتها في مزرعتك. سيقوم المحرك الحسابي بتحليل التوافق الزراعي والبيئي واقتراح أفضل 3 دورات ثلاثية السنوات مع بدائل علاجية إن وُجد تعارض."
            : "Select 5 crops for your farm. The engine will evaluate agronomic & environmental compatibility, predicting the top 3 three-year rotations with alternative suggestions if any constraints clash."}
        </p>
      </div>

      {/* Crops Selection Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
          gap: "8px",
        }}
      >
        {AVAILABLE_FIVE_CROPS.map((crop) => {
          const isSelected = selectedCrops.includes(crop.id);
          const isDisabled = !isSelected && selectedCrops.length >= 5;

          return (
            <button
              key={crop.id}
              type="button"
              onClick={() => toggleCrop(crop.id)}
              disabled={isDisabled}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "8px 10px",
                borderRadius: "8px",
                border: isSelected
                  ? "2px solid var(--forest)"
                  : "1px solid var(--line)",
                background: isSelected ? "rgba(21, 61, 50, 0.08)" : isDisabled ? "#f8fafc" : "#ffffff",
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? "not-allowed" : "pointer",
                textAlign: "start",
                position: "relative",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "var(--ink)" }}>
                  {isAr ? crop.name_ar : crop.name_en}
                </span>
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "4px",
                    border: isSelected ? "none" : "1px solid #cbd5e1",
                    background: isSelected ? "var(--forest)" : "transparent",
                    display: "grid",
                    placeItems: "center",
                    color: "white",
                  }}
                >
                  {isSelected && <Check size={12} />}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                <span
                  style={{
                    fontSize: "0.65rem",
                    padding: "1px 5px",
                    borderRadius: "4px",
                    background: crop.is_legume ? "#e0f2fe" : "#f1f5f9",
                    color: crop.is_legume ? "#0369a1" : "#475569",
                    fontWeight: 600,
                  }}
                >
                  {crop.is_legume ? (isAr ? "بقولي (مثبت)" : "Legume") : crop.family}
                </span>
                <span
                  style={{
                    fontSize: "0.62rem",
                    padding: "1px 4px",
                    borderRadius: "4px",
                    background: "#fef3c7",
                    color: "#92400e",
                  }}
                >
                  {crop.season}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Evaluate Button */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button
          type="button"
          onClick={onEvaluate}
          disabled={selectedCrops.length !== 5 || isEvaluating}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "0.65rem 1.4rem",
            borderRadius: "8px",
            background: selectedCrops.length === 5 ? "var(--forest)" : "#94a3b8",
            color: "#ffffff",
            fontSize: "0.9rem",
            fontWeight: 700,
            border: "none",
            cursor: selectedCrops.length === 5 && !isEvaluating ? "pointer" : "not-allowed",
            boxShadow: selectedCrops.length === 5 ? "0 4px 12px rgba(21, 61, 50, 0.25)" : "none",
            transition: "all 0.2s ease",
          }}
        >
          {isEvaluating ? (
            <>
              <RefreshCw size={17} className="animate-spin" />
              <span>{isAr ? "جاري تقييم التوافق..." : "Evaluating Rotations..."}</span>
            </>
          ) : (
            <>
              <Sprout size={17} />
              <span>
                {isAr
                  ? `استخراج أفضل 3 دورات زراعية (${selectedCrops.length}/5)`
                  : `Generate Top 3 Rotations (${selectedCrops.length}/5)`}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Evaluation Results */}
      {results && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "0.5rem" }}>
          {/* Compatibility Banner */}
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: results.compatible ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: results.compatible ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(239, 68, 68, 0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              fontSize: "0.84rem",
              color: results.compatible ? "#065f46" : "#991b1b",
            }}
          >
            {results.compatible ? (
              <Check size={18} style={{ color: "#10b981", flexShrink: 0, marginTop: "2px" }} />
            ) : (
              <AlertTriangle size={18} style={{ color: "#ef4444", flexShrink: 0, marginTop: "2px" }} />
            )}
            <div>
              <strong>
                {results.compatible
                  ? isAr
                    ? "تطابق زراعي وبيئي ناجح!"
                    : "Successful Agronomic Match!"
                  : isAr
                  ? "تحذير تعارض في المحاصيل المختارة"
                  : "Agronomic Conflict Warning"}
              </strong>
              <p style={{ margin: "3px 0 0", lineHeight: 1.45 }}>{results.warning_ar}</p>
            </div>
          </div>

          {/* Suggested Alternatives if Incompatible */}
          {!results.compatible && results.suggested_alternatives && results.suggested_alternatives.length > 0 && (
            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "8px",
                padding: "12px",
              }}
            >
              <strong style={{ display: "block", color: "#92400e", fontSize: "0.85rem", marginBottom: "8px" }}>
                {isAr ? "💡 البدائل المقترحة لعلاج التعارض الزراعي:" : "💡 Recommended Alternatives to Resolve Conflicts:"}
              </strong>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {results.suggested_alternatives.map((alt, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #fef3c7",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "6px",
                      fontSize: "0.8rem",
                    }}
                  >
                    <div>
                      <span style={{ color: "#b91c1c", fontWeight: 700 }}>{alt.replace_ar}</span>
                      <ArrowRight size={13} style={{ margin: "0 6px", display: "inline-block", verticalAlign: "middle" }} />
                      <span style={{ color: "#047857", fontWeight: 700 }}>{alt.with_ar}</span>
                      <p style={{ margin: "2px 0 0", color: "#6b7280", fontSize: "0.74rem" }}>{alt.reason_ar}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onApplyAlternative(alt.replace_ar, alt.with_id)}
                      style={{
                        padding: "3px 9px",
                        borderRadius: "5px",
                        background: "rgba(16, 185, 129, 0.15)",
                        border: "1px solid rgba(16, 185, 129, 0.4)",
                        color: "#065f46",
                        fontWeight: 700,
                        fontSize: "0.74rem",
                        cursor: "pointer",
                      }}
                    >
                      {isAr ? "تطبيق الاستبدال فوراً" : "Apply Swap"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top 3 Rotations Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--forest-2)" }}>
              {isAr ? "أفضل 3 دورات زراعية ثلاثية متوافقة:" : "Top 3 Viable 3-Year Rotations:"}
            </span>

            {results.top_3_rotations.map((plan, index) => (
              <div
                key={index}
                style={{
                  background: "#ffffff",
                  border: plan.is_viable ? "1px solid #cbd5e1" : "1px solid #fca5a5",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "var(--forest)",
                        color: "white",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {index + 1}
                    </span>
                    <strong style={{ fontSize: "0.92rem", color: "var(--ink)" }}>
                      {isAr ? `الدورة الزراعية #${index + 1}` : `Rotation Plan #${index + 1}`}
                    </strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "4px",
                        background: plan.is_viable ? "#dcfce7" : "#fee2e2",
                        color: plan.is_viable ? "#15803d" : "#b91c1c",
                      }}
                    >
                      {plan.is_viable ? (isAr ? "متوافقة زراعياً" : "Viable") : (isAr ? "تحتاج تعديل" : "Needs Review")}
                    </span>
                    <span
                      style={{
                        fontSize: "0.88rem",
                        fontWeight: 800,
                        color: "var(--forest)",
                      }}
                    >
                      {plan.score.toFixed(1)} / 100
                    </span>
                  </div>
                </div>

                {/* 3 Years Sequence Badges */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "8px",
                    background: "#f8fafc",
                    padding: "8px",
                    borderRadius: "6px",
                  }}
                >
                  {(isAr ? plan.sequence_names_ar : plan.sequence_names_en).map((name, yearIdx) => (
                    <div key={yearIdx} style={{ textAlign: "center" }}>
                      <span style={{ display: "block", fontSize: "0.64rem", color: "var(--muted)", textTransform: "uppercase" }}>
                        {isAr ? `السنة ${yearIdx + 1}` : `Year ${yearIdx + 1}`}
                      </span>
                      <strong style={{ display: "block", fontSize: "0.84rem", color: "var(--forest)", marginTop: "2px" }}>
                        {name}
                      </strong>
                    </div>
                  ))}
                </div>

                {/* Reasons / Agronomic Rationale */}
                {plan.reasons_ar && plan.reasons_ar.length > 0 && (
                  <div style={{ fontSize: "0.74rem", color: "#475569", lineHeight: 1.45 }}>
                    {plan.reasons_ar.map((r, rIdx) => (
                      <div key={rIdx} style={{ marginTop: "2px" }}>
                        {r}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
