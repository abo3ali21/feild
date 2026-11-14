"use client";

import React from "react";
import { FlaskConical, Layers3, Sprout, TestTube2, Wifi, AlertCircle } from "lucide-react";
import { useLang, Ltr } from "@/app/lang";
import { EnvironmentalContext } from "@/lib/types";
import { SOIL_TEXTURES } from "@/app/i18n";

type SoilDashboardProps = {
  context: EnvironmentalContext;
  hardwareMoisture?: number | null;
  inferredSoilTexture?: string;
};

export function SoilDashboard({ context, hardwareMoisture, inferredSoilTexture }: SoilDashboardProps) {
  const { lang, t, num } = useLang();
  const f = (v: number, digits?: number) =>
    lang === "ar" ? num(v, digits) : digits === undefined ? String(v) : v.toFixed(digits);

  const titleCase = (value: string) =>
    value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  const soilTextureDisplay =
    lang === "ar"
      ? SOIL_TEXTURES[context.soil_texture]?.ar ?? titleCase(context.soil_texture)
      : titleCase(context.soil_texture);

  const isOverride = context.soil_texture_source === "OVERRIDE";
  
  // Live hardware moisture check: either from explicit prop or from context
  const liveMoisture = hardwareMoisture ?? (
    context.soil_moisture_index !== null && context.soil_moisture_index !== undefined
      ? context.soil_moisture_index * 100
      : null
  );
  const isSensorActive = liveMoisture !== null;

  return (
    <div className="soil-dashboard" style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "6px", color: "#143626" }}>
          <Layers3 size={18} />
          {lang === "ar" ? "خصائص التربة والمادة العضوية (ISRIC SoilGrids)" : "Edaphic & Soil Health Profile"}
        </h3>
        <div style={{ display: "flex", gap: "6px" }}>
          {isOverride && (
            <span className="status-pill online" style={{ fontSize: "0.75rem", background: "rgba(234, 138, 0, 0.15)", color: "#b45309" }}>
              {lang === "ar" ? "تجاوز يدوي من المستخدم" : "Manual User Override"}
            </span>
          )}
          {isSensorActive ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {lang === "ar" ? "حساس ESP32 متصل ومُعاير" : "ESP32 Sensor Active"}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#D6D2C4] bg-white px-2.5 py-0.5 text-[11px] text-[#617069]">
              <Wifi size={12} /> {lang === "ar" ? "تقدير قمر صناعي" : "Satellite baseline"}
            </span>
          )}
        </div>
      </div>

      <section className="environment-grid">
        <article className="metric">
          <span><Layers3 /></span>
          <div>
            <small>{t.results.metrics.soilCondition}</small>
            <strong>{soilTextureDisplay}</strong>
            <p>
              {isOverride
                ? lang === "ar"
                  ? "تم تحديد نوع القوام يدوياً من المزارع"
                  : "Explicitly specified by user override"
                : lang === "ar"
                ? "مستنتج من عمق 0-30 سم عبر ISRIC SoilGrids"
                : "Derived from ISRIC SoilGrids 0–30cm depth"}
            </p>
          </div>
        </article>

        <article className="metric">
          <span><FlaskConical /></span>
          <div>
            <small>{lang === "ar" ? "درجة حموضة التربة (pH)" : "Soil Reaction (pH)"}</small>
            <strong>
              <Ltr>pH {f(context.soil_ph, 1)}</Ltr>
            </strong>
            <p>
              {context.soil_ph < 6.0
                ? lang === "ar"
                  ? "تربة حمضية (قد تحتاج معاملة كلسية)"
                  : "Acidic reaction (may limit alkaline-loving crops)"
                : context.soil_ph > 8.0
                ? lang === "ar"
                  ? "تربة قلوية جيرية (تثبت بعض العناصر الصغرى)"
                  : "Alkaline / calcareous (favors tolerant crops)"
                : lang === "ar"
                ? "نطاق مثالي لأغلب المحاصيل الحقلية"
                : "Optimal range for most agronomic crops"}
            </p>
          </div>
        </article>

        <article className="metric">
          <span><Sprout /></span>
          <div>
            <small>{lang === "ar" ? "المادة العضوية (SOM %)" : "Soil Organic Matter (SOM)"}</small>
            <strong>
              <Ltr>{f(context.soil_organic_matter_pct, 1)}%</Ltr>
            </strong>
            <p>
              {lang === "ar"
                ? "محسوبة بمعامل فان بميلين (SOC × 1.724)"
                : "Standard Van Bemmelen formula (SOC × 1.724)"}
            </p>
          </div>
        </article>

        <article className="metric">
          <span><TestTube2 /></span>
          <div>
            <small>{lang === "ar" ? "رطوبة منطقة الجذور الحقلية" : "Root Zone Moisture"}</small>
            <strong>
              {isSensorActive ? (
                <span className="text-emerald-800 font-semibold text-lg">
                  {liveMoisture.toFixed(1)}%{" "}
                  <span className="text-xs font-normal text-emerald-700">
                    ({lang === "ar" ? "قراءة ESP32 حية" : "Live ESP32 telemetry"})
                  </span>
                </span>
              ) : (
                lang === "ar" ? "تقدير إقليمي (NASA)" : "Regional Baseline (NASA)"
              )}
            </strong>
            <p>
              {isSensorActive ? (
                lang === "ar" ? (
                  `القوام المستنتج من الحساس: ${inferredSoilTexture || soilTextureDisplay}`
                ) : (
                  `Inferred texture response: ${inferredSoilTexture || soilTextureDisplay}`
                )
              ) : (
                <span className="inline-flex items-center gap-1 text-[#8b5cf6]/80 text-[11px] font-medium text-stone-500">
                  <AlertCircle size={12} className="text-stone-400" />
                  {lang === "ar"
                    ? "قم بتوصيل وحدة ESP32 للمعايرة الحقلية المباشرة"
                    : "Connect ESP32 station for direct in-situ calibration"}
                </span>
              )}
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
