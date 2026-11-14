"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
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
      <div>
        <span className="step-label">{t.provenance.label}</span>
        <h2>{t.provenance.h1}</h2>
        <span style={{ fontSize: "0.76rem", color: "var(--foreground-muted, #64748b)", display: "flex", alignItems: "center", gap: "5px", marginTop: "12px" }}>
          <ShieldCheck size={16} color="#16a34a" />
          {lang === "ar" ? "سجل التتبع والموثوقية" : "Scientific Traceability"}
        </span>
      </div>

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
          <div key={item.variable}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "4px" }}>
              <span className={"quality " + item.status.toLowerCase()}>{statusLabel}</span>
              {item.unit && (
                <span style={{ fontSize: "0.7rem", color: "var(--foreground-muted, #64748b)" }}>
                  {item.unit}
                </span>
              )}
            </div>
            <strong>{sourceLabel}</strong>
            <small>{varLabel}</small>
            {item.observation_period && (
              <small style={{ color: "var(--foreground-muted, #94a3b8)", fontSize: "0.68rem", marginTop: "4px" }}>
                {lang === "ar" ? "الفترة:" : "Period:"} {item.observation_period}
              </small>
            )}
          </div>
        );
      })}
    </section>
  );
}
