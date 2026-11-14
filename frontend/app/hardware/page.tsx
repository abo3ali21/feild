"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Droplets,
  Gauge,
  Radio,
  Thermometer,
  Wind,
  Zap,
} from "lucide-react";

interface TelemetryData {
  active: boolean;
  device_id: string;
  temperature_c: number;
  humidity_pct: number;
  pressure_hpa: number;
  gas_resistance_kohm: number;
  soil_moisture_pct: number;
  soil_raw_adc: number;
  rssi_dbm: number;
  timestamp: number;
  is_synthetic?: boolean;
}

export default function HardwareStationPage() {
  const router = useRouter();
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    active: true,
    device_id: "esp32-field-node-01",
    temperature_c: 28.4,
    humidity_pct: 42.0,
    pressure_hpa: 1010.5,
    gas_resistance_kohm: 138.2,
    soil_moisture_pct: 34.5,
    soil_raw_adc: 2480,
    rssi_dbm: -68,
    timestamp: 1731614000,
    is_synthetic: true,
  });

  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Poll backend for live ESP32 telemetry every 2 seconds
  useEffect(() => {
    let mounted = true;
    async function fetchLatest() {
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
        const res = await fetch(`${base}/api/sensors/latest`);
        if (res.ok) {
          const data = await res.json();
          if (mounted && data) {
            setTelemetry((prev) => ({
              ...prev,
              ...data,
            }));
          }
        }
      } catch {
        // Backend offline or local demo mode
      }
    }

    fetchLatest();
    const interval = setInterval(fetchLatest, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Quick scenario injection presets
  const injectScenario = async (type: "drought" | "irrigated" | "heatwave") => {
    setLoading(true);
    let override: Partial<TelemetryData> = {};
    if (type === "drought") {
      override = {
        temperature_c: 34.2,
        humidity_pct: 22.0,
        soil_moisture_pct: 18.5,
        soil_raw_adc: 2950,
      };
    } else if (type === "irrigated") {
      override = {
        temperature_c: 26.5,
        humidity_pct: 58.0,
        soil_moisture_pct: 78.4,
        soil_raw_adc: 1540,
      };
    } else if (type === "heatwave") {
      override = {
        temperature_c: 41.5,
        humidity_pct: 19.0,
        soil_moisture_pct: 21.0,
        soil_raw_adc: 2880,
      };
    }

    const updated = {
      ...telemetry,
      ...override,
      timestamp: Math.floor(Date.now() / 1000),
      is_synthetic: true,
    };
    setTelemetry(updated);

    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      await fetch(`${base}/api/sensors/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {
      // Local fallback
    }
    setLoading(false);
  };

  const applyToPlanner = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "field_shift_hardware_override",
        JSON.stringify({
          active: true,
          temperature_c: telemetry.temperature_c,
          humidity_pct: telemetry.humidity_pct,
          soil_moisture_pct: telemetry.soil_moisture_pct,
          soil_raw_adc: telemetry.soil_raw_adc,
          timestamp: telemetry.timestamp,
        })
      );
      setApplied(true);
      setTimeout(() => {
        router.push("/");
      }, 700);
    }
  };

  const isRtl = lang === "ar";
  const nasaEstimates = {
    soil_moisture_pct: 35.0,
    temperature_c: 28.0,
  };

  const tempDelta = telemetry.temperature_c - nasaEstimates.temperature_c;
  const moistureDelta = telemetry.soil_moisture_pct - nasaEstimates.soil_moisture_pct;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F7F5EE] text-[#143626] py-8 px-4 sm:px-6 md:px-8 font-sans"
    >
      {/* Top Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
              <Cpu className="text-emerald-700 w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-serif text-[#143626] m-0">
                {isRtl ? "محطة المعايرة الحقلية (ESP32 Ground-Truth Station)" : "ESP32 Ground-Truth Station"}
              </h1>
              <p className="text-stone-600 text-xs sm:text-sm mt-0.5 m-0">
                {isRtl
                  ? "معايرة فورية لبيانات الأقمار الصناعية (NASA POWER) بحساسات الحقل الميدانية"
                  : "Real-time Ground-Truth Calibration against Satellite Observations"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="inline-flex items-center gap-2 rounded-full border border-[#D6D2C4] bg-white px-3.5 py-1.5 text-xs font-medium text-[#143626] hover:bg-[#F7F5EE] transition"
            >
              {lang === "ar" ? "English" : "العربية"}
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[#D6D2C4] bg-[#143626] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#245c49] transition shadow-xs"
            >
              {isRtl ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
              {isRtl ? "العودة للوحة القيادة" : "Back to Planner"}
            </Link>
          </div>
        </div>

        {/* Live Device Status Banner */}
        <div className="mt-6 p-4 rounded-2xl bg-white border border-[#E2DFD5] shadow-xs flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <Radio size={18} className="text-emerald-600" />
            <span className="text-xs sm:text-sm text-[#143626]">
              <strong>{isRtl ? "معرف الجهاز:" : "Device ID:"}</strong>{" "}
              <code className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded font-mono text-xs">
                {telemetry.device_id}
              </code>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              {telemetry.active ? (isRtl ? "متصل مباشر" : "LIVE ONLINE") : (isRtl ? "وضع المحاكاة" : "SIMULATED")}
            </span>
          </div>

          <div className="text-xs text-stone-500">
            {isRtl ? "قوة الإشارة (RSSI):" : "Signal (RSSI):"}{" "}
            <strong className="text-[#143626]">{telemetry.rssi_dbm} dBm</strong> ·{" "}
            {isRtl ? "آخر استقبال:" : "Last Telemetry:"}{" "}
            <strong className="text-[#143626]">{new Date(telemetry.timestamp * 1000).toLocaleTimeString()}</strong>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Telemetry Gauges */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Soil Moisture */}
        <div className="rounded-2xl bg-white border border-[#E2DFD5] p-5 shadow-xs transition hover:border-[#143626]/30">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
              <Droplets size={16} className="text-sky-600" />
              {isRtl ? "رطوبة التربة (ADC)" : "Soil Moisture (ADC)"}
            </span>
            <span className="text-[11px] font-mono text-stone-400">GPIO 34</span>
          </div>
          <div className="text-3xl font-bold font-serif text-[#143626] mb-2">
            {telemetry.soil_moisture_pct.toFixed(1)}%
          </div>
          <div className="bg-stone-100 h-2 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full transition-all duration-500 ${
                telemetry.soil_moisture_pct > 60
                  ? "bg-emerald-600"
                  : telemetry.soil_moisture_pct > 30
                  ? "bg-sky-600"
                  : "bg-amber-600"
              }`}
              style={{ width: `${Math.min(100, telemetry.soil_moisture_pct)}%` }}
            />
          </div>
          <span className="text-[11px] text-stone-500">Raw ADC: {telemetry.soil_raw_adc} / 4095</span>
        </div>

        {/* Air Temperature */}
        <div className="rounded-2xl bg-white border border-[#E2DFD5] p-5 shadow-xs transition hover:border-[#143626]/30">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
              <Thermometer size={16} className="text-rose-600" />
              {isRtl ? "حرارة الحقل (BME680)" : "Field Temperature"}
            </span>
            <span className="text-[11px] font-mono text-stone-400">I2C 0x76</span>
          </div>
          <div className="text-3xl font-bold font-serif text-[#143626] mb-2">
            {telemetry.temperature_c.toFixed(1)} °C
          </div>
          <span className="text-[11px] text-stone-600">
            {isRtl ? "تقييم الإجهاد الحراري:" : "Heat Stress:"}{" "}
            <strong className={telemetry.temperature_c > 35 ? "text-rose-600 font-semibold" : "text-emerald-700 font-semibold"}>
              {telemetry.temperature_c > 35 ? (isRtl ? "إجهاد مرتفع" : "Critical") : (isRtl ? "طبيعي" : "Optimal")}
            </strong>
          </span>
        </div>

        {/* Relative Humidity */}
        <div className="rounded-2xl bg-white border border-[#E2DFD5] p-5 shadow-xs transition hover:border-[#143626]/30">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
              <Wind size={16} className="text-violet-600" />
              {isRtl ? "الرطوبة النسبية" : "Relative Humidity"}
            </span>
            <span className="text-[11px] font-mono text-stone-400">BME680</span>
          </div>
          <div className="text-3xl font-bold font-serif text-[#143626] mb-2">
            {telemetry.humidity_pct.toFixed(1)} %
          </div>
          <span className="text-[11px] text-stone-500">Pressure: {telemetry.pressure_hpa.toFixed(1)} hPa</span>
        </div>

        {/* Soil Gas Resistance */}
        <div className="rounded-2xl bg-white border border-[#E2DFD5] p-5 shadow-xs transition hover:border-[#143626]/30">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-medium text-stone-600 flex items-center gap-1.5">
              <Gauge size={16} className="text-amber-600" />
              {isRtl ? "نشاط التربة الحيوي (VOC)" : "Soil Gas Resistance"}
            </span>
            <span className="text-[11px] font-mono text-stone-400">MOX</span>
          </div>
          <div className="text-3xl font-bold font-serif text-[#143626] mb-2">
            {telemetry.gas_resistance_kohm.toFixed(1)} kΩ
          </div>
          <span className="text-[11px] text-stone-500">
            {isRtl ? "مؤشر التنفس الميكروبي" : "Microbial Respiration Index"}
          </span>
        </div>
      </div>

      {/* Satellite vs. ESP32 Ground-Truth Delta Table */}
      <div className="max-w-5xl mx-auto bg-white border border-[#E2DFD5] rounded-2xl p-6 shadow-xs mb-8">
        <h3 className="text-base font-bold text-[#143626] mb-4 flex items-center gap-2">
          <Activity size={18} className="text-emerald-700" />
          {isRtl
            ? "مقارنة القمر الصناعي (NASA POWER) مع قراءات الحساس الميداني (ESP32)"
            : "Satellite (NASA POWER) vs. Ground-Truth (ESP32) Delta"}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-start border-collapse">
            <thead>
              <tr className="border-b border-[#E2DFD5] text-stone-500 font-semibold">
                <th className="py-2.5 px-3 text-start">{isRtl ? "المتغير الزراعي" : "Agronomic Variable"}</th>
                <th className="py-2.5 px-3 text-start">{isRtl ? "تقدير القمر الصناعي (NASA POWER)" : "Satellite Macro-Estimate"}</th>
                <th className="py-2.5 px-3 text-start">{isRtl ? "قياس الحساس الميداني (ESP32)" : "In-Situ Sensor (ESP32)"}</th>
                <th className="py-2.5 px-3 text-start">{isRtl ? "الفارق والملاحظة الحقلية" : "Ground Delta & Significance"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DFD5]/60">
              <tr>
                <td className="py-3 px-3 font-semibold text-[#143626]">{isRtl ? "رطوبة التربة الجذرية" : "Root-Zone Moisture"}</td>
                <td className="py-3 px-3 text-stone-600">{nasaEstimates.soil_moisture_pct}%</td>
                <td className="py-3 px-3 font-bold text-sky-700">{telemetry.soil_moisture_pct.toFixed(1)}%</td>
                <td className="py-3 px-3">
                  <span className={`font-semibold ${moistureDelta >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {moistureDelta >= 0 ? `+${moistureDelta.toFixed(1)}%` : `${moistureDelta.toFixed(1)}%`}
                  </span>{" "}
                  <span className="text-stone-500 text-xs">
                    {moistureDelta > 20
                      ? isRtl
                        ? "(رصد ري موضعي حديث لم يلحظه القمر الصناعي)"
                        : "(Recent irrigation detected)"
                      : moistureDelta < -10
                      ? isRtl
                        ? "(جفاف موضعي أشد من التقدير العام)"
                        : "(Micro-drought stress detected)"
                      : isRtl
                      ? "(متطابق مع التقدير العام)"
                      : "(Consistent with baseline)"}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-[#143626]">{isRtl ? "درجة حرارة الهواء" : "Air Temperature"}</td>
                <td className="py-3 px-3 text-stone-600">{nasaEstimates.temperature_c} °C</td>
                <td className="py-3 px-3 font-bold text-rose-700">{telemetry.temperature_c.toFixed(1)} °C</td>
                <td className="py-3 px-3">
                  <span className={`font-semibold ${tempDelta > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                    {tempDelta >= 0 ? `+${tempDelta.toFixed(1)} °C` : `${tempDelta.toFixed(1)} °C`}
                  </span>{" "}
                  <span className="text-stone-500 text-xs">
                    {tempDelta > 2
                      ? isRtl
                        ? "(حرارة إشعاعية حقلية أعلى من متوسط النطاق)"
                        : "(Field canopy micro-heat detected)"
                      : isRtl
                      ? "(ضمن الهامش الطبيعي)"
                      : "(Within expected margin)"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Demo Scenario Injector & Apply Action */}
      <div className="max-w-5xl mx-auto bg-white border border-[#E2DFD5] rounded-2xl p-6 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h4 className="text-base font-bold text-[#143626] m-0 mb-1">
            {isRtl ? "محاكي العرض السريع (Live Demo Injector)" : "Live Presentation Scenario Injector"}
          </h4>
          <p className="text-stone-600 text-xs sm:text-sm m-0">
            {isRtl
              ? "جرّب تغيير حالة الحقل فورياً لاختبار استجابة النظام أمام لجنة التحكيم:"
              : "Inject real-time sensor events for zero-failure competition demonstrations:"}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => injectScenario("drought")}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold hover:bg-rose-100 transition"
            >
              {isRtl ? "جفاف حاد (18% رطوبة)" : "Severe Drought (18%)"}
            </button>
            <button
              onClick={() => injectScenario("irrigated")}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition"
            >
              {isRtl ? "بعد الري (78% رطوبة)" : "Post-Irrigation (78%)"}
            </button>
            <button
              onClick={() => injectScenario("heatwave")}
              disabled={loading}
              className="px-3.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition"
            >
              {isRtl ? "موجة حرارة (41.5°C)" : "Heatwave (41.5°C)"}
            </button>
          </div>
        </div>

        <div>
          <button
            onClick={applyToPlanner}
            className={`px-6 py-3 rounded-xl text-white font-semibold text-sm inline-flex items-center gap-2 shadow-xs transition ${
              applied ? "bg-emerald-700" : "bg-[#143626] hover:bg-[#245c49]"
            }`}
          >
            {applied ? <CheckCircle2 size={18} /> : <Zap size={18} />}
            {isRtl ? "تطبيق قراءات الحساس على خطة الزراعة" : "Apply Sensor Data to Rotation Planner"}
          </button>
        </div>
      </div>
    </div>
  );
}
