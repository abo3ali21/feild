"use client";

import React from "react";
import { motion } from "framer-motion";
import { Droplets, Sprout, TriangleAlert } from "lucide-react";

interface SoilCrossSection3DProps {
  moisturePct: number;
  isRtl?: boolean;
}

export function SoilCrossSection3D({ moisturePct, isRtl = true }: SoilCrossSection3DProps) {
  const isWet = moisturePct >= 60;
  const isOptimal = moisturePct >= 30 && moisturePct < 60;
  const isDrought = moisturePct < 30;

  // Water table height calculation (15% min to 88% max)
  const waterHeight = Math.min(88, Math.max(16, moisturePct * 0.95));

  // Dynamic soil colors based on moisture
  const soilGradient = isDrought
    ? "from-[#C4A482] via-[#A88968] to-[#8C6D4C]"
    : isWet
    ? "from-[#3D2C1D] via-[#2F2115] to-[#1E150D]"
    : "from-[#654A32] via-[#4D3826] to-[#36271A]";

  return (
    <div className="w-full bg-white border border-[#E2DFD5] rounded-2xl p-6 shadow-xs text-[#143626]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
        <div>
          <h4 className="text-sm font-bold text-[#143626] m-0 flex items-center gap-2">
            <Sprout size={17} className="text-[#143626]" />
            {isRtl ? "قطاع التربة ثلاثي الأبعاد (In-Situ Soil Moisture Column)" : "3D Soil Moisture Cross-Section Column"}
          </h4>
          <p className="text-[11px] text-[#5C665E] m-0 mt-0.5">
            {isRtl
              ? "محاكاة فيزيائية لمنسوب المياه وتغلغل الرطوبة في الجذور وفق قراءة الحساس"
              : "Physically-calibrated water table & root infiltration dynamic response"}
          </p>
        </div>

        {/* Dynamic status badge */}
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            isWet
              ? "bg-sky-50 text-sky-800 border-sky-200"
              : isOptimal
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          {isDrought ? <TriangleAlert size={13} /> : <Droplets size={13} />}
          {isWet
            ? isRtl ? "تشبع رطوبي مرتفع (بعد الري)" : "Saturated Moisture"
            : isOptimal
            ? isRtl ? "سعة حقلية مثالية (متوازن)" : "Optimal Field Capacity"
            : isRtl ? "إجهاد جفاف في منطقة الجذور" : "Root-Zone Drought Deficit"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left: 3D Layered Isometric Soil Column */}
        <div className="md:col-span-7 flex justify-center py-2">
          <div className="relative w-full max-w-[340px] h-[240px] rounded-xl overflow-hidden border-2 border-[#D6D2C4] shadow-md bg-stone-100 flex flex-col justify-between select-none">
            
            {/* 1. Surface Layer (0 cm) */}
            <div className="relative z-20 h-10 bg-[#4F6854] border-b border-[#3D5241] px-3 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-1 text-white">
                <Sprout size={16} className={isDrought ? "text-amber-200" : "text-emerald-300"} />
                <span className="text-[11px] font-bold">
                  {isRtl ? "سطح الحقل (0 cm)" : "Field Surface (0 cm)"}
                </span>
              </div>
              <span className="text-[10px] text-emerald-100 font-mono">
                {isDrought ? (isRtl ? "سطح جاف" : "Dry Crust") : (isRtl ? "سطح مروي" : "Wet Canopy")}
              </span>
            </div>

            {/* 2. Middle Layer: Root Zone (Rhizosphere 0 - 40 cm) */}
            <div className={`relative flex-1 bg-gradient-to-b ${soilGradient} transition-colors duration-700 overflow-hidden`}>
              
              {/* Plant Root SVG Graphic */}
              <svg
                className="absolute inset-0 w-full h-full opacity-75 pointer-events-none"
                viewBox="0 0 340 160"
                fill="none"
              >
                {/* Main Root Stems */}
                <path
                  d="M 90 0 C 92 35 105 75 80 130 M 90 30 C 115 55 125 90 140 125 M 88 50 C 65 80 50 110 35 140"
                  stroke={isDrought ? "#D2B48C" : "#E8D8C8"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M 230 0 C 228 35 215 75 240 130 M 230 30 C 205 55 195 90 180 125 M 232 50 C 255 80 270 110 285 140"
                  stroke={isDrought ? "#D2B48C" : "#E8D8C8"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Secondary Root Tendrils */}
                <path
                  d="M 85 70 Q 110 85 115 110 M 75 95 Q 60 115 55 135 M 235 70 Q 210 85 205 110 M 245 95 Q 260 115 265 135"
                  stroke={isDrought ? "#C2A679" : "#F4ECE1"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>

              {/* 3. Dynamic Water Table Rising / Falling with Spring Motion */}
              <motion.div
                initial={false}
                animate={{ height: `${waterHeight}%` }}
                transition={{ type: "spring", stiffness: 60, damping: 14 }}
                className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-sky-700/80 via-sky-500/50 to-sky-400/30 border-t-2 border-sky-300/80 backdrop-blur-[1px] flex items-start justify-between px-3 pt-1"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-sky-100 drop-shadow-xs">
                  <Droplets size={13} className="text-sky-200" />
                  <span>
                    {isRtl ? "منسوب المياه الحرة" : "Water Table"} ({moisturePct.toFixed(1)}%)
                  </span>
                </div>
                <span className="text-[10px] text-sky-100/90 font-mono">
                  -{Math.round((100 - moisturePct) * 0.4)} cm
                </span>
              </motion.div>

              {/* Depth Scale Markings */}
              <div className="absolute right-1 top-2 bottom-2 flex flex-col justify-between text-[9px] font-mono text-white/50 pointer-events-none text-end select-none">
                <span>-10cm</span>
                <span>-25cm</span>
                <span>-40cm</span>
              </div>
            </div>

            {/* Base Bedrock / Capillary Layer */}
            <div className="h-6 bg-[#2B231B] border-t border-[#1F1913] px-3 flex items-center justify-between text-[10px] text-stone-400 font-mono">
              <span>{isRtl ? "طبقة الأساس والمسامية الجذرية" : "Deep Subsoil & Matrix"}</span>
              <span>-50 cm</span>
            </div>
          </div>
        </div>

        {/* Right: Telemetry Key Interpretations */}
        <div className="md:col-span-5 space-y-3">
          <div className="p-3 rounded-xl bg-[#F7F5EE] border border-[#E2DFD5] text-xs">
            <span className="font-bold text-[#143626] block mb-1">
              {isRtl ? "الرطوبة المقاسة بالحساس الميداني:" : "Field Moisture Measurement:"}
            </span>
            <div className="text-2xl font-bold font-serif text-[#143626]">
              {moisturePct.toFixed(1)}%
            </div>
            <p className="text-[#5C665E] text-[11px] mt-1 m-0">
              {isWet
                ? isRtl
                  ? "الماء يغمر منطقة الجذور بالكامل، التربة في حالة تشبع وتهوية مؤقتة."
                  : "Roots are fully hydrated; soil is at maximum saturation and capillary capacity."
                : isOptimal
                ? isRtl
                  ? "توازن مثالي بين الرطوبة والأكسجين في منطقة الجذور (Rhizosphere)."
                  : "Balanced air-water ratio inside the active root zone."
                : isRtl
                ? "منسوب المياه انخفض عن عمق الجذور؛ ينصح بري تكميلي لتجنب ذبول المحصول."
                : "Water table has dropped below active root depth; supplemental irrigation advised."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-white border border-[#E2DFD5]">
              <span className="text-stone-500 block">{isRtl ? "عمق الترطيب" : "Infiltration"}</span>
              <strong className="text-[#143626] text-xs">
                {isWet ? "-45 cm" : isOptimal ? "-30 cm" : "-12 cm"}
              </strong>
            </div>
            <div className="p-2.5 rounded-lg bg-white border border-[#E2DFD5]">
              <span className="text-stone-500 block">{isRtl ? "حالة المسام" : "Pore State"}</span>
              <strong className="text-[#143626] text-xs">
                {isWet ? (isRtl ? "مشبعة" : "Saturated") : isOptimal ? (isRtl ? "سعة حقلية" : "Field Capacity") : (isRtl ? "ذبول جزئي" : "Wilting Point")}
              </strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
