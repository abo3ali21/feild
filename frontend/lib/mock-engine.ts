import { CROPS, DICTS } from "@/app/i18n";

export type Demo = { id:string;name:string;country:string;system:string;latitude:number;longitude:number;currentCrop:string;soil:string;irrigated:boolean;priority:string };
export type Rotation = { rank:number;sequence:{year:number;crop_id:string;name:string}[];scores:{overall:number;climate:number;water:number;soil:number;diversity:number};explanations:string[];warnings:string[];factors:Record<string,string[]> };
export type Evaluation = { status:string;evaluation_id:string;environmental_context:{annual_gdd:number;seasonal_rainfall_mm:number;historical_rainfall_mm:number;precipitation_anomaly_pct:number;rainfall_status:string;heat_stress_days:number;effective_water_mm?:number;soil_moisture_state:string;soil_texture:string;soil_ph:number;soil_organic_matter_pct:number;data_quality:Record<string,string>};data_provenance:{variable:string;source:string;status:string}[];recommended_rotations:Rotation[];rejected_examples?:{passed:boolean;rule:string;reason:string}[] };

export type PriorityKey = "profit" | "soil" | "water";

export const FARMER_PRIORITIES: Record<
  PriorityKey,
  {
    id: PriorityKey;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
    weights: { profit: number; soil: number; water: number; pest: number };
  }
> = {
  profit: {
    id: "profit",
    titleAr: "أعلى عائد مادي",
    titleEn: "Maximize Profit",
    descAr: "يركز على المحاصيل الأعلى ربحية وتقليل تكلفة الأسمدة.",
    descEn: "Prioritizes high-value crops and reduces fertilizer costs.",
    weights: { profit: 0.5, soil: 0.2, water: 0.15, pest: 0.15 },
  },
  soil: {
    id: "soil",
    titleAr: "الحفاظ على خصوبة الأرض",
    titleEn: "Preserve Soil Health",
    descAr: "يجدد النيتروجين في التربة ويمنع إجهاد الأرض والآفات.",
    descEn: "Rebuilds soil nitrogen naturally and prevents pest buildup.",
    weights: { soil: 0.5, pest: 0.25, water: 0.15, profit: 0.1 },
  },
  water: {
    id: "water",
    titleAr: "توفير المياه",
    titleEn: "Save Water",
    descAr: "يقلل استهلاك الري ويناسب الأرض ذات الرطوبة المحدودة.",
    descEn: "Minimizes irrigation demand based on your soil moisture.",
    weights: { water: 0.5, soil: 0.2, pest: 0.15, profit: 0.15 },
  },
};

export const DEMOS:Demo[]=[
  {id:"luxor",name:"Nile Valley / Luxor",country:"Egypt",system:"Irrigated",latitude:25.6872,longitude:32.6396,currentCrop:"wheat",soil:"SANDY_LOAM",irrigated:true,priority:"water"},
  {id:"kafr_el_sheikh",name:"Kafr El-Sheikh / Nile Delta",country:"Egypt",system:"Irrigated",latitude:31.1107,longitude:30.9388,currentCrop:"wheat",soil:"CLAY_LOAM",irrigated:true,priority:"water"},
  {id:"toshka",name:"Toshka / Aswan",country:"Egypt",system:"Irrigated",latitude:22.5930,longitude:31.5390,currentCrop:"wheat",soil:"SANDY_LOAM",irrigated:true,priority:"water"},
];
const profiles:Record<string,{rain:number;historic:number;heat:number;gdd:number;ph:number;om:number;sequences:string[][]}>={
  luxor:{rain:10,historic:25,heat:45,gdd:3500,ph:7.8,om:1.0,sequences:[["wheat","berseem","maize"],["fava_bean","maize","wheat"],["berseem","sorghum","wheat"]]},
  kafr_el_sheikh:{rain:65,historic:85,heat:18,gdd:2600,ph:7.9,om:1.6,sequences:[["wheat","berseem","maize"],["fava_bean","maize","wheat"],["berseem","cotton","wheat"]]},
  toshka:{rain:2,historic:6,heat:58,gdd:3900,ph:7.6,om:0.7,sequences:[["wheat","berseem","sorghum"],["fava_bean","sorghum","wheat"],["berseem","groundnut","wheat"]]},
  // Fallbacks for compatibility
  sahel:{rain:410,historic:570,heat:22,gdd:1710,ph:6.1,om:1.1,sequences:[["pearl_millet","cowpea","sunflower"],["sorghum","sweet_potato","cowpea"],["cowpea","pearl_millet","sunflower"]]},
};

export function mockEvaluation(demo:Demo,rainChange=0,tempChange=0,irrigation=demo.irrigated,lang:"en"|"ar"="en",selectedCrops?:string[]):Evaluation{
  const t=DICTS[lang];
  const cropLabel=(id:string)=>lang==="ar"?(CROPS[id]?.ar??id):CROPS[id]?.en??id;
  const p=profiles[demo.id]||profiles.sahel;const rain=p.rain*(1+rainChange/100);const anomaly=((rain-p.historic)/p.historic)*100;const penalty=Math.max(0,-rainChange)*.25+tempChange*2.4-(irrigation?4:0);
  const activeSequences = (selectedCrops && selectedCrops.length >= 3)
    ? [
        [selectedCrops[0], selectedCrops[1], selectedCrops[2]],
        [selectedCrops[1], selectedCrops[3] || selectedCrops[0], selectedCrops[4] || selectedCrops[2]],
        [selectedCrops[2], selectedCrops[0], selectedCrops[3] || selectedCrops[1]],
      ]
    : (p.sequences || [["wheat","berseem","maize"],["fava_bean","maize","wheat"],["berseem","sorghum","wheat"]]);
  const pKey = ((demo.priority in FARMER_PRIORITIES) ? demo.priority : (demo.priority?.includes("water") || demo.priority?.includes("drought") ? "water" : demo.priority?.includes("soil") ? "soil" : "profit")) as PriorityKey;
  const pWeights = FARMER_PRIORITIES[pKey].weights;

  const rotations=activeSequences.map((sequence,index)=>{
    const climate=Math.max(50,Math.round(92-index*4-tempChange*5));
    const water=Math.max(42,Math.round(88-index*3-penalty));
    const soil=Math.max(55,Math.round(84-index*2+(sequence.some(c=>["cowpea","chickpea","soybean","berseem","fava_bean"].includes(c))?4:0)));
    const diversity=Math.max(60,88-index*4);
    const overall=Math.round(pWeights.water * water + pWeights.soil * soil + pWeights.pest * diversity + pWeights.profit * climate);
    return {
      rank:index+1,
      sequence:sequence.map((crop,year)=>({year:year+1,crop_id:crop,name:cropLabel(crop)})),
      scores:{overall,climate,water,soil,diversity},
      explanations:[t.mock.explain1(cropLabel(sequence[0])),t.mock.explain2(cropLabel(sequence[1])),t.mock.explain3],
      warnings:["Regional observations may not reflect field drainage, cultivar choice, pest pressure, or seed availability."],
      factors:{
        climate:[Math.round(p.gdd*(1+tempChange*.035))+" seasonal GDD",(p.heat+Math.round(tempChange*6))+" heat-stress days"],
        water:[Math.round(rain)+" mm seasonal rainfall",anomaly.toFixed(1)+"% rainfall anomaly"],
        soil:[p.ph.toFixed(1)+" estimated pH","Legume contribution included"],
        diversity:["3 crop families","Alternating root profiles"]
      }
    };
  }).sort((a,b)=>b.scores.overall-a.scores.overall).map((r,i)=>({...r,rank:i+1}));
  const effIrrig = irrigation ? 300 * 0.75 : 0;
  const effRain = rain <= 250 ? rain * 0.8 : 125 + rain * 0.5;
  const effectiveWater = Math.round(effRain + effIrrig);
  return {status:"success",evaluation_id:"demo-"+demo.id+"-"+Date.now(),environmental_context:{annual_gdd:Math.round(p.gdd*(1+tempChange*.035)),seasonal_rainfall_mm:Math.round(rain),historical_rainfall_mm:p.historic,precipitation_anomaly_pct:Number(anomaly.toFixed(1)),rainfall_status:anomaly<-25?"SIGNIFICANT_DEFICIT":anomaly<-10?"MODERATE_DEFICIT":"NEAR_NORMAL",heat_stress_days:p.heat+Math.round(tempChange*6),effective_water_mm:effectiveWater,soil_moisture_state:"UNAVAILABLE",soil_texture:demo.soil,soil_ph:p.ph,soil_organic_matter_pct:p.om,data_quality:{climate:"FALLBACK",soil:"ESTIMATED",soil_moisture:"UNAVAILABLE"}},data_provenance:[{variable:"temperature_and_rainfall",source:"Demonstration regional profile",status:"FALLBACK"},{variable:"soil_properties",source:"Demonstration soil estimate",status:"ESTIMATED"},{variable:"root_zone_moisture",source:"Optional SMAP adapter not configured",status:"UNAVAILABLE"}],recommended_rotations:rotations};
}
