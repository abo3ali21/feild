"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CloudSun,
  Droplets,
  FlaskConical,
  Globe,
  Info,
  Layers3,
  Orbit,
  RefreshCw,
  ShieldCheck,
  Sprout,
  TriangleAlert,
  X,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useState } from "react";

import { DEMOS, mockEvaluation } from "@/lib/mock-engine";
import {
  ApiCrop,
  Demo,
  Evaluation,
  Rotation,
} from "@/lib/types";
import {
  CROPS,
  DEMO_LABELS,
  DICTS,
  Lang,
  SOIL_TEXTURES,
} from "./i18n";
import { Ltr, useLang } from "./lang";

import { FarmMap } from "@/components/FarmMap";
import { ClimateDashboard } from "@/components/ClimateDashboard";
import { SoilDashboard } from "@/components/SoilDashboard";
import { RotationCards } from "@/components/RotationCards";
import { CropCalendar } from "@/components/CropCalendar";
import { FactorBreakdown } from "@/components/FactorBreakdown";
import { DataProvenance } from "@/components/DataProvenance";

type Dict = (typeof DICTS)[Lang];

function demoDisplay(demo: Demo, lang: Lang, t: Dict) {
  if (demo.id === "custom") {
    return {
      name: t.location.customFarm,
      country: t.location.customCountry,
      system: demo.system === "Irrigated" ? t.location.systemIrrigated : t.location.systemRainfed,
    };
  }
  const labels = DEMO_LABELS[demo.id];
  if (labels && lang === "ar") {
    return { name: labels.name, country: labels.country, system: labels.system };
  }
  return { name: demo.name, country: demo.country, system: demo.system };
}

function BackIcon({ size }: { size: number }) {
  const { dir } = useLang();
  return dir === "rtl" ? <ArrowRight size={size} /> : <ArrowLeft size={size} />;
}

function NextIcon({ size }: { size?: number }) {
  const { dir } = useLang();
  return dir === "rtl" ? <ChevronLeft size={size} /> : <ChevronRight size={size} />;
}

function Coords({ lat, lon }: { lat: number; lon: number }) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return (
    <Ltr>
      {Math.abs(lat).toFixed(4)}°{ns}, {Math.abs(lon).toFixed(4)}°{ew}
    </Ltr>
  );
}

export default function Home() {
  const { lang, t } = useLang();
  const [demoList, setDemoList] = useState<Demo[]>(DEMOS);
  const [cropsList, setCropsList] = useState<ApiCrop[]>([]);
  const [apiOnline, setApiOnline] = useState<boolean>(true);
  const [useLiveSatellite, setUseLiveSatellite] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [demo, setDemo] = useState<Demo>(DEMOS[0]);
  const [step, setStep] = useState(1);
  const [view, setView] = useState<"setup" | "loading" | "results">("setup");
  const [currentCrop, setCurrentCrop] = useState(demo.currentCrop);
  const [soil, setSoil] = useState(demo.soil);
  const [irrigated, setIrrigated] = useState(demo.irrigated);
  const [priority, setPriority] = useState(demo.priority);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [stage, setStage] = useState(0);
  const [rainChange, setRainChange] = useState(0);
  const [tempChange, setTempChange] = useState(0);
  const [methodOpen, setMethodOpen] = useState(false);
  const [sourceNoteKey, setSourceNoteKey] = useState("");

  useEffect(() => {
    let active = true;
    async function loadData() {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      try {
        const [healthRes, cropsRes, profilesRes] = await Promise.all([
          fetch(base + "/api/v1/health").catch(() => null),
          fetch(base + "/api/v1/crops").catch(() => null),
          fetch(base + "/api/v1/demo-profiles").catch(() => null),
        ]);
        if (!active) return;
        setApiOnline(Boolean(healthRes && healthRes.ok));
        if (cropsRes && cropsRes.ok) {
          const cData = (await cropsRes.json()) as { crops?: ApiCrop[] };
          if (cData.crops && cData.crops.length > 0) {
            setCropsList(cData.crops);
          }
        }
        if (profilesRes && profilesRes.ok) {
          const pData = (await profilesRes.json()) as {
            profiles?: {
              id: string;
              name: string;
              latitude: number;
              longitude: number;
              current_crop_id: string;
              soil_texture: string;
              is_irrigated: boolean;
              farmer_priority: string;
            }[];
          };
          if (pData.profiles && pData.profiles.length > 0) {
            const mapped: Demo[] = pData.profiles.map((p) => {
              const nameParts = p.name.split(",");
              return {
                id: p.id,
                name: nameParts[0]?.trim() || p.name,
                country: nameParts[1]?.trim() || "",
                system: p.is_irrigated ? "Irrigated" : "Rainfed",
                latitude: p.latitude,
                longitude: p.longitude,
                currentCrop: p.current_crop_id,
                soil: p.soil_texture,
                irrigated: p.is_irrigated,
                priority: p.farmer_priority,
              };
            });
            setDemoList(mapped);
          }
        }
      } catch (err) {
        if (active) setApiOnline(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  function chooseDemo(next: Demo) {
    setDemo(next);
    setCurrentCrop(next.currentCrop);
    setSoil(next.soil);
    setIrrigated(next.irrigated);
    setPriority(next.priority);
    setErrorMessage(null);
  }

  function updateCoordinates(changes: Partial<Pick<Demo, "latitude" | "longitude">>) {
    setDemo((current) => ({
      ...current,
      ...changes,
      id: "custom",
      name: t.location.customFarm,
      country: t.location.customCountry,
    }));
    setErrorMessage(null);
  }

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) =>
      updateCoordinates({
        latitude: Number(pos.coords.latitude.toFixed(4)),
        longitude: Number(pos.coords.longitude.toFixed(4)),
      })
    );
  }

  async function analyse() {
    if (
      !Number.isFinite(demo.latitude) ||
      demo.latitude < -90 ||
      demo.latitude > 90 ||
      !Number.isFinite(demo.longitude) ||
      demo.longitude < -180 ||
      demo.longitude > 180
    )
      return;
    setErrorMessage(null);
    setView("loading");
    setStage(0);
    const ticker = window.setInterval(() => setStage((value) => Math.min(value + 1, 3)), 650);

    const payload = {
      latitude: demo.latitude,
      longitude: demo.longitude,
      current_crop_id: currentCrop,
      soil_texture: soil || undefined,
      is_irrigated: irrigated,
      farmer_priority: priority,
      demo_profile_id: useLiveSatellite ? undefined : demo.id === "custom" ? undefined : demo.id,
    };

    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      const response = await fetch(base + "/api/v1/farms/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errJson = (await response.json().catch(() => null)) as { detail?: string } | null;
        const detail = errJson?.detail || `API request returned HTTP ${response.status}`;
        throw new Error(detail);
      }
      const data = (await response.json()) as Evaluation;
      setEvaluation(data);
      setSourceNoteKey("apiConnected");
      window.setTimeout(() => {
        window.clearInterval(ticker);
        setStage(3);
        setView("results");
      }, 750);
    } catch (err: unknown) {
      window.clearInterval(ticker);
      console.warn("Live API evaluation failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setView("setup");
      setStep(4);
    }
  }

  async function simulate() {
    if (!evaluation) return;
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      const response = await fetch(base + "/api/v1/farms/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evaluation_id: evaluation.evaluation_id,
          rainfall_change_pct: rainChange,
          temperature_change_c: tempChange,
          irrigation_available: irrigated,
        }),
      });
      if (!response.ok) {
        const errJson = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(errJson?.detail || "Simulation failed");
      }
      const simulatedData = (await response.json()) as Evaluation;
      setEvaluation(simulatedData);
      setSourceNoteKey("scenarioApi");
    } catch (err) {
      console.error("Simulation error:", err);
      setEvaluation(
        mockEvaluation(
          { ...demo, currentCrop, soil, irrigated, priority },
          rainChange,
          tempChange,
          irrigated,
          lang
        )
      );
      setSourceNoteKey("scenarioMock");
    }
  }

  function restart() {
    setView("setup");
    setStep(1);
    setEvaluation(null);
    setRainChange(0);
    setTempChange(0);
    setErrorMessage(null);
  }

  return (
    <main className="min-h-screen">
      <Header
        onMethod={() => setMethodOpen(true)}
        onRestart={restart}
        results={view === "results"}
        apiOnline={apiOnline}
      />
      {view === "setup" && (
        <Setup
          demo={demo}
          demoList={demoList}
          cropsList={cropsList}
          chooseDemo={chooseDemo}
          updateCoordinates={updateCoordinates}
          step={step}
          setStep={setStep}
          locate={locate}
          currentCrop={currentCrop}
          setCurrentCrop={setCurrentCrop}
          soil={soil}
          setSoil={setSoil}
          irrigated={irrigated}
          setIrrigated={setIrrigated}
          priority={priority}
          setPriority={setPriority}
          useLiveSatellite={useLiveSatellite}
          setUseLiveSatellite={setUseLiveSatellite}
          errorMessage={errorMessage}
          analyse={analyse}
        />
      )}
      {view === "loading" && <Loading stage={stage} />}
      {view === "results" && evaluation && (
        <Results
          data={evaluation}
          demo={demo}
          sourceNoteKey={sourceNoteKey}
          rainChange={rainChange}
          setRainChange={setRainChange}
          tempChange={tempChange}
          setTempChange={setTempChange}
          irrigated={irrigated}
          setIrrigated={setIrrigated}
          priority={priority}
          simulate={simulate}
        />
      )}
      <MethodDialog open={methodOpen} onOpenChange={setMethodOpen} />
    </main>
  );
}

function Header({
  onMethod,
  onRestart,
  results,
  apiOnline,
}: {
  onMethod: () => void;
  onRestart: () => void;
  results: boolean;
  apiOnline: boolean;
}) {
  const { lang, toggle, t } = useLang();
  return (
    <header className="site-header">
      <button className="brand button-reset" onClick={onRestart} aria-label={t.nav.home}>
        <span className="brand-mark">
          <Sprout size={20} />
        </span>
        <span>Field Shift</span>
      </button>
      <nav aria-label={t.nav.primary}>
        <button onClick={onMethod}>{t.nav.method}</button>
        <a href="#sources">{t.nav.sources}</a>
      </nav>
      <div className="header-actions">
        <button className="lang-toggle" onClick={toggle} aria-label={t.toggle.aria}>
          <Globe size={15} />
          <span>{t.toggle.label}</span>
        </button>
        <span className={`status-pill ${apiOnline ? "online" : "offline"}`}>
          <i />{" "}
          {apiOnline
            ? results
              ? t.nav.ready
              : lang === "ar"
              ? "الواجهة مباشرة"
              : "API Live"
            : lang === "ar"
            ? "غير متصل"
            : "Offline"}
        </span>
      </div>
    </header>
  );
}

type SetupProps = {
  demo: Demo;
  demoList: Demo[];
  cropsList: ApiCrop[];
  chooseDemo: (d: Demo) => void;
  updateCoordinates: (c: Partial<Pick<Demo, "latitude" | "longitude">>) => void;
  step: number;
  setStep: (n: number) => void;
  locate: () => void;
  currentCrop: string;
  setCurrentCrop: (s: string) => void;
  soil: string;
  setSoil: (s: string) => void;
  irrigated: boolean;
  setIrrigated: (b: boolean) => void;
  priority: string;
  setPriority: (s: string) => void;
  useLiveSatellite: boolean;
  setUseLiveSatellite: (b: boolean) => void;
  errorMessage: string | null;
  analyse: () => void;
};

function Setup(p: SetupProps) {
  const { t, num } = useLang();
  return (
    <>
      <section className="workbench" id="top">
        <div className="intro-panel">
          <div className="eyebrow">
            <Orbit size={15} /> {t.hero.eyebrow}
          </div>
          <h1>{t.hero.h1}</h1>
          <p className="lede">{t.hero.lede}</p>
          <div className="evidence-strip">
            <div>
              <CloudSun />
              <span>
                <strong>{t.hero.climateHistory}</strong>
                {t.hero.nasa}
              </span>
            </div>
            <div>
              <Sprout />
              <span>
                <strong>{t.hero.soilContext}</strong>
                {t.hero.soilGrids}
              </span>
            </div>
            <div>
              <Droplets />
              <span>
                <strong>{t.hero.stressTests}</strong>
                {t.hero.rainHeat}
              </span>
            </div>
          </div>
          <p className="micro-disclaimer">{t.hero.micro}</p>
        </div>
        <section className="planner-card" aria-labelledby="planner-title">
          <div className="planner-heading">
            <div>
              <span className="step-label">
                <Ltr>0{p.step} / 04 ·</Ltr> {t.planner.steps[p.step - 1]}
              </span>
              <h2 id="planner-title">{t.planner.titles[p.step - 1]}</h2>
            </div>
            <div className="steps" aria-label={`${t.planner.stepAria} ${num(p.step)} ${t.planner.stepAriaOf}`}>
              {[1, 2, 3, 4].map((n) => (
                <i key={n} className={n <= p.step ? "done" : ""} />
              ))}
            </div>
          </div>
          {p.step === 1 && <LocationStep {...p} />}
          {p.step === 2 && <ConditionStep {...p} />}
          {p.step === 3 && <PriorityStep {...p} />}
          {p.step === 4 && <ReviewStep {...p} />}
          <div className="form-actions">
            {p.step > 1 && (
              <button className="secondary-action" onClick={() => p.setStep(p.step - 1)}>
                <BackIcon size={17} /> {t.planner.back}
              </button>
            )}
            <button
              className="primary-action"
              onClick={() => (p.step < 4 ? p.setStep(p.step + 1) : p.analyse())}
            >
              {p.step < 4 ? t.planner.continue : t.planner.analyse}{" "}
              {p.step < 4 ? <NextIcon size={18} /> : <FlaskConical size={18} />}
            </button>
          </div>
        </section>
      </section>
    </>
  );
}

function LocationStep(p: SetupProps) {
  const { lang, t } = useLang();
  const d = demoDisplay(p.demo, lang, t);

  return (
    <>
      <div className="demo-chips" role="radiogroup" aria-label={t.location.farmsAria}>
        {p.demoList.map((item) => {
          const display = demoDisplay(item, lang, t);
          const active = p.demo.id === item.id;
          return (
            <button
              key={item.id}
              role="radio"
              aria-checked={active}
              onClick={() => p.chooseDemo(item)}
              className={active ? "demo-chip active" : "demo-chip"}
            >
              <span>{display.name}</span>
              <small>{display.country}</small>
            </button>
          );
        })}
      </div>

      <div
        className="switch-field"
        style={{
          marginTop: "0.75rem",
          marginBottom: "1rem",
          background: "var(--surface-sunken, #f8fafc)",
          padding: "10px 14px",
          borderRadius: "8px",
          border: "1px solid var(--border-subtle, #e2e8f0)",
        }}
        onClick={() => p.setUseLiveSatellite(!p.useLiveSatellite)}
      >
        <div>
          <strong style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <CloudSun size={16} />
            {lang === "ar" ? "استعلام الأقمار الصناعية الحي (NASA & SoilGrids)" : "Live Satellite & Soil Query"}
          </strong>
          <small style={{ color: "var(--foreground-muted, #64748b)" }}>
            {lang === "ar"
              ? "استعلام مباشر لسجلات ناسا الحقيقية لخطوط الطول والعرض بدلاً من التقدير الثابت"
              : "Query real-time NASA historical climate & ISRIC SoilGrids for these exact coordinates"}
          </small>
        </div>
        <Switch.Root
          className="switch"
          checked={p.useLiveSatellite}
          onCheckedChange={p.setUseLiveSatellite}
          onClick={(e) => e.stopPropagation()}
        >
          <Switch.Thumb />
        </Switch.Root>
      </div>

      <FarmMap
        demo={p.demo}
        locate={p.locate}
        updateCoordinates={p.updateCoordinates}
        displayName={d.name}
        displayCountry={d.country}
        displaySystem={d.system}
      />
    </>
  );
}

function ConditionStep(p: SetupProps) {
  const { lang, t } = useLang();
  const availableCrops =
    p.cropsList.length > 0
      ? p.cropsList.map((c) => ({ id: c.crop_id, label: CROPS[c.crop_id]?.[lang] || c.common_name }))
      : Object.entries(CROPS).map(([id, label]) => ({ id, label: label[lang] }));
  const selectedCrop = p.cropsList.find((c) => c.crop_id === p.currentCrop);

  return (
    <div className="conditions">
      <label className="field-label">
        {t.conditions.currentCrop}
        <select value={p.currentCrop} onChange={(e) => p.setCurrentCrop(e.target.value)}>
          {availableCrops.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <small>{t.conditions.cropHelp}</small>
      </label>

      {selectedCrop && (
        <div className="crop-live-card">
          <div className="crop-live-stat">
            <small>{lang === "ar" ? "الفصيلة النباتية" : "Botanical Family"}</small>
            <strong>{selectedCrop.family}</strong>
          </div>
          <div className="crop-live-stat">
            <small>{lang === "ar" ? "الحرارة التراكمية" : "Min GDD"}</small>
            <strong>{selectedCrop.minimum_gdd}</strong>
          </div>
          <div className="crop-live-stat">
            <small>{lang === "ar" ? "الاحتياج المائي" : "Min Water"}</small>
            <strong>{selectedCrop.minimum_water_mm} mm</strong>
          </div>
          <div className="crop-live-stat">
            <small>{lang === "ar" ? "تحمل الجفاف" : "Drought Tol."}</small>
            <strong>{Math.round(selectedCrop.drought_tolerance * 100)}%</strong>
          </div>
          {selectedCrop.is_legume && (
            <div className="crop-live-stat">
              <small>{lang === "ar" ? "تثبيت النيتروجين" : "Legume N Credit"}</small>
              <strong>+{selectedCrop.nitrogen_credit_kg_ha} kg/ha</strong>
            </div>
          )}
        </div>
      )}

      <label className="field-label">
        {t.conditions.soilTexture} <span>{t.conditions.optional}</span>
        <select value={p.soil} onChange={(e) => p.setSoil(e.target.value)}>
          {Object.entries(SOIL_TEXTURES).map(([id, label]) => (
            <option key={id} value={id}>
              {label[lang]}
            </option>
          ))}
        </select>
        <small>{t.conditions.textureHelp}</small>
      </label>

      <div className="switch-field" onClick={() => p.setIrrigated(!p.irrigated)}>
        <div>
          <strong>{t.conditions.irrigation}</strong>
          <small>{t.conditions.irrigationHelp}</small>
        </div>
        <Switch.Root
          className="switch"
          checked={p.irrigated}
          onCheckedChange={p.setIrrigated}
          onClick={(e) => e.stopPropagation()}
        >
          <Switch.Thumb />
        </Switch.Root>
      </div>

      <div className="condition-note">
        <Info size={17} />
        <p>{t.conditions.note}</p>
      </div>
    </div>
  );
}

function PriorityStep(p: SetupProps) {
  const { t } = useLang();
  const weights: Record<string, string> = {
    balanced: "30 · 30 · 25 · 15",
    drought_resilience: "25 · 45 · 20 · 10",
    soil_recovery: "20 · 20 · 45 · 15",
    crop_diversity: "20 · 20 · 20 · 40",
  };
  return (
    <div className="priority-grid">
      {t.priorities.map((item) => (
        <button
          key={item.id}
          onClick={() => p.setPriority(item.id)}
          className={p.priority === item.id ? "priority-card active" : "priority-card"}
        >
          <span className="radio-dot">{p.priority === item.id && <i />}</span>
          <strong>{item.label}</strong>
          <small>{item.help}</small>
          <em>
            <Ltr>{weights[item.id]}</Ltr>
          </em>
        </button>
      ))}
    </div>
  );
}

function ReviewStep(p: SetupProps) {
  const { lang, t } = useLang();
  const cropObj = p.cropsList.find((c) => c.crop_id === p.currentCrop);
  const crop = CROPS[p.currentCrop]?.[lang] ?? (cropObj?.common_name || p.currentCrop);
  const goal = t.priorities.find((x) => x.id === p.priority)?.label;
  const soilLabel =
    lang === "ar"
      ? SOIL_TEXTURES[p.soil]?.ar ?? p.soil
      : p.soil.replace("_", " ").toLowerCase();

  return (
    <div className="review-grid">
      {p.errorMessage && (
        <div className="error-alert" style={{ gridColumn: "1 / -1" }}>
          <TriangleAlert size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>
              {lang === "ar" ? "تنبيه من محرك التحليل الزراعي المباشر" : "Agronomic Constraint Warning"}
            </strong>
            <p style={{ margin: "4px 0" }}>{p.errorMessage}</p>
          </div>
        </div>
      )}
      <div>
        <span>{t.review.region}</span>
        <strong>
          {demoDisplay(p.demo, lang, t).name}, {demoDisplay(p.demo, lang, t).country}
        </strong>
        <small>
          <Coords lat={p.demo.latitude} lon={p.demo.longitude} />
        </small>
      </div>
      <div>
        <span>{t.review.startingCrop}</span>
        <strong>
          {crop} {cropObj?.family ? `(${cropObj.family})` : ""}
        </strong>
        <small>{p.irrigated ? t.review.irrigationOn : t.review.irrigationOff}</small>
      </div>
      <div>
        <span>{t.review.soilContext}</span>
        <strong>{soilLabel}</strong>
        <small>{t.review.soilHelp}</small>
      </div>
      <div>
        <span>{t.review.goal}</span>
        <strong>{goal}</strong>
        <small>{t.review.goalHelp}</small>
      </div>
      <div>
        <span>{lang === "ar" ? "نمط البيانات" : "Data Mode"}</span>
        <strong>
          {p.useLiveSatellite
            ? lang === "ar"
              ? "أقمار ناسا و SoilGrids (مباشر)"
              : "NASA POWER & SoilGrids (Live)"
            : lang === "ar"
            ? "ملف إقليمي مسجل"
            : "Regional Preset Profile"}
        </strong>
        <small>
          {p.useLiveSatellite
            ? lang === "ar"
              ? "استعلام سحابي حقيقي"
              : "Real-time satellite query"
            : lang === "ar"
            ? "تقدير محفوظ"
            : "Pre-calibrated fallback"}
        </small>
      </div>
      <p>
        <ShieldCheck size={17} /> {t.review.shield}
      </p>
    </div>
  );
}

function Loading({ stage }: { stage: number }) {
  const { t } = useLang();
  return (
    <section className="loading-screen">
      <div className="orbit-visual">
        <span />
        <i />
        <b>
          <Sprout />
        </b>
      </div>
      <span className="step-label">{t.loading.label}</span>
      <h1>{t.loading.h1}</h1>
      <p>{t.loading.p}</p>
      <div className="loading-list">
        {t.loading.stages.map((text, index) => (
          <div key={text} className={index <= stage ? "active" : ""}>
            <span>{index < stage ? <Check size={14} /> : index + 1}</span>
            {text}
          </div>
        ))}
      </div>
    </section>
  );
}

function Results({
  data,
  demo,
  sourceNoteKey,
  rainChange,
  setRainChange,
  tempChange,
  setTempChange,
  irrigated,
  setIrrigated,
  priority,
  simulate,
}: {
  data: Evaluation;
  demo: Demo;
  sourceNoteKey: string;
  rainChange: number;
  setRainChange: (n: number) => void;
  tempChange: number;
  setTempChange: (n: number) => void;
  irrigated: boolean;
  setIrrigated: (b: boolean) => void;
  priority: string;
  simulate: () => void;
}) {
  const { lang, t } = useLang();
  const d = demoDisplay(demo, lang, t);
  const bestRotation = data.recommended_rotations[0];

  return (
    <div className="results-shell">
      <section className="result-title">
        <div>
          <span className="eyebrow">
            <Orbit size={14} />
            {d.name}, {d.country}
          </span>
          <h1>{t.results.h1}</h1>
          <p>{t.results.p}</p>
        </div>
        <div className="evidence-status">
          <span>{t.results.dataStatus}</span>
          <strong>
            {data.environmental_context.data_quality?.climate === "LIVE"
              ? lang === "ar"
                ? "بيانات حية مباشرة من أقمار ناسا (NASA POWER)"
                : "Live Satellite Evidence (NASA POWER)"
              : lang === "ar"
              ? "بيانات إقليمية معايرة (ملف توضيحي بديل)"
              : "Calibrated Regional Profile (Fallback)"}
          </strong>
        </div>
      </section>

      {/* Modern Agroclimatic and Edaphic Dashboards */}
      <ClimateDashboard context={data.environmental_context} />
      <SoilDashboard context={data.environmental_context} />

      {/* Ranked Rotations and Comparison */}
      <Tabs.Root defaultValue="ranked">
        <div className="result-toolbar">
          <Tabs.List aria-label={t.results.tabsAria}>
            <Tabs.Trigger value="ranked">{t.results.tabRanked}</Tabs.Trigger>
            <Tabs.Trigger value="compare">{t.results.tabCompare}</Tabs.Trigger>
          </Tabs.List>
          <span>
            <i /> {t.results.toolbar}
          </span>
        </div>
        <Tabs.Content value="ranked">
          <RotationCards rotations={data.recommended_rotations} />
          {bestRotation && <CropCalendar rotation={bestRotation} />}
        </Tabs.Content>
        <Tabs.Content value="compare">
          <RotationCards rotations={data.recommended_rotations} />
        </Tabs.Content>
      </Tabs.Root>

      {/* Multi-Criteria Decision Breakdown and Rejected Constraints */}
      <FactorBreakdown
        rotations={data.recommended_rotations}
        rejectedExamples={data.rejected_examples}
        priority={priority}
      />

      {/* Climate Scenario Stress Test Simulation */}
      <section className="scenario-section">
        <div className="scenario-copy">
          <span className="step-label">{t.scenario.label}</span>
          <h2>{t.scenario.h1}</h2>
          <p>{t.scenario.p}</p>
        </div>
        <div className="scenario-controls">
          <SliderField
            label={t.scenario.rainfallChange}
            value={rainChange}
            setValue={setRainChange}
            min={-40}
            max={20}
            suffix="%"
          />
          <SliderField
            label={t.scenario.temperatureChange}
            value={tempChange}
            setValue={setTempChange}
            min={0}
            max={4}
            suffix="°C"
          />
          <div className="switch-field compact" onClick={() => setIrrigated(!irrigated)}>
            <div>
              <strong>{t.scenario.irrigation}</strong>
              <small>{irrigated ? t.scenario.available : t.scenario.unavailable}</small>
            </div>
            <Switch.Root
              className="switch"
              checked={irrigated}
              onCheckedChange={setIrrigated}
              onClick={(e) => e.stopPropagation()}
            >
              <Switch.Thumb />
            </Switch.Root>
          </div>
          <button className="primary-action" onClick={simulate}>
            <RefreshCw size={17} /> {t.scenario.rerun}
          </button>
        </div>
      </section>

      {/* Scientific Traceability & Provenance */}
      <DataProvenance provenance={data.data_provenance} />

      <footer className="responsible">
        <ShieldCheck />
        <p>
          <strong>{t.responsible.title}</strong>
          {t.responsible.p}
        </p>
      </footer>
    </div>
  );
}

function SliderField({
  label,
  value,
  setValue,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  const { lang, dir, num } = useLang();
  const show = (v: number) => (v > 0 ? "+" : "") + (lang === "ar" ? num(v) : String(v)) + suffix;
  return (
    <label className="slider-field">
      <span>
        {label}
        <b>
          <Ltr>{show(value)}</Ltr>
        </b>
      </span>
      <Slider.Root
        dir={dir}
        className="slider"
        value={[value]}
        min={min}
        max={max}
        step={1}
        onValueChange={(v) => setValue(v[0])}
      >
        <Slider.Track>
          <Slider.Range />
        </Slider.Track>
        <Slider.Thumb aria-label={label} />
      </Slider.Root>
      <small>
        <i>
          <Ltr>{(lang === "ar" ? num(min) : String(min)) + suffix}</Ltr>
        </i>
        <i>
          <Ltr>{show(max)}</Ltr>
        </i>
      </small>
    </label>
  );
}

function MethodDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useLang();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <Dialog.Close className="dialog-close" aria-label={t.method.close}>
            <X />
          </Dialog.Close>
          <span className="step-label">{t.method.label}</span>
          <Dialog.Title>{t.method.title}</Dialog.Title>
          <Dialog.Description>{t.method.description}</Dialog.Description>
          <div className="method-flow">
            {t.method.steps.map((item, index) => (
              <div key={item.title}>
                <b>0{index + 1}</b>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <div className="formula">{t.method.formula}</div>
          <p className="method-limit">
            <Info />
            {t.method.limit}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
