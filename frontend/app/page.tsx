"use client";

import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, CloudSun, Droplets, FlaskConical, Globe, Info, Layers3, Leaf, LocateFixed, MapPin, Orbit, RefreshCw, ShieldCheck, Sprout, ThermometerSun, TriangleAlert, X, Zap } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useState } from "react";
import { DEMOS, Demo, Evaluation, mockEvaluation, Rotation } from "@/lib/mock-engine";
import { CROPS, DEMO_LABELS, DICTS, Lang, PROVENANCE_VARIABLES, SOIL_TEXTURES, SOURCE_LABELS, STATUS_LABELS, WARNING_LABELS } from "./i18n";
import { Ltr, useLang } from "./lang";

export type ApiCrop = {
  crop_id: string;
  common_name: string;
  family: string;
  base_temp_c: number;
  max_temp_c: number;
  minimum_gdd: number;
  minimum_water_mm: number;
  maximum_water_mm: number;
  drought_tolerance: number;
  minimum_ph: number;
  maximum_ph: number;
  root_depth: string;
  is_legume: boolean;
  nitrogen_credit_kg_ha: number;
  nitrogen_removal_index: number;
  residue_score: number;
  irrigation_required: boolean;
  source_notes: string;
};

type Dict = (typeof DICTS)[Lang];
function titleCase(value:string){return value.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())}
function signed(value:number){const formatted = value.toFixed(1); return value>0?"+"+formatted:formatted}
function humanRain(value:number,t:Dict){const m=t.results.metrics;return value<-25?m.rainDeficitBig:value<-10?m.rainDeficitMod:value>15?m.rainAbove:m.rainNear}
function noteText(key:string,t:Dict){return key==="apiConnected"?t.results.apiConnected:key==="apiFallback"?t.results.apiFallback:key==="scenarioApi"?t.results.scenarioApi:key==="scenarioMock"?t.results.scenarioMock:""}
function demoDisplay(demo:Demo,lang:Lang,t:Dict){
  if(demo.id==="custom") return {name:t.location.customFarm,country:t.location.customCountry,system:demo.system==="Irrigated"?t.location.systemIrrigated:t.location.systemRainfed};
  const labels=DEMO_LABELS[demo.id];
  if(labels && lang==="ar")return {name:labels.name,country:labels.country,system:labels.system};
  return {name:demo.name,country:demo.country,system:demo.system};
}
function BackIcon({size}:{size:number}){const {dir}=useLang();return dir==="rtl"?<ArrowRight size={size}/>:<ArrowLeft size={size}/>}
function NextIcon({size}:{size?:number}){const {dir}=useLang();return dir==="rtl"?<ChevronLeft size={size}/>:<ChevronRight size={size}/>}
function ApiText({text,map}:{text:string;map?:Record<string,{en:string;ar:string}>}){
  const {lang,t}=useLang();
  if(lang==="en")return <>{text}</>;
  const entry=map?.[text];
  if(entry||/[\u0600-\u06FF]/.test(text))return <>{entry?entry.ar:text}</>;
  return <span className="api-en-text" title={t.results.sourceBadgeTitle}>{text}<i className="en-chip">{t.results.sourceBadge}</i></span>;
}

export default function Home(){
  const {lang,t}=useLang();
  const [demoList, setDemoList] = useState<Demo[]>(DEMOS);
  const [cropsList, setCropsList] = useState<ApiCrop[]>([]);
  const [apiOnline, setApiOnline] = useState<boolean>(true);
  const [useLiveSatellite, setUseLiveSatellite] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [demo,setDemo]=useState<Demo>(DEMOS[0]);
  const [step,setStep]=useState(1);
  const [view,setView]=useState<"setup"|"loading"|"results">("setup");
  const [currentCrop,setCurrentCrop]=useState(demo.currentCrop);
  const [soil,setSoil]=useState(demo.soil);
  const [irrigated,setIrrigated]=useState(demo.irrigated);
  const [priority,setPriority]=useState(demo.priority);
  const [evaluation,setEvaluation]=useState<Evaluation|null>(null);
  const [stage,setStage]=useState(0);
  const [rainChange,setRainChange]=useState(0);
  const [tempChange,setTempChange]=useState(0);
  const [methodOpen,setMethodOpen]=useState(false);
  const [sourceNoteKey,setSourceNoteKey]=useState("");

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
          const cData = await cropsRes.json() as { crops?: ApiCrop[] };
          if (cData.crops && cData.crops.length > 0) {
            setCropsList(cData.crops);
          }
        }
        if (profilesRes && profilesRes.ok) {
          const pData = await profilesRes.json() as { profiles?: { id: string; name: string; latitude: number; longitude: number; current_crop_id: string; soil_texture: string; is_irrigated: boolean; farmer_priority: string }[] };
          if (pData.profiles && pData.profiles.length > 0) {
            const mapped = pData.profiles.map((p) => {
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
    return () => { active = false; };
  }, []);

  useEffect(()=>{
    const doc=document as Document&{modelContext?:{registerTool:(tool:unknown,options?:{signal?:AbortSignal})=>void|Promise<void>}};
    if(!doc.modelContext?.registerTool)return;
    const lifecycle=new AbortController();
    void Promise.resolve(doc.modelContext.registerTool({
      name:"select_demo_farm",
      title:"Select demo farm",
      description:"Choose one of Field Shift's demo farms and update the visible farm setup form.",
      inputSchema:{type:"object",properties:{demo_id:{type:"string",enum:demoList.map(item=>item.id)}},required:["demo_id"],additionalProperties:false},
      annotations:{readOnlyHint:false,untrustedContentHint:false},
      execute(input:unknown){
        const id=(input as {demo_id?:string})?.demo_id;
        const selected=demoList.find(item=>item.id===id);
        if(!selected)throw new Error("Unknown demo farm");
        setDemo(selected);setCurrentCrop(selected.currentCrop);setSoil(selected.soil);setIrrigated(selected.irrigated);setPriority(selected.priority);setStep(1);setView("setup");return {selected:selected.id,name:selected.name};
      }
    },{signal:lifecycle.signal})).catch(()=>undefined);
    return()=>lifecycle.abort()
  },[demoList]);

  function chooseDemo(next:Demo){
    setDemo(next);
    setCurrentCrop(next.currentCrop);
    setSoil(next.soil);
    setIrrigated(next.irrigated);
    setPriority(next.priority);
    setErrorMessage(null);
  }

  function updateCoordinates(changes:Partial<Pick<Demo,"latitude"|"longitude">>){
    setDemo(current=>({...current,...changes,id:"custom",name:t.location.customFarm,country:t.location.customCountry}));
    setErrorMessage(null);
  }

  function locate(){
    if(!navigator.geolocation)return;
    navigator.geolocation.getCurrentPosition(pos=>updateCoordinates({latitude:Number(pos.coords.latitude.toFixed(4)),longitude:Number(pos.coords.longitude.toFixed(4))}));
  }

  async function analyse(){
    if(!Number.isFinite(demo.latitude)||demo.latitude < -90||demo.latitude > 90||!Number.isFinite(demo.longitude)||demo.longitude < -180||demo.longitude > 180)return;
    setErrorMessage(null);
    setView("loading");
    setStage(0);
    const ticker=window.setInterval(()=>setStage(value=>Math.min(value+1,3)),650);
    
    // When useLiveSatellite is true, demo_profile_id is omitted so the backend queries NASA POWER & SoilGrids live!
    const payload={
      latitude:demo.latitude,
      longitude:demo.longitude,
      current_crop_id:currentCrop,
      soil_texture:soil || undefined,
      is_irrigated:irrigated,
      farmer_priority:priority,
      demo_profile_id: useLiveSatellite ? undefined : (demo.id==="custom"?undefined:demo.id)
    };

    try{
      const base=process.env.NEXT_PUBLIC_API_BASE_URL??"";
      const response=await fetch(base+"/api/v1/farms/evaluate",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload)
      });
      if(!response.ok){
        const errJson = (await response.json().catch(()=>null)) as { detail?: string } | null;
        const detail = errJson?.detail || `API request returned HTTP ${response.status}`;
        throw new Error(detail);
      }
      const data=await response.json() as Evaluation;
      setEvaluation(data);
      setSourceNoteKey("apiConnected");
      window.setTimeout(()=>{
        window.clearInterval(ticker);
        setStage(3);
        setView("results");
      },750);
    }
    catch(err: unknown){
      window.clearInterval(ticker);
      console.warn("Live API evaluation failed:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setView("setup");
      setStep(4); // Keep user on review step so they can see and address the agronomic constraint
    }
  }

  async function simulate(){
    if(!evaluation)return;
    try{
      const base=process.env.NEXT_PUBLIC_API_BASE_URL??"";
      const response=await fetch(base+"/api/v1/farms/simulate",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          evaluation_id:evaluation.evaluation_id,
          rainfall_change_pct:rainChange,
          temperature_change_c:tempChange,
          irrigation_available:irrigated
        })
      });
      if(!response.ok){
        const errJson = (await response.json().catch(()=>null)) as { detail?: string } | null;
        throw new Error(errJson?.detail || "Simulation failed");
      }
      const simulatedData = await response.json() as Evaluation;
      setEvaluation(simulatedData);
      setSourceNoteKey("scenarioApi");
    }catch(err){
      console.error("Simulation error:", err);
      // Fallback only if server lost the evaluation session
      setEvaluation(mockEvaluation({...demo,currentCrop,soil,irrigated,priority},rainChange,tempChange,irrigated,lang));
      setSourceNoteKey("scenarioMock");
    }
  }

  function restart(){
    setView("setup");
    setStep(1);
    setEvaluation(null);
    setRainChange(0);
    setTempChange(0);
    setErrorMessage(null);
  }

  return (
    <main className="min-h-screen">
      <Header onMethod={()=>setMethodOpen(true)} onRestart={restart} results={view==="results"} apiOnline={apiOnline}/>
      {view==="setup"&&(
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
          setCurrentCrop={(c)=>{ setCurrentCrop(c); setErrorMessage(null); }}
          soil={soil}
          setSoil={(s)=>{ setSoil(s); setErrorMessage(null); }}
          irrigated={irrigated}
          setIrrigated={(b)=>{ setIrrigated(b); setErrorMessage(null); }}
          priority={priority}
          setPriority={(p)=>{ setPriority(p); setErrorMessage(null); }}
          useLiveSatellite={useLiveSatellite}
          setUseLiveSatellite={(b)=>{ setUseLiveSatellite(b); setErrorMessage(null); }}
          errorMessage={errorMessage}
          analyse={analyse}
        />
      )}
      {view==="loading"&&<Loading stage={stage}/>}
      {view==="results"&&evaluation&&(
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
          simulate={simulate}
        />
      )}
      <MethodDialog open={methodOpen} onOpenChange={setMethodOpen}/>
    </main>
  );
}

function Header({onMethod,onRestart,results,apiOnline}:{onMethod:()=>void;onRestart:()=>void;results:boolean;apiOnline:boolean}){
 const {lang,t,toggle}=useLang();
 return (
   <header className="site-header">
     <button className="brand button-reset" onClick={onRestart} aria-label={t.nav.home}>
       <span className="brand-mark"><Sprout size={20}/></span>
       <span>Field Shift</span>
     </button>
     <nav aria-label={t.nav.primary}>
       <button onClick={onMethod}>{t.nav.method}</button>
       <a href="#sources">{t.nav.sources}</a>
     </nav>
     <div className="header-actions">
       <button className="lang-toggle" onClick={toggle} aria-label={t.toggle.aria}>
         <Globe size={15}/>
         <span>{t.toggle.label}</span>
       </button>
       <span className={`status-pill ${apiOnline ? "online" : "offline"}`}>
         <i/> {apiOnline ? (results ? t.nav.ready : (lang === "ar" ? "الواجهة مباشرة" : "API Live")) : (lang === "ar" ? "غير متصل" : "Offline")}
       </span>
     </div>
   </header>
 );
}

type SetupProps={
  demo:Demo;
  demoList:Demo[];
  cropsList:ApiCrop[];
  chooseDemo:(d:Demo)=>void;
  updateCoordinates:(c:Partial<Pick<Demo,"latitude"|"longitude">>)=>void;
  step:number;
  setStep:(n:number)=>void;
  locate:()=>void;
  currentCrop:string;
  setCurrentCrop:(s:string)=>void;
  soil:string;
  setSoil:(s:string)=>void;
  irrigated:boolean;
  setIrrigated:(b:boolean)=>void;
  priority:string;
  setPriority:(s:string)=>void;
  useLiveSatellite:boolean;
  setUseLiveSatellite:(b:boolean)=>void;
  errorMessage:string|null;
  analyse:()=>void;
};

function Setup(p:SetupProps){
 const {t,num}=useLang();
 return (
   <>
     <section className="workbench" id="top">
       <div className="intro-panel">
         <div className="eyebrow"><Orbit size={15}/> {t.hero.eyebrow}</div>
         <h1>{t.hero.h1}</h1>
         <p className="lede">{t.hero.lede}</p>
         <div className="evidence-strip">
           <div><CloudSun/><span><strong>{t.hero.climateHistory}</strong>{t.hero.nasa}</span></div>
           <div><Sprout/><span><strong>{t.hero.soilContext}</strong>{t.hero.soilGrids}</span></div>
           <div><Droplets/><span><strong>{t.hero.stressTests}</strong>{t.hero.rainHeat}</span></div>
         </div>
         <p className="micro-disclaimer">{t.hero.micro}</p>
       </div>
       <section className="planner-card" aria-labelledby="planner-title">
         <div className="planner-heading">
           <div>
             <span className="step-label"><Ltr>0{p.step} / 04 ·</Ltr> {t.planner.steps[p.step-1]}</span>
             <h2 id="planner-title">{t.planner.titles[p.step-1]}</h2>
           </div>
           <div className="steps" aria-label={`${t.planner.stepAria} ${num(p.step)} ${t.planner.stepAriaOf}`}>
             {[1,2,3,4].map(n=><i key={n} className={n<=p.step?"done":""}/>)}
           </div>
         </div>
         {p.step===1&&<LocationStep {...p}/>}
         {p.step===2&&<ConditionStep {...p}/>}
         {p.step===3&&<PriorityStep {...p}/>}
         {p.step===4&&<ReviewStep {...p}/>}
         <div className="form-actions">
           {p.step>1&&<button className="secondary-action" onClick={()=>p.setStep(p.step-1)}><BackIcon size={17}/> {t.planner.back}</button>}
           <button className="primary-action" onClick={()=>p.step<4?p.setStep(p.step+1):p.analyse()}>
             {p.step<4?t.planner.continue:t.planner.analyse} {p.step<4?<NextIcon size={18}/>:<FlaskConical size={18}/>}
           </button>
         </div>
       </section>
     </section>
     <section className="signal-band" id="sources">
       <span>{t.band.title}</span>
       <div>{t.band.items.map(item=><b key={item}>{item}</b>)}</div>
     </section>
   </>
 );
}

function Coords({lat,lon}:{lat:number;lon:number}){
  const {lang,num}=useLang();
  return <>{lang==="ar"?<><Ltr>{num(lat,4)}°</Ltr>, <Ltr>{num(lon,4)}°</Ltr></>:<>{lat.toFixed(4)}°, {lon.toFixed(4)}°</>}</>;
}

function LocationStep(p:SetupProps){
  const {lang,t}=useLang();
  return (
    <>
      <div className="demo-row" role="list" aria-label={t.location.farmsAria}>
        {p.demoList.map(item=>{
          const d=demoDisplay(item,lang,t);
          return (
            <button key={item.id} className={p.demo.id===item.id?"demo active":"demo"} onClick={()=>p.chooseDemo(item)}>
              <span>{d.name}</span>
              <small>{d.country} · {d.system}</small>
            </button>
          );
        })}
      </div>

      <div className="switch-field" style={{ margin: "14px 0" }} onClick={()=>p.setUseLiveSatellite(!p.useLiveSatellite)}>
        <div>
          <strong>
            <Zap size={14} style={{ display: "inline", verticalAlign: "middle", marginInlineEnd: "4px", color: "#1b5e20" }} />
            {lang === "ar" ? "استعلام الأقمار الصناعية الحي (ناسا و SoilGrids)" : "Live Satellite & Climate Query (NASA POWER)"}
          </strong>
          <small>
            {lang === "ar"
              ? "استعلام مباشر لسجلات ناسا الحقيقية لخطوط الطول والعرض بدلاً من التقدير الثابت"
              : "Query real-time NASA historical climate & ISRIC SoilGrids for these exact coordinates"}
          </small>
        </div>
        <Switch.Root className="switch" checked={p.useLiveSatellite} onCheckedChange={p.setUseLiveSatellite} onClick={(e)=>e.stopPropagation()}>
          <Switch.Thumb/>
        </Switch.Root>
      </div>

      <div className="map-grid" aria-label={t.location.approximateAria}>
        <div className="map-copy">
          <span>{t.location.region}</span>
          <strong>{demoDisplay(p.demo,lang,t).name}</strong>
          <small>{demoDisplay(p.demo,lang,t).country} · {demoDisplay(p.demo,lang,t).system}</small>
        </div>
        <MapPin className="map-pin" size={34}/>
        <button className="locate" onClick={p.locate}>
          <LocateFixed size={16}/> {t.location.useLocation}
        </button>
        <span className="map-coordinate"><Coords lat={p.demo.latitude} lon={p.demo.longitude}/></span>
      </div>

      <div className="coordinate-grid">
        <label>
          {t.location.latitude}
          <input type="number" min={-90} max={90} step="any" value={p.demo.latitude} onChange={e=>p.updateCoordinates({latitude:e.target.valueAsNumber})} inputMode="decimal"/>
        </label>
        <label>
          {t.location.longitude}
          <input type="number" min={-180} max={180} step="any" value={p.demo.longitude} onChange={e=>p.updateCoordinates({longitude:e.target.valueAsNumber})} inputMode="decimal"/>
        </label>
      </div>
    </>
  );
}

function ConditionStep(p:SetupProps){
  const {lang,t}=useLang();
  const availableCrops = p.cropsList.length > 0
    ? p.cropsList.map(c => ({ id: c.crop_id, label: CROPS[c.crop_id]?.[lang] || c.common_name }))
    : Object.entries(CROPS).map(([id, label]) => ({ id, label: label[lang] }));
  const selectedCrop = p.cropsList.find(c => c.crop_id === p.currentCrop);

  return (
    <div className="conditions">
      <label className="field-label">
        {t.conditions.currentCrop}
        <select value={p.currentCrop} onChange={e=>p.setCurrentCrop(e.target.value)}>
          {availableCrops.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
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
        <select value={p.soil} onChange={e=>p.setSoil(e.target.value)}>
          {Object.entries(SOIL_TEXTURES).map(([id,label])=><option key={id} value={id}>{label[lang]}</option>)}
        </select>
        <small>{t.conditions.textureHelp}</small>
      </label>

      <div className="switch-field" onClick={()=>p.setIrrigated(!p.irrigated)}>
        <div>
          <strong>{t.conditions.irrigation}</strong>
          <small>{t.conditions.irrigationHelp}</small>
        </div>
        <Switch.Root className="switch" checked={p.irrigated} onCheckedChange={p.setIrrigated} onClick={(e)=>e.stopPropagation()}>
          <Switch.Thumb/>
        </Switch.Root>
      </div>

      <div className="condition-note">
        <Info size={17}/>
        <p>{t.conditions.note}</p>
      </div>
    </div>
  );
}

function PriorityStep(p:SetupProps){
  const {t}=useLang();
  const weights:Record<string,string>={balanced:"30 · 30 · 25 · 15",drought_resilience:"25 · 45 · 20 · 10",soil_recovery:"20 · 20 · 45 · 15",crop_diversity:"20 · 20 · 20 · 40"};
  return (
    <div className="priority-grid">
      {t.priorities.map(item=>(
        <button key={item.id} onClick={()=>p.setPriority(item.id)} className={p.priority===item.id?"priority-card active":"priority-card"}>
          <span className="radio-dot">{p.priority===item.id&&<i/>}</span>
          <strong>{item.label}</strong>
          <small>{item.help}</small>
          <em><Ltr>{weights[item.id]}</Ltr></em>
        </button>
      ))}
    </div>
  );
}

function ReviewStep(p:SetupProps){
  const {lang,t}=useLang();
  const cropObj = p.cropsList.find(c => c.crop_id === p.currentCrop);
  const crop = CROPS[p.currentCrop]?.[lang] ?? (cropObj?.common_name || p.currentCrop);
  const goal = t.priorities.find(x=>x.id===p.priority)?.label;
  const soilLabel = lang==="ar"?(SOIL_TEXTURES[p.soil]?.ar??p.soil):p.soil.replace("_"," ").toLowerCase();

  const isHardFilterError = p.errorMessage?.includes("No safe three-year sequence passed the current hard filters");
  const translatedError = isHardFilterError
    ? (lang === "ar"
        ? "لم تجتز أي دورة زراعية ثلاثية الشروط الإلزامية الصارمة للموقع والمحصول الحالي."
        : p.errorMessage)
    : p.errorMessage;

  const tipText = p.irrigated
    ? (lang === "ar"
        ? `ملاحظة: الري مفعّل بالفعل (محسوب في التحليل)، ولكن المحصول المختار (${crop}) غير متوافق زراعياً مع ظروف المنطقة بسبب قلوية التربة (pH المرتفع) أو شدة الإجهاد الحراري. جرّب اختيار محصول أكثر تحملاً للحرارة والقلوية مثل اللوبيا أو الذرة الرفيعة أو الدخن.`
        : `Note: Irrigation is already enabled and factored into the analysis. However, the selected starting crop (${crop}) exceeds local hard constraints (e.g. high soil pH alkalinity or extreme heat days). Try selecting a more heat/alkali-tolerant crop like Cowpea, Pearl Millet, or Sorghum.`)
    : (lang === "ar"
        ? "نصيحة: جرّب تفعيل الري التكميلي في الخطوة 2، أو اختر محصولاً أكثر تحملاً للجفاف والحرارة."
        : "Tip: Try toggling 'Irrigation available' ON in Step 2, or select a more drought/heat-tolerant crop.");

  return (
    <div className="review-grid">
      {p.errorMessage && (
        <div className="error-alert" style={{ gridColumn: "1 / -1" }}>
          <TriangleAlert size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>{lang === "ar" ? "تنبيه من محرك التحليل الزراعي المباشر" : "Agronomic Constraint Warning"}</strong>
            <p style={{ margin: "4px 0" }}>{translatedError}</p>
            <small style={{ color: "#741212", display: "block", marginTop: "4px" }}>
              {tipText}
            </small>
          </div>
        </div>
      )}
      <div>
        <span>{t.review.region}</span>
        <strong>{demoDisplay(p.demo,lang,t).name}, {demoDisplay(p.demo,lang,t).country}</strong>
        <small><Coords lat={p.demo.latitude} lon={p.demo.longitude}/></small>
      </div>
      <div>
        <span>{t.review.startingCrop}</span>
        <strong>{crop} {cropObj?.family ? `(${cropObj.family})` : ""}</strong>
        <small>{p.irrigated?t.review.irrigationOn:t.review.irrigationOff}</small>
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
            ? (lang === "ar" ? "أقمار ناسا و SoilGrids (مباشر)" : "NASA POWER & SoilGrids (Live)")
            : (lang === "ar" ? "ملف إقليمي مسجل" : "Regional Preset Profile")}
        </strong>
        <small>{p.useLiveSatellite ? (lang === "ar" ? "استعلام سحابي حقيقي" : "Real-time satellite query") : (lang === "ar" ? "تقدير محفوظ" : "Pre-calibrated fallback")}</small>
      </div>
      <p><ShieldCheck size={17}/> {t.review.shield}</p>
    </div>
  );
}

function Loading({stage}:{stage:number}){
  const {t}=useLang();
  return (
    <section className="loading-screen">
      <div className="orbit-visual"><span/><i/><b><Sprout/></b></div>
      <span className="step-label">{t.loading.label}</span>
      <h1>{t.loading.h1}</h1>
      <p>{t.loading.p}</p>
      <div className="loading-list">
        {t.loading.stages.map((text,index)=>(
          <div key={text} className={index<=stage?"active":""}>
            <span>{index<stage?<Check size={14}/>:index+1}</span>{text}
          </div>
        ))}
      </div>
    </section>
  );
}

function Results({data,demo,sourceNoteKey,rainChange,setRainChange,tempChange,setTempChange,irrigated,setIrrigated,simulate}:{data:Evaluation;demo:Demo;sourceNoteKey:string;rainChange:number;setRainChange:(n:number)=>void;tempChange:number;setTempChange:(n:number)=>void;irrigated:boolean;setIrrigated:(b:boolean)=>void;simulate:()=>void}){
 const {lang,t,num}=useLang();
 const e=data.environmental_context;
 const d=demoDisplay(demo,lang,t);
 const f=(v:number,digits?:number)=>lang==="ar"?num(v,digits):digits===undefined?String(v):v.toFixed(digits);
 const heatNote=e.heat_stress_days>24?t.results.metrics.highRisk:t.results.metrics.withinThreshold;
 const soilValue=lang==="ar"?(SOIL_TEXTURES[e.soil_texture]?.ar??titleCase(e.soil_texture)):titleCase(e.soil_texture);

 return (
   <div className="results-shell">
     <section className="result-title">
       <div>
         <span className="eyebrow"><MapPin size={14}/>{d.name}, {d.country}</span>
         <h1>{t.results.h1}</h1>
         <p>{t.results.p}</p>
       </div>
       <div className="evidence-status">
         <span>{t.results.dataStatus}</span>
         <strong>
           {e.data_quality?.climate === "LIVE" 
             ? (lang === "ar" ? "بيانات حية مباشرة من أقمار ناسا (NASA POWER)" : "Live Satellite Evidence (NASA POWER)")
             : (lang === "ar" ? "بيانات إقليمية معايرة (ملف توضيحي بديل)" : "Calibrated Regional Profile (Fallback)")}
         </strong>
       </div>
     </section>

     <section className="environment-grid">
       <Metric
         icon={<Droplets/>}
         label={t.results.metrics.rainfall}
         value={<><Ltr>{f(e.seasonal_rainfall_mm)}</Ltr> {t.results.metrics.mm}</>}
         note={<>{humanRain(e.precipitation_anomaly_pct,t)} <Ltr>{"· "+(lang==="ar"?(e.precipitation_anomaly_pct>0?"+"+num(e.precipitation_anomaly_pct,1):num(e.precipitation_anomaly_pct,1)):signed(e.precipitation_anomaly_pct))+"%"}</Ltr></>}
       />
       <Metric
         icon={<ThermometerSun/>}
         label={t.results.metrics.heatStress}
         value={<>{f(e.heat_stress_days)} {t.results.metrics.heatUnit}</>}
         note={heatNote}
       />
       <Metric
         icon={<Layers3/>}
         label={t.results.metrics.soilCondition}
         value={soilValue}
         note={<Ltr>{"pH "+f(e.soil_ph,1)+" · OM "+f(e.soil_organic_matter_pct,1)+"%"}</Ltr>}
       />
       <Metric
         icon={<Orbit/>}
         label={t.results.metrics.seasonalHeat}
         value={<>{f(e.annual_gdd)} {t.results.metrics.gddUnit}</>}
         note={t.results.metrics.gddNote}
       />
     </section>

     <Tabs.Root defaultValue="ranked">
       <div className="result-toolbar">
         <Tabs.List aria-label={t.results.tabsAria}>
           <Tabs.Trigger value="ranked">{t.results.tabRanked}</Tabs.Trigger>
           <Tabs.Trigger value="compare">{t.results.tabCompare}</Tabs.Trigger>
         </Tabs.List>
         <span><i/> {t.results.toolbar}</span>
       </div>
       <Tabs.Content value="ranked">
         <div className="rotation-list">
           {data.recommended_rotations.map(rotation=><RotationCard key={rotation.rank} rotation={rotation}/>)}
         </div>
       </Tabs.Content>
       <Tabs.Content value="compare">
         <Compare rotations={data.recommended_rotations}/>
       </Tabs.Content>
     </Tabs.Root>

     <section className="scenario-section">
       <div className="scenario-copy">
         <span className="step-label">{t.scenario.label}</span>
         <h2>{t.scenario.h1}</h2>
         <p>{t.scenario.p}</p>
       </div>
       <div className="scenario-controls">
         <SliderField label={t.scenario.rainfallChange} value={rainChange} setValue={setRainChange} min={-40} max={20} suffix="%"/>
         <SliderField label={t.scenario.temperatureChange} value={tempChange} setValue={setTempChange} min={0} max={4} suffix="°C"/>
         <div className="switch-field compact" onClick={()=>setIrrigated(!irrigated)}>
           <div>
             <strong>{t.scenario.irrigation}</strong>
             <small>{irrigated?t.scenario.available:t.scenario.unavailable}</small>
           </div>
           <Switch.Root className="switch" checked={irrigated} onCheckedChange={setIrrigated} onClick={(e)=>e.stopPropagation()}>
             <Switch.Thumb/>
           </Switch.Root>
         </div>
         <button className="primary-action" onClick={simulate}>
           <RefreshCw size={17}/> {t.scenario.rerun}
         </button>
       </div>
     </section>

     <section className="provenance" id="sources">
       <div>
         <span className="step-label">{t.provenance.label}</span>
         <h2>{t.provenance.h1}</h2>
       </div>
       {data.data_provenance.map(item=>(
         <div key={item.variable}>
           <span className={"quality "+item.status.toLowerCase()}><ApiText text={item.status} map={STATUS_LABELS}/></span>
           <strong><ApiText text={item.source} map={SOURCE_LABELS}/></strong>
           <small>{lang==="ar"?(PROVENANCE_VARIABLES[item.variable]?.ar??item.variable.replaceAll("_"," ")):item.variable.replaceAll("_"," ")}</small>
         </div>
       ))}
     </section>
     <Responsible/>
   </div>
 );
}

function Metric({icon,label,value,note}:{icon:React.ReactNode;label:string;value:React.ReactNode;note:React.ReactNode}){
  return <article className="metric"><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>;
}

function cropName(crop:{crop_id:string;name:string},lang:Lang){
  return CROPS[crop.crop_id]?.[lang]??crop.name;
}

function RotationCard({rotation}:{rotation:Rotation}){
  const {lang,t}=useLang();
  return (
    <article className="rotation-card">
      <div className="rank-col">
        <span>{t.results.rank}</span>
        <strong>0{rotation.rank}</strong>
        <div className="overall-ring" style={{"--score":rotation.scores.overall} as React.CSSProperties}>
          <b>{rotation.scores.overall}</b>
          <small>/ 100</small>
        </div>
      </div>
      <div className="rotation-main">
        <div className="rotation-head">
          <div>
            <span className="step-label">{t.results.sequence}</span>
            <h3>{rotation.sequence.map(crop=>cropName(crop,lang)).join(lang==="ar"?" ← ":" → ")}</h3>
          </div>
          {rotation.rank===1&&<span className="best-fit"><Leaf size={14}/> {t.results.strongestFit}</span>}
        </div>
        <div className="timeline">
          {rotation.sequence.map((crop,index)=>(
            <div key={crop.crop_id}>
              <span>{t.results.year} 0{crop.year}</span>
              <strong>{cropName(crop,lang)}</strong>
              {index<2&&<NextIcon/>}
            </div>
          ))}
        </div>
        <div className="why">
          <strong>{t.results.why}</strong>
          <ul>{rotation.explanations.map(item=><li key={item}><ApiText text={item}/></li>)}</ul>
        </div>
        <div className="warning">
          <TriangleAlert size={16}/>
          <ApiText text={rotation.warnings[0]} map={WARNING_LABELS}/>
        </div>
      </div>
      <ScoreBars scores={rotation.scores}/>
    </article>
  );
}

function ScoreBars({scores}:{scores:Rotation["scores"]}){
  const {t}=useLang();
  return (
    <div className="score-bars">
      {(["climate","water","soil","diversity"] as const).map(key=>(
        <div key={key}>
          <span>{t.results.dimensions[key]} <b>{scores[key]}</b></span>
          <i><em style={{width:scores[key]+"%"}}/></i>
        </div>
      ))}
    </div>
  );
}

function Compare({rotations}:{rotations:Rotation[]}){
  const {lang,t}=useLang();
  return (
    <div className="compare-grid">
      {rotations.map(r=>(
        <article key={r.rank}>
          <span className="step-label">{t.results.rank} 0{r.rank}</span>
          <div className="compare-score">{r.scores.overall}<small>/100</small></div>
          <h3>{r.sequence.map(crop=>cropName(crop,lang)).join(lang==="ar"?" ← ":" → ")}</h3>
          <ScoreBars scores={r.scores}/>
          <ul>{r.explanations.slice(0,2).map(x=><li key={x}><ApiText text={x}/></li>)}</ul>
        </article>
      ))}
    </div>
  );
}

function SliderField({label,value,setValue,min,max,suffix}:{label:string;value:number;setValue:(n:number)=>void;min:number;max:number;suffix:string}){
  const {lang,dir,num}=useLang();
  const show=(v:number)=>(v>0?"+":"")+(lang==="ar"?num(v):String(v))+suffix;
  return (
    <label className="slider-field">
      <span>{label}<b><Ltr>{show(value)}</Ltr></b></span>
      <Slider.Root dir={dir} className="slider" value={[value]} min={min} max={max} step={1} onValueChange={v=>setValue(v[0])}>
        <Slider.Track><Slider.Range/></Slider.Track>
        <Slider.Thumb aria-label={label}/>
      </Slider.Root>
      <small>
        <i><Ltr>{(lang==="ar"?num(min):String(min))+suffix}</Ltr></i>
        <i><Ltr>{show(max)}</Ltr></i>
      </small>
    </label>
  );
}

function Responsible(){
  const {t}=useLang();
  return (
    <footer className="responsible">
      <ShieldCheck/>
      <p><strong>{t.responsible.title}</strong>{t.responsible.p}</p>
    </footer>
  );
}

function MethodDialog({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
  const {t}=useLang();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay"/>
        <Dialog.Content className="dialog-content">
          <Dialog.Close className="dialog-close" aria-label={t.method.close}><X/></Dialog.Close>
          <span className="step-label">{t.method.label}</span>
          <Dialog.Title>{t.method.title}</Dialog.Title>
          <Dialog.Description>{t.method.description}</Dialog.Description>
          <div className="method-flow">
            {t.method.steps.map((item,index)=>(
              <div key={item.title}>
                <b>0{index+1}</b>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
            ))}
          </div>
          <div className="formula">{t.method.formula}</div>
          <p className="method-limit"><Info/>{t.method.limit}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
