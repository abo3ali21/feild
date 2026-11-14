"use client";

import React from "react";
import { ChevronLeft, ChevronRight, Leaf, Sparkles, TriangleAlert } from "lucide-react";
import { useLang } from "@/app/lang";
import { Rotation } from "@/lib/types";
import { CROPS, WARNING_LABELS, translateExplanation } from "@/app/i18n";

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
              <strong style={{ display: "flex", alignItems: "center", gap: "5px", color: "#143626" }}>
                <Sparkles size={14} className="text-[#a96143]" />
                {t.results.why}
              </strong>
              <ul>
                {rotation.explanations.slice(0, 2).map((item) => (
                  <li key={item}>{translateExplanation(item, lang)}</li>
                ))}
              </ul>
            </div>

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
            <div>
              <span>{t.results.dimensions.climate}</span>
              <strong>{rotation.scores.climate}</strong>
              <div className="bar">
                <i style={{ width: `${rotation.scores.climate}%` }} />
              </div>
            </div>
            <div>
              <span>{t.results.dimensions.water}</span>
              <strong>{rotation.scores.water}</strong>
              <div className="bar">
                <i style={{ width: `${rotation.scores.water}%` }} />
              </div>
            </div>
            <div>
              <span>{t.results.dimensions.soil}</span>
              <strong>{rotation.scores.soil}</strong>
              <div className="bar">
                <i style={{ width: `${rotation.scores.soil}%` }} />
              </div>
            </div>
            <div>
              <span>{t.results.dimensions.diversity}</span>
              <strong>{rotation.scores.diversity}</strong>
              <div className="bar">
                <i style={{ width: `${rotation.scores.diversity}%` }} />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
