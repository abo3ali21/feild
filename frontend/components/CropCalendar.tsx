"use client";

import React from "react";
import { Calendar, CheckCircle2 } from "lucide-react";
import { useLang } from "@/app/lang";
import { Rotation } from "@/lib/types";
import { CROPS } from "@/app/i18n";

type CropCalendarProps = {
  rotation: Rotation;
};

export function CropCalendar({ rotation }: CropCalendarProps) {
  const { lang, t } = useLang();

  const cropName = (crop: { crop_id: string; name: string }) => {
    return CROPS[crop.crop_id]?.[lang] ?? crop.name;
  };

  const seasons = [
    { nameEn: "Early Rainfed / Spring", nameAr: "الموسم المبكر / الربيعي", months: "Months 1–4" },
    { nameEn: "Main Season / Summer", nameAr: "الموسم الرئيسي / الصيفي", months: "Months 5–8" },
    { nameEn: "Post-Harvest / Cover Phase", nameAr: "موسم الراحة / تغطية التربة", months: "Months 9–12" },
  ];

  return (
    <div className="crop-calendar-card" style={{ padding: "1rem", borderRadius: "10px", background: "var(--surface-raised, #ffffff)", border: "1px solid var(--border-subtle, #e2e8f0)", marginTop: "1rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "0.75rem" }}>
        <Calendar size={18} color="var(--primary, #15803d)" />
        <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
          {lang === "ar" ? "الجدول الزمني للدورة الزراعية (3 سنوات)" : "3-Year Multi-Season Crop Sequence"}
        </h4>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
        {rotation.sequence.map((crop, idx) => {
          const season = seasons[idx % seasons.length];
          return (
            <div
              key={crop.crop_id}
              style={{
                padding: "0.75rem",
                borderRadius: "8px",
                background: "var(--surface-sunken, #f8fafc)",
                border: "1px solid var(--border-subtle, #e2e8f0)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--foreground-muted, #64748b)" }}>
                <span>{t.results.year} 0{crop.year}</span>
                <span style={{ fontWeight: 600, color: "var(--primary, #15803d)" }}>
                  {lang === "ar" ? season.nameAr : season.nameEn}
                </span>
              </div>
              <strong style={{ display: "block", fontSize: "1.05rem", margin: "4px 0", color: "var(--foreground, #0f172a)" }}>
                {cropName(crop)}
              </strong>
              <div style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: "4px", color: "var(--foreground-muted, #64748b)" }}>
                <CheckCircle2 size={13} color="#16a34a" />
                <span>
                  {idx === 0
                    ? lang === "ar" ? "تأسيس الدورة وكسر دورة الآفات" : "Establishment & pest break"
                    : idx === 1
                    ? lang === "ar" ? "استغلال المادة الغذائية وتعميق الجذور" : "Nutrient cycling & deep rooting"
                    : lang === "ar" ? "تغطية عضوية وحماية التربة من الانجراف" : "Residue retention & soil protection"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
