"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Leaf, Sparkles, TriangleAlert } from "lucide-react";
import { useLang } from "@/app/lang";
import { Rotation } from "@/lib/types";
import { CROPS, WARNING_LABELS, translateExplanation, translateFactor } from "@/app/i18n";

type RotationCardsProps = {
  rotations: Rotation[];
};

export function RotationCards({ rotations }: RotationCardsProps) {
  const { lang, t, dir } = useLang();

  const cropName = (crop: { crop_id: string; name: string }) => {
    return CROPS[crop.crop_id]?.[lang] ?? crop.name;
  };

  const NextIcon = () => (dir === "rtl" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />);

  return (
    <div className="rotation-list">
      {rotations.map((rotation) => (
        <article className="rotation-card" key={rotation.rank}>
          <div className="rank-col">
            <span>{t.results.rank}</span>
            <strong>0{rotation.rank}</strong>
            <div className="overall-ring" style={{ "--score": rotation.scores.overall } as React.CSSProperties}>
              <b>{rotation.scores.overall}</b>
              <small>/ 100</small>
            </div>
          </div>

          <div className="rotation-main">
            <div className="rotation-head">
              <div>
                <span className="step-label">{t.results.sequence}</span>
                <h3>{rotation.sequence.map((crop) => cropName(crop)).join(lang === "ar" ? " ← " : " → ")}</h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                {rotation.rank === 1 && (
                  <span className="best-fit">
                    <Leaf size={14} /> {t.results.strongestFit}
                  </span>
                )}
                {rotation.ml_confidence_pct !== undefined && rotation.ml_confidence_pct !== null && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: "rgba(147, 51, 234, 0.12)",
                      border: "1px solid rgba(147, 51, 234, 0.3)",
                      color: "#9333ea",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                    }}
                  >
                    <Sparkles size={12} />
                    {lang === "ar" ? `ثقة ML: ${rotation.ml_confidence_pct}%` : `ML Confidence: ${rotation.ml_confidence_pct}%`}
                  </span>
                )}
              </div>
            </div>

            <div className="timeline">
              {rotation.sequence.map((crop, index) => (
                <div key={crop.crop_id}>
                  <span>{t.results.year} 0{crop.year}</span>
                  <strong>{cropName(crop)}</strong>
                  {index < 2 && <NextIcon />}
                </div>
              ))}
            </div>

            <div className="why">
              <strong style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <Sparkles size={14} />
                {t.results.why}
              </strong>
              <ul>
                {rotation.explanations.map((item) => (
                  <li key={item}>{translateExplanation(item, lang)}</li>
                ))}
              </ul>
            </div>

            {rotation.factors && (
              <div className="factor-evidence-pills" style={{ display: "flex", flexWrap: "wrap", gap: "6px", margin: "8px 0" }}>
                {Object.entries(rotation.factors).flatMap(([dimension, list]) =>
                  list.map((factorText) => (
                    <span
                      key={factorText}
                      style={{
                        fontSize: "0.75rem",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        background: "var(--surface-sunken, #f1f5f9)",
                        color: "var(--foreground-muted, #475569)",
                        border: "1px solid var(--border-subtle, #e2e8f0)",
                      }}
                    >
                      <strong>{t.results.dimensions[dimension as keyof typeof t.results.dimensions] ?? dimension}:</strong>{" "}
                      {translateFactor(factorText, lang)}
                    </span>
                  ))
                )}
              </div>
            )}

            {rotation.warnings && rotation.warnings.length > 0 && (
              <div className="warning">
                <TriangleAlert size={16} />
                <span>
                  {WARNING_LABELS[rotation.warnings[0]]?.[lang] ?? rotation.warnings[0]}
                </span>
              </div>
            )}
          </div>

          <div className="score-bars">
            {(["climate", "water", "soil", "diversity"] as const).map((key) => (
              <div key={key}>
                <span>
                  {t.results.dimensions[key]} <b>{rotation.scores[key]}</b>
                </span>
                <i>
                  <em style={{ width: rotation.scores[key] + "%" }} />
                </i>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
