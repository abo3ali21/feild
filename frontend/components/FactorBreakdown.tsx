"use client";

import React from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ListFilter, Scale } from "lucide-react";
import { useLang } from "@/app/lang";
import { Decision, Rotation } from "@/lib/types";

type FactorBreakdownProps = {
  rotations: Rotation[];
  rejectedExamples?: Decision[];
  priority: string;
};

export function FactorBreakdown({
  rotations,
  rejectedExamples = [],
  priority,
}: FactorBreakdownProps) {
  const { lang, t } = useLang();

  const weights: Record<string, { climate: number; water: number; soil: number; diversity: number }> = {
    balanced: { climate: 30, water: 30, soil: 25, diversity: 15 },
    drought_resilience: { climate: 25, water: 45, soil: 20, diversity: 10 },
    soil_recovery: { climate: 20, water: 20, soil: 45, diversity: 15 },
    crop_diversity: { climate: 20, water: 20, soil: 20, diversity: 40 },
  };

  const activeWeight = weights[priority] ?? weights.balanced;

  return (
    <div className="factor-breakdown-section" style={{ marginTop: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
          <Scale size={18} />
          {lang === "ar" ? "أوزان التقييم متعدد المعايير (MCDA) والمفاضلة" : "MCDA Weighting & Trade-off Analysis"}
        </h3>
        <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted, #64748b)" }}>
          {lang === "ar" ? "المجموع = 100%" : "Weights sum to 100%"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginBottom: "1.5rem" }}>
        {(["climate", "water", "soil", "diversity"] as const).map((key) => (
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
        <div className="rejected-crops-card" style={{ padding: "1rem", borderRadius: "10px", background: "rgba(220, 38, 38, 0.04)", border: "1px solid rgba(220, 38, 38, 0.2)", marginTop: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "0.5rem", color: "#b91c1c" }}>
            <AlertCircle size={18} />
            <strong style={{ fontSize: "0.95rem" }}>
              {lang === "ar" ? "محاصيل استُبعدت زراعياً (شروط الفلترة الصارمة)" : "Rejected Crops & Agronomic Constraint Screening"}
            </strong>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--foreground-muted, #64748b)", margin: "0 0 0.5rem 0" }}>
            {lang === "ar"
              ? "استُبعدت هذه المحاصيل تلقائياً لعدم ملاءمتها للمناخ أو قلوية التربة أو نقص المياه لتفادي مخاطر فشل المحصول:"
              : "The following crops failed hard environmental thresholds (e.g. soil pH alkalinity, heat ceiling, or water deficit) to prevent crop failure risk:"}
          </p>
          <ul style={{ margin: 0, paddingInlineStart: "1.2rem", fontSize: "0.85rem", color: "#7f1d1d" }}>
            {rejectedExamples.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "4px" }}>
                <strong>[{item.rule}]:</strong> {item.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
