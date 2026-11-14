"use client";

import React from "react";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { useLang } from "@/app/lang";
import { Provenance } from "@/lib/types";
import { PROVENANCE_VARIABLES, SOURCE_LABELS, STATUS_LABELS } from "@/app/i18n";

type DataProvenanceProps = {
  provenance: Provenance[];
  hardwareActive?: boolean;
};

export function DataProvenance({ provenance, hardwareActive }: DataProvenanceProps) {
  const { lang, t } = useLang();

  // If hardware is active, ensure root_zone_moisture provenance reflects live IoT telemetry
  const items = provenance.map((item) => {
    if (hardwareActive && (item.variable === "root_zone_moisture" || item.variable === "soil_moisture")) {
      return {
        ...item,
        status: "LIVE" as const,
        source: lang === "ar" ? "وحدة استشعار ESP32 الحقلية المباشرة" : "ESP32 Live Field Sensor Node",
        unit: "%",
        observation_period: lang === "ar" ? "قراءة حظية مباشرة (Ground-Truth)" : "Real-time telemetry",
      };
    }
    return item;
  });

  const getStatusBadge = (status: string, label: string) => {
    const s = status.toUpperCase();
    if (s === "LIVE") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {label}
        </span>
      );
    }
    if (s === "ESTIMATED") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-200">
          {label}
        </span>
      );
    }
    if (s === "FALLBACK") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-800 border border-orange-200">
          {label}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-semibold text-stone-600 border border-stone-200">
        {label}
      </span>
    );
  };

  return (
    <section className="mt-10 rounded-2xl border border-[#E2DFD5] bg-white p-6 md:p-8 shadow-xs" id="sources">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E2DFD5] pb-5">
        <div>
          <span className="block text-[11px] font-bold uppercase tracking-wider text-[#a96143]">
            {t.provenance.label}
          </span>
          <h2 className="mt-1 font-serif text-2xl md:text-3xl font-semibold text-[#143626]">
            {t.provenance.h1}
          </h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D6D2C4] bg-[#F7F5EE] px-3.5 py-1.5 text-xs font-medium text-[#143626]">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>
            {lang === "ar"
              ? "سجل التتبع والموثوقية العلمية (Audit Trail)"
              : "Scientific Traceability & Audit Trail"}
          </span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((item) => {
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
              className="flex flex-col justify-between rounded-xl border border-[#E2DFD5] bg-[#FDFCF9] p-5 transition hover:border-[#143626]/30 hover:shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  {getStatusBadge(item.status, statusLabel)}
                  {item.unit && (
                    <span className="font-mono text-xs text-stone-500">
                      {item.unit}
                    </span>
                  )}
                </div>
                <strong className="mt-3 block text-base font-semibold text-[#143626]">
                  {sourceLabel}
                </strong>
                <p className="mt-1 text-xs text-stone-600 capitalize">
                  {varLabel}
                </p>
              </div>

              {item.observation_period && (
                <div className="mt-4 pt-3 border-t border-[#E2DFD5]/70 flex items-center gap-1.5 text-[11px] text-stone-400">
                  <CheckCircle2 className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                  <span>
                    {lang === "ar" ? "الفترة:" : "Period:"} {item.observation_period}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
