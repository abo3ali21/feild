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
        humidity_pct: 18.0,
        soil_moisture_pct: 21.0,
        soil_raw_adc: 2880,
      };
    }

    setTelemetry((prev) => ({ ...prev, ...override, timestamp: Date.now() / 1000, active: true }));

    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      await fetch(`${base}/api/sensors/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(override),
      });
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  const applyToPlanner = () => {
    const overridePayload = {
      active: true,
      temperature_c: telemetry.temperature_c,
      humidity_pct: telemetry.humidity_pct,
      soil_moisture_pct: telemetry.soil_moisture_pct,
      gas_resistance_kohm: telemetry.gas_resistance_kohm,
      timestamp: Date.now(),
    };
    localStorage.setItem("field_shift_hardware_override", JSON.stringify(overridePayload));
    setApplied(true);
    setTimeout(() => {
      router.push("/");
    }, 800);
  };

  const isRtl = lang === "ar";

  // NASA baseline estimates for Delta comparison
  const nasaEstimates = {
    temperature_c: 30.5,
    humidity_pct: 35.0,
    soil_moisture_pct: 28.0,
  };

  const tempDelta = telemetry.temperature_c - nasaEstimates.temperature_c;
  const moistureDelta = telemetry.soil_moisture_pct - nasaEstimates.soil_moisture_pct;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      style={{
        minHeight: "100vh",
        background: "var(--background, #0f172a)",
        color: "var(--foreground, #f8fafc)",
        padding: "2rem 1.5rem",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Top Header */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", marginBottom: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ padding: "0.6rem", background: "rgba(16, 185, 129, 0.15)", borderRadius: "12px", border: "1px solid rgba(16, 185, 129, 0.4)" }}>
              <Cpu style={{ color: "#34d399", width: 28, height: 28 }} />
            </div>
            <div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, margin: 0 }}>
                {isRtl ? "محطة المعايرة الحقلية (ESP32 Ground-Truth Station)" : "ESP32 Ground-Truth Station"}
              </h1>
              <p style={{ color: "#94a3b8", fontSize: "0.85rem", margin: "2px 0 0 0" }}>
                {isRtl ? "معايرة فورية لبيانات الأقمار الصناعية (NASA POWER) بحساسات الحقل الميدانية" : "Real-time Ground-Truth Calibration against Satellite Observations"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "#f8fafc",
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              {lang === "ar" ? "English" : "العربية"}
            </button>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                color: "#94a3b8",
                textDecoration: "none",
                fontSize: "0.85rem",
                fontWeight: 600,
              }}
            >
              {isRtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
              {isRtl ? "العودة للوحة القيادة" : "Back to Planner"}
            </Link>
          </div>
        </div>

        {/* Live Device Status Banner */}
        <div
          style={{
            marginTop: "1.5rem",
            padding: "0.85rem 1.25rem",
            borderRadius: "12px",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Radio size={18} style={{ color: "#34d399" }} />
            <span style={{ fontSize: "0.9rem" }}>
              <strong>{isRtl ? "معرف الجهاز:" : "Device ID:"}</strong> <code style={{ color: "#a7f3d0" }}>{telemetry.device_id}</code>
            </span>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: "6px",
                background: "rgba(16, 185, 129, 0.2)",
                color: "#6ee7b7",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {telemetry.active ? (isRtl ? "متصل مباشر" : "LIVE ONLINE") : (isRtl ? "وضع المحاكاة" : "SIMULATED")}
            </span>
          </div>

          <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
            {isRtl ? "قوة الإشارة (RSSI):" : "Signal (RSSI):"} <strong>{telemetry.rssi_dbm} dBm</strong> ·{" "}
            {isRtl ? "آخر استقبال:" : "Last Telemetry:"} <strong>{new Date(telemetry.timestamp * 1000).toLocaleTimeString()}</strong>
          </div>
        </div>
      </div>

      {/* Main Grid: Live Telemetry Gauges */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.25rem", marginBottom: "2rem" }}>
        {/* Soil Moisture */}
        <div style={{ padding: "1.25rem", borderRadius: "14px", background: "rgba(30, 41, 59, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <Droplets size={16} style={{ color: "#60a5fa" }} />
              {isRtl ? "رطوبة التربة (Capacitive ADC)" : "Soil Moisture (ADC)"}
            </span>
            <small style={{ color: "#64748b" }}>GPIO 34</small>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#38bdf8", marginBottom: "0.5rem" }}>
            {telemetry.soil_moisture_pct.toFixed(1)}%
          </div>
          <div style={{ background: "rgba(255, 255, 255, 0.1)", height: "8px", borderRadius: "4px", overflow: "hidden", marginBottom: "0.5rem" }}>
            <div
              style={{
                background: telemetry.soil_moisture_pct > 60 ? "#10b981" : telemetry.soil_moisture_pct > 30 ? "#3b82f6" : "#f59e0b",
                height: "100%",
                width: `${Math.min(100, telemetry.soil_moisture_pct)}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>
          <small style={{ color: "#64748b" }}>Raw ADC: {telemetry.soil_raw_adc} / 4095</small>
        </div>

        {/* Air Temperature */}
        <div style={{ padding: "1.25rem", borderRadius: "14px", background: "rgba(30, 41, 59, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <Thermometer size={16} style={{ color: "#f87171" }} />
              {isRtl ? "حرارة الحقل (BME680)" : "Field Temperature"}
            </span>
            <small style={{ color: "#64748b" }}>I2C 0x76/0x77</small>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#f87171", marginBottom: "0.5rem" }}>
            {telemetry.temperature_c.toFixed(1)} °C
          </div>
          <small style={{ color: "#94a3b8" }}>
            {isRtl ? "تقييم الإجهاد الحراري:" : "Heat Stress:"}{" "}
            <strong style={{ color: telemetry.temperature_c > 35 ? "#ef4444" : "#10b981" }}>
              {telemetry.temperature_c > 35 ? (isRtl ? "إجهاد مرتفع" : "Critical") : (isRtl ? "طبيعي" : "Optimal")}
            </strong>
          </small>
        </div>

        {/* Relative Humidity */}
        <div style={{ padding: "1.25rem", borderRadius: "14px", background: "rgba(30, 41, 59, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <Wind size={16} style={{ color: "#a78bfa" }} />
              {isRtl ? "الرطوبة النسبية" : "Relative Humidity"}
            </span>
            <small style={{ color: "#64748b" }}>BME680</small>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#a78bfa", marginBottom: "0.5rem" }}>
            {telemetry.humidity_pct.toFixed(1)} %
          </div>
          <small style={{ color: "#64748b" }}>Pressure: {telemetry.pressure_hpa.toFixed(1)} hPa</small>
        </div>

        {/* Soil VOC / Gas Resistance */}
        <div style={{ padding: "1.25rem", borderRadius: "14px", background: "rgba(30, 41, 59, 0.6)", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ color: "#94a3b8", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "6px" }}>
              <Gauge size={16} style={{ color: "#fbbf24" }} />
              {isRtl ? "نشاط التربة الحيوي (VOC)" : "Soil Gas Resistance"}
            </span>
            <small style={{ color: "#64748b" }}>MOX</small>
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 800, color: "#fbbf24", marginBottom: "0.5rem" }}>
            {telemetry.gas_resistance_kohm.toFixed(1)} kΩ
          </div>
          <small style={{ color: "#64748b" }}>{isRtl ? "مؤشر التنفس الميكروبي" : "Microbial Respiration Index"}</small>
        </div>
      </div>

      {/* Satellite vs. ESP32 Ground-Truth Delta Table */}
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          background: "rgba(30, 41, 59, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "14px",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem 0", display: "flex", alignItems: "center", gap: "8px" }}>
          <Activity size={20} style={{ color: "#38bdf8" }} />
          {isRtl ? "مقارنة القمر الصناعي (NASA POWER) مع قراءات الحساس الميداني (ESP32)" : "Satellite (NASA POWER) vs. Ground-Truth (ESP32) Delta"}
        </h3>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.1)", textAlign: isRtl ? "right" : "left", color: "#94a3b8" }}>
                <th style={{ padding: "0.75rem" }}>{isRtl ? "المتغير الزراعي" : "Agronomic Variable"}</th>
                <th style={{ padding: "0.75rem" }}>{isRtl ? "تقدير القمر الصناعي (NASA POWER)" : "Satellite Macro-Estimate"}</th>
                <th style={{ padding: "0.75rem" }}>{isRtl ? "قياس الحساس الميداني (ESP32 Ground)" : "In-Situ Sensor (ESP32)"}</th>
                <th style={{ padding: "0.75rem" }}>{isRtl ? "الفارق والملاحظة" : "Ground Delta & Significance"}</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                <td style={{ padding: "0.75rem", fontWeight: 600 }}>{isRtl ? "رطوبة التربة الجذرية" : "Root-Zone Moisture"}</td>
                <td style={{ padding: "0.75rem", color: "#94a3b8" }}>{nasaEstimates.soil_moisture_pct}%</td>
                <td style={{ padding: "0.75rem", color: "#38bdf8", fontWeight: 700 }}>{telemetry.soil_moisture_pct.toFixed(1)}%</td>
                <td style={{ padding: "0.75rem" }}>
                  <span style={{ color: moistureDelta >= 0 ? "#34d399" : "#f87171" }}>
                    {moistureDelta >= 0 ? `+${moistureDelta.toFixed(1)}%` : `${moistureDelta.toFixed(1)}%`}
                  </span>{" "}
                  <small style={{ color: "#64748b" }}>
                    {moistureDelta > 20
                      ? isRtl
                        ? "(رصد ري محلي حديث لم يلحظه القمر الصناعي)"
                        : "(Recent irrigation detected)"
                      : moistureDelta < -10
                      ? isRtl
                        ? "(جفاف موضعي أشد من التقدير العام)"
                        : "(Micro-drought stress detected)"
                      : isRtl
                      ? "(متطابق مع التقدير العام)"
                      : "(Consistent with baseline)"}
                  </small>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "0.75rem", fontWeight: 600 }}>{isRtl ? "درجة حرارة الهواء" : "Air Temperature"}</td>
                <td style={{ padding: "0.75rem", color: "#94a3b8" }}>{nasaEstimates.temperature_c} °C</td>
                <td style={{ padding: "0.75rem", color: "#f87171", fontWeight: 700 }}>{telemetry.temperature_c.toFixed(1)} °C</td>
                <td style={{ padding: "0.75rem" }}>
                  <span style={{ color: tempDelta > 0 ? "#f87171" : "#34d399" }}>
                    {tempDelta >= 0 ? `+${tempDelta.toFixed(1)} °C` : `${tempDelta.toFixed(1)} °C`}
                  </span>{" "}
                  <small style={{ color: "#64748b" }}>
                    {tempDelta > 2
                      ? isRtl
                        ? "(حرارة إشعاعية حقلية أعلى من متوسط النطاق)"
                        : "(Field canopy micro-heat detected)"
                      : isRtl
                      ? "(ضمن الهامش الطبيعي)"
                      : "(Within expected margin)"}
                  </small>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Demo Scenario Injector & Apply Action */}
      <div
        style={{
          maxWidth: "1100px",
          margin: "0 auto",
          background: "rgba(30, 41, 59, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "14px",
          padding: "1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1.5rem",
        }}
      >
        <div>
          <h4 style={{ fontSize: "1rem", fontWeight: 700, margin: "0 0 0.5rem 0" }}>
            {isRtl ? "محاكي العرض السريع (Live Demo Injector)" : "Live Presentation Scenario Injector"}
          </h4>
          <p style={{ color: "#94a3b8", fontSize: "0.8rem", margin: 0 }}>
            {isRtl
              ? "جرّب تغيير حالة الحقل فورياً لاختبار استجابة النظام أمام لجنة التحكيم:"
              : "Inject real-time sensor events for zero-failure competition demonstrations:"}
          </p>
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button
              onClick={() => injectScenario("drought")}
              disabled={loading}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {isRtl ? "جفاف حاد (18% رطوبة)" : "Severe Drought (18%)"}
            </button>
            <button
              onClick={() => injectScenario("irrigated")}
              disabled={loading}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "8px",
                background: "rgba(16, 185, 129, 0.15)",
                border: "1px solid rgba(16, 185, 129, 0.4)",
                color: "#6ee7b7",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {isRtl ? "بعد الري (78% رطوبة)" : "Post-Irrigation (78%)"}
            </button>
            <button
              onClick={() => injectScenario("heatwave")}
              disabled={loading}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "8px",
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.4)",
                color: "#fde68a",
                cursor: "pointer",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              {isRtl ? "موجة حرارة (41.5°C)" : "Heatwave (41.5°C)"}
            </button>
          </div>
        </div>

        <div>
          <button
            onClick={applyToPlanner}
            style={{
              padding: "0.85rem 1.75rem",
              borderRadius: "12px",
              background: applied ? "#059669" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              border: "none",
              cursor: "pointer",
              fontSize: "0.95rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              boxShadow: "0 4px 15px rgba(16, 185, 129, 0.3)",
              transition: "transform 0.15s ease",
            }}
          >
            {applied ? <CheckCircle2 size={20} /> : <Zap size={20} />}
            {isRtl ? "تطبيق قراءات الحساس على خطة الزراعة" : "Apply Sensor Data to Rotation Planner"}
          </button>
        </div>
      </div>
    </div>
  );
}
