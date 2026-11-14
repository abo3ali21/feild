"use client";

import React from "react";
import { Database, ShieldCheck } from "lucide-react";
import { useLang } from "@/app/lang";
import { Provenance } from "@/lib/types";
import { PROVENANCE_VARIABLES, SOURCE_LABELS, STATUS_LABELS } from "@/app/i18n";

type DataProvenanceProps = {
  provenance: Provenance[];
};

export function DataProvenance({ provenance }: DataProvenanceProps) {
  const { lang, t } = useLang();

  return (
    <section className="provenance" id="sources">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "1rem" }}>
        <div>
          <span className="step-label">{t.provenance.label}</span>
          <h2>{t.provenance.h1}</h2>
        </div>
        <span style={{ fontSize: "0.8rem", color: "var(--foreground-muted, #64748b)", display: "flex", alignItems: "center", gap: "4px" }}>
          <ShieldCheck size={16} color="#16a34a" />
          {lang === "ar" ? "سجل التتبع والموثوقية العلمية" : "Scientific Traceability & Audit Trail"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", width: "100%" }}>
        {provenance.map((item) => {
          const varLabel =
            lang === "ar"
              ? PROVENANCE_VARIABLES[item.variable]?.ar ?? item.variable.replaceAll("_", " ")
              : item.variable.replaceAll("_", " ");
          const statusLabel =
            STATUS_LABELS[item.status]?.[lang] ?? item.status;
          const sourceLabel =
            SOURCE_LABELS[item.source]?.[lang] ?? item.source;

          return (
            <div
              key={item.variable}
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: "var(--surface-sunken, #f8fafc)",
                border: "1px solid var(--border-subtle, #e2e8f0)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span className={"quality " + item.status.toLowerCase()} style={{ margin: 0 }}>
                  {statusLabel}
                </span>
                {item.unit && (
                  <span style={{ fontSize: "0.75rem", color: "var(--foreground-muted, #64748b)" }}>
                    {item.unit}
                  </span>
                )}
              </div>
              <strong style={{ display: "block", fontSize: "0.95rem", margin: "4px 0", color: "var(--foreground, #0f172a)" }}>
                {sourceLabel}
              </strong>
              <small style={{ color: "var(--foreground-muted, #64748b)", display: "block" }}>
                {varLabel}
              </small>
              {item.observation_period && (
                <small style={{ color: "var(--foreground-muted, #94a3b8)", display: "block", marginTop: "4px", fontSize: "0.75rem" }}>
                  {lang === "ar" ? "الفترة:" : "Period:"} {item.observation_period}
                </small>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
