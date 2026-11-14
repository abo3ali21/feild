"use client";

import React from "react";
import { Check, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";

export interface CropOption {
  id: string;
  name_ar: string;
  name_en: string;
  family: string;
  season: string;
  water_mm: number;
  temp_range: string;
  is_legume: boolean;
}

export const AVAILABLE_FIVE_CROPS: CropOption[] = [
  { id: "wheat", name_ar: "قمح", name_en: "Wheat", family: "Poaceae (نجيلي)", season: "شتوي", water_mm: 450, temp_range: "15-25°C", is_legume: false },
  { id: "berseem", name_ar: "برسيم مصري", name_en: "Egyptian Clover", family: "Fabaceae (بقولي)", season: "شتوي", water_mm: 500, temp_range: "15-28°C", is_legume: true },
  { id: "fava_bean", name_ar: "فول بلدي", name_en: "Fava Bean", family: "Fabaceae (بقولي)", season: "شتوي", water_mm: 400, temp_range: "14-24°C", is_legume: true },
  { id: "maize", name_ar: "ذرة شامية", name_en: "Maize", family: "Poaceae (نجيلي)", season: "صيفي", water_mm: 650, temp_range: "22-34°C", is_legume: false },
  { id: "sorghum", name_ar: "ذرة رفيعة", name_en: "Sorghum", family: "Poaceae (نجيلي)", season: "صيفي", water_mm: 450, temp_range: "24-38°C", is_legume: false },
  { id: "cotton", name_ar: "قطن", name_en: "Cotton", family: "Malvaceae (خبازي)", season: "صيفي", water_mm: 750, temp_range: "25-36°C", is_legume: false },
  { id: "soybean", name_ar: "فول صويا", name_en: "Soybean", family: "Fabaceae (بقولي)", season: "صيفي", water_mm: 500, temp_range: "20-30°C", is_legume: true },
  { id: "sunflower", name_ar: "عباد شمس", name_en: "Sunflower", family: "Asteraceae (مركب)", season: "صيفي/نيلي", water_mm: 450, temp_range: "20-32°C", is_legume: false },
  { id: "potato", name_ar: "بطاطس", name_en: "Potato", family: "Solanaceae (باذنجاني)", season: "شتوي/خريفي", water_mm: 550, temp_range: "16-24°C", is_legume: false },
  { id: "chickpea", name_ar: "حمص", name_en: "Chickpea", family: "Fabaceae (بقولي)", season: "شتوي", water_mm: 350, temp_range: "15-26°C", is_legume: true },
  { id: "barley", name_ar: "شعير", name_en: "Barley", family: "Poaceae (نجيلي)", season: "شتوي", water_mm: 300, temp_range: "12-22°C", is_legume: false },
  { id: "canola", name_ar: "كانولا", name_en: "Canola", family: "Brassicaceae (صليبي)", season: "شتوي", water_mm: 420, temp_range: "14-22°C", is_legume: false },
];

export interface FiveCropEvaluation {
  compatible: boolean;
  warning_ar: string;
  suggested_alternatives?: {
    replace_ar: string;
    with_ar: string;
    with_id: string;
    reason_ar: string;
  }[];
  top_3_rotations: {
    sequence_ids: string[];
    sequence_names_ar: string[];
    sequence_names_en: string[];
    score: number;
    is_viable: boolean;
    reasons_ar: string[];
  }[];
}

interface FiveCropSelectorProps {
  selectedCrops: string[];
  onChangeSelected: React.Dispatch<React.SetStateAction<string[]>>;
  lang: "ar" | "en";
  results: FiveCropEvaluation | null;
  isEvaluating: boolean;
  onEvaluate: () => void;
  onApplyAlternative: (replaceNameOrId: string, withId: string) => void;
}

export function FiveCropSelector({
  selectedCrops,
  onChangeSelected,
  lang,
  results,
  onApplyAlternative,
}: FiveCropSelectorProps) {
  const isAr = lang === "ar";

  const toggleCrop = (id: string) => {
    if (selectedCrops.includes(id)) {
      if (selectedCrops.length > 3) {
        onChangeSelected((prev) => prev.filter((c) => c !== id));
      }
    } else {
      if (selectedCrops.length < 5) {
        onChangeSelected((prev) => [...prev, id]);
      } else {
        onChangeSelected((prev) => [...prev.slice(1), id]);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Step Header & Count Pill */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <span className="block text-xs font-semibold text-[#143626]">
            {isAr
              ? "حدد 5 محاصيل تفضل زراعتها في مزرعتك:"
              : "Select 5 crops suited for your farm:"}
          </span>
          <p className="text-[11px] text-[#5C665E] m-0 mt-0.5">
            {isAr
              ? "سيتم استخراج الدورات الزراعية الثلاثية حصرياً من هذه المحاصيل الخمسة في صفحة النتائج."
              : "Your final multi-year plans will be formed exclusively from these 5 selected crops."}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border transition ${
            selectedCrops.length === 5
              ? "bg-[#143626] text-[#F7F5EE] border-[#143626]"
              : "bg-[#E6ECE8] text-[#143626] border-[#D6D2C4]"
          }`}
        >
          <Sparkles size={13} />
          {isAr
            ? `${selectedCrops.length} من 5 محاصيل مختارة`
            : `${selectedCrops.length} of 5 Selected`}
        </span>
      </div>

      {/* Crop Grid (12 Egyptian & Regional Crops) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {AVAILABLE_FIVE_CROPS.map((crop) => {
          const isSelected = selectedCrops.includes(crop.id);
          return (
            <button
              key={crop.id}
              type="button"
              onClick={() => toggleCrop(crop.id)}
              className={`p-3 rounded-xl border text-start transition cursor-pointer flex flex-col justify-between gap-2 ${
                isSelected
                  ? "bg-[#143626] text-[#F7F5EE] border-[#143626] shadow-xs"
                  : "bg-white text-[#143626] border-[#E2DFD5] hover:border-[#143626]/40"
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-sm">
                  {isAr ? crop.name_ar : crop.name_en}
                </span>
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
                    isSelected
                      ? "bg-white text-[#143626] border-white"
                      : "border-[#D6D2C4]"
                  }`}
                >
                  {isSelected && <Check size={11} strokeWidth={3} />}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-[10px]">
                <span
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    isSelected
                      ? "bg-white/20 text-[#F7F5EE]"
                      : crop.is_legume
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-[#F7F5EE] text-[#5C665E]"
                  }`}
                >
                  {crop.is_legume ? (isAr ? "بقولي (مثبت)" : "Legume") : crop.family.split(" ")[0]}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    isSelected ? "bg-white/15 text-[#F7F5EE]/80" : "bg-[#F7F5EE] text-[#5C665E]"
                  }`}
                >
                  {crop.season}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Conflict / Compatibility Alert with Quick Swap (Rendered ONLY if incompatible) */}
      {results && !results.compatible && results.suggested_alternatives && results.suggested_alternatives.length > 0 && (
        <div className="p-4 rounded-xl border border-[#B45309]/30 bg-[#FEF3C7] text-[#B45309] text-xs">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle size={16} className="text-[#B45309] shrink-0 mt-0.5" />
            <strong className="font-semibold text-sm">
              {isAr ? "تحذير تعارض زراعي في المحاصيل المختارة:" : "Agronomic Constraint Warning:"}
            </strong>
          </div>
          <p className="m-0 mb-3 text-[11px] leading-relaxed text-[#92400e]">
            {isAr
              ? "المحاصيل المختارة تحتاج محصولاً بقولياً إضافياً لكسر الآفات وتجديد نيتروجين التربة. نقترح استبدال أحد المحاصيل بالبدائل التالية:"
              : "The selected set requires an additional nitrogen-fixing legume. Consider applying one of the suggested replacements:"}
          </p>

          <div className="flex flex-col gap-2">
            {results.suggested_alternatives.slice(0, 2).map((alt, idx) => (
              <div
                key={idx}
                className="bg-white/80 p-2.5 rounded-lg border border-[#B45309]/20 flex items-center justify-between flex-wrap gap-2 text-xs"
              >
                <div>
                  <span className="font-bold text-red-700">{alt.replace_ar}</span>
                  <ArrowRight size={12} className="inline mx-1.5 text-stone-400" />
                  <span className="font-bold text-emerald-800">{alt.with_ar}</span>
                  <p className="text-[10px] text-stone-600 m-0 mt-0.5">{alt.reason_ar}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onApplyAlternative(alt.replace_ar, alt.with_id)}
                  className="px-2.5 py-1 rounded bg-[#143626] text-[#F7F5EE] font-semibold text-[11px] hover:bg-[#245c49] transition cursor-pointer"
                >
                  {isAr ? "تطبيق الاستبدال" : "Apply Swap"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
