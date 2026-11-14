"use client";

import React from "react";
import { AlertCircle, Scale } from "lucide-react";
import { useLang } from "@/app/lang";
import { Decision } from "@/lib/types";

type FactorBreakdownProps = {
  rejectedExamples?: Decision[];
  priority: string;
};

function humanizeRejection(item: Decision, lang: "ar" | "en"): string {
  const reason = item.reason || "";
  const rule = item.rule || "";

  // 1. Soil pH
  if (rule === "SOIL_PH") {
    const phMatch = reason.match(/pH\s*([\d.]+)/i);
    const phVal = phMatch ? phMatch[1] : "7.8";
    if (reason.toLowerCase().includes("potato")) {
      return lang === "ar"
        ? `البطاطس غير مناسبة لأن قلوية التربة (pH ${phVal}) أعلى من الحد المثالي لها.`
        : `Potato is unsuitable because soil alkalinity (pH ${phVal}) exceeds its optimal range.`;
    }
    return lang === "ar"
      ? `بعض المحاصيل غير مناسبة لأن قلوية التربة (pH ${phVal}) أعلى من الحد المثالي لها.`
      : `Some crops were excluded because soil alkalinity (pH ${phVal}) exceeds their optimal range.`;
  }

  // 2. Extreme Heat
  if (rule === "EXTREME_HEAT") {
    return lang === "ar"
      ? "تم استبعاد المحاصيل الحساسة للحرارة العالية لحماية إنتاجيتك في هذا المناخ."
      : "Heat-sensitive crops were filtered out to protect your seasonal yield in this climate.";
  }

  // 3. Critical Water
  if (rule === "CRITICAL_WATER") {
    return lang === "ar"
      ? "تم استبعاد المحاصيل ذات الاحتياج المائي المرتفع لتفادي إجهاد التربة وشح المياه."
      : "High-water demand crops were excluded to safeguard your water budget.";
  }

  // 4. Irrigation Required
  if (rule === "IRRIGATION_REQUIRED") {
    return lang === "ar"
      ? "تم استبعاد المحاصيل التي تتطلب رياً مستمراً نظراً لعدم توفر مصدر ري كافٍ."
      : "Crops requiring intensive irrigation were excluded under current water supply.";
  }

  // 5. Minimum GDD
  if (rule === "MINIMUM_GDD") {
    return lang === "ar"
      ? "تم استبعاد المحاصيل التي تتطلب وحدات حرارية تراكمية أطول من موسم الزراعة المتاح."
      : "Crops needing longer thermal heat accumulation than available this season were filtered out.";
  }

  // 6. Family Break
  if (rule === "FAMILY_BREAK") {
    return lang === "ar"
      ? "تم استبعاد تكرار المحاصيل من نفس الفصيلة لمنع انتشار الآفات واستنزاف العناصر الغذائية."
      : "Crops from the same botanical family were separated to prevent pest build-up.";
  }

  // Fallback without bracketed technical tags
  return reason.replace(/^\[[A-Z_]+\]:?\s*/i, "");
}

export function FactorBreakdown({
  rejectedExamples = [],
  priority,
}: FactorBreakdownProps) {
  const { lang, t } = useLang();

  const weights: Record<string, { climate: number; water: number; soil: number; diversity: number }> = {
    profit: { climate: 20, water: 15, soil: 20, diversity: 45 },
    soil: { climate: 15, water: 15, soil: 50, diversity: 20 },
    water: { climate: 20, water: 50, soil: 15, diversity: 15 },
    balanced: { climate: 30, water: 30, soil: 25, diversity: 15 },
    drought_resilience: { climate: 25, water: 45, soil: 20, diversity: 10 },
    soil_recovery: { climate: 20, water: 20, soil: 45, diversity: 15 },
    crop_diversity: { climate: 20, water: 20, soil: 20, diversity: 40 },
  };

  const activeWeight = weights[priority] ?? weights.balanced;
  const dimensionKeys = ["climate", "water", "soil", "diversity"] as const;

  return (
    <div className="factor-breakdown" style={{ margin: "1.5rem 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "6px", color: "#143626" }}>
          <Scale size={18} />
          {lang === "ar" ? "أوزان التقييم متعدد المعايير (MCDA) والمفاضلة" : "MCDA Weighting & Trade-off Analysis"}
        </h3>
        <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted, #64748b)" }}>
          {lang === "ar" ? "أوزان الأولوية المحددة" : "Active Profile Weights"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {dimensionKeys.map((key) => (
          <div
            key={key}
            style={{
              padding: "0.75rem",
              borderRadius: "8px",
              background: "var(--surface-sunken, #f8fafc)",
              border: "1px solid var(--border-subtle, #e2e8f0)",
              textAlign: "center",
            }}
          >
            <small style={{ color: "var(--foreground-muted, #64748b)", display: "block" }}>
              {t.results.dimensions[key]}
            </small>
            <strong style={{ fontSize: "1.2rem", color: "var(--primary, #15803d)" }}>
              {activeWeight[key]}%
            </strong>
          </div>
        ))}
      </div>

      {rejectedExamples.length > 0 && (
        <div className="bg-[#FEF3C7]/60 border border-[#D97706]/30 text-[#143626] rounded-2xl p-4 mt-4 shadow-xs">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={18} className="text-[#D97706] shrink-0" />
            <strong className="text-sm font-semibold text-[#143626]">
              {lang === "ar" ? "محاصيل تم استبعادها لعدم ملاءمتها لأرضك" : "Crops Filtered Out for Your Farm"}
            </strong>
          </div>
          <ul className="m-0 ps-5 text-xs text-[#5C665E] space-y-1.5 list-disc">
            {rejectedExamples.map((item, idx) => (
              <li key={idx} className="leading-relaxed">
                {humanizeRejection(item, lang)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
