"use client";

import React from "react";
import { CloudSun, Droplets, Orbit, ThermometerSun } from "lucide-react";
import { useLang, Ltr } from "@/app/lang";
import { EnvironmentalContext } from "@/lib/types";

type ClimateDashboardProps = {
  context: EnvironmentalContext;
};

export function ClimateDashboard({ context }: ClimateDashboardProps) {
  const { lang, t, num } = useLang();

  const signed = (v: number) => {
    const formatted = v.toFixed(1);
    return v > 0 ? "+" + formatted : formatted;
  };

  const humanRain = (value: number) => {
    const m = t.results.metrics;
    return value < -25
      ? m.rainDeficitBig
      : value < -10
      ? m.rainDeficitMod
      : value > 15
      ? m.rainAbove
      : m.rainNear;
  };

  const heatNote =
    context.heat_stress_days > 24
      ? t.results.metrics.highRisk
      : t.results.metrics.withinThreshold;

  const isLive = context.data_quality?.climate === "LIVE";
  const isCached = context.data_quality?.climate === "CACHED";

  return (
    <div className="climate-dashboard" style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "6px" }}>
          <CloudSun size={18} />
          {lang === "ar" ? "المؤشرات المناخية والأرصاد السحابية" : "Agroclimatic & Seasonal Indicators"}
        </h3>
        <span
          className={`status-pill ${isLive ? "online" : isCached ? "online" : "offline"}`}
          style={{ fontSize: "0.75rem" }}
        >
          <i />
          {isLive
            ? lang === "ar"
              ? "ناسا مباشر (NASA POWER)"
              : "NASA POWER Live"
            : isCached
            ? lang === "ar"
              ? "مخزن مؤقتاً (NASA POWER)"
              : "NASA POWER Cached"
            : lang === "ar"
            ? "تقدير إقليمي بديل"
            : "Regional Profile"}
        </span>
      </div>

      <section className="environment-grid">
        <article className="metric">
          <span><Droplets /></span>
          <div>
            <small>{t.results.metrics.rainfall}</small>
            <strong>
              <Ltr>{Number(context.seasonal_rainfall_mm ?? 0).toFixed(1)}</Ltr> {t.results.metrics.mm}
            </strong>
            <p>
              {humanRain(context.precipitation_anomaly_pct)}{" "}
              <Ltr>
                {"· " +
                  (lang === "ar"
                    ? context.precipitation_anomaly_pct > 0
                      ? "+" + num(context.precipitation_anomaly_pct, 1)
                      : num(context.precipitation_anomaly_pct, 1)
                    : signed(context.precipitation_anomaly_pct)) +
                  "%"}
              </Ltr>
            </p>
          </div>
        </article>

        <article className="metric">
          <span><ThermometerSun /></span>
          <div>
            <small>{t.results.metrics.heatStress}</small>
            <strong>
              {Math.round(context.heat_stress_days ?? 0)} {t.results.metrics.heatUnit}
            </strong>
            <p>{heatNote}</p>
          </div>
        </article>

        <article className="metric">
          <span><Orbit /></span>
          <div>
            <small>{t.results.metrics.seasonalHeat}</small>
            <strong>
              {Math.round(context.annual_gdd ?? 0).toLocaleString()} {t.results.metrics.gddUnit}
            </strong>
            <p>{t.results.metrics.gddNote}</p>
          </div>
        </article>

        <article className="metric">
          <span><Droplets /></span>
          <div>
            <small>{lang === "ar" ? "المياه الفعالة المتاحة" : "Effective Water Available"}</small>
            <strong>
              <Ltr>
                {Math.round(
                  context.effective_water_mm ??
                    (context.seasonal_rainfall_mm ? context.seasonal_rainfall_mm * 0.8 : 0)
                )}
              </Ltr>{" "}
              {t.results.metrics.mm}
            </strong>
            <p>
              {context.effective_water_mm && context.effective_water_mm > context.seasonal_rainfall_mm
                ? lang === "ar"
                  ? "تشمل الري التكميلي ومعدل الكفاءة"
                  : "Includes supplemental irrigation & efficiency"
                : lang === "ar"
                ? "محسوبة وفق نموذج USDA SCS للأمطار الفعالة"
                : "USDA SCS effective precipitation model"}
            </p>
          </div>
        </article>
      </section>
    </div>
  );
}
