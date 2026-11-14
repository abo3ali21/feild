import { CROPS, DICTS } from "@/app/i18n";

export type Demo = { id:string;name:string;country:string;system:string;latitude:number;longitude:number;currentCrop:string;soil:string;irrigated:boolean;priority:string };
export type Rotation = { rank:number;sequence:{year:number;crop_id:string;name:string}[];scores:{overall:number;climate:number;water:number;soil:number;diversity:number};explanations:string[];warnings:string[];factors:Record<string,string[]> };
export type Evaluation = { status:string;evaluation_id:string;environmental_context:{annual_gdd:number;seasonal_rainfall_mm:number;historical_rainfall_mm:number;precipitation_anomaly_pct:number;rainfall_status:string;heat_stress_days:number;soil_moisture_state:string;soil_texture:string;soil_ph:number;soil_organic_matter_pct:number;data_quality:Record<string,string>};data_provenance:{variable:string;source:string;status:string}[];recommended_rotations:Rotation[];rejected_examples?:{passed:boolean;rule:string;reason:string}[] };

export const DEMOS:Demo[]=[
  {id:"sahel",name:"Semi-Arid Sahel",country:"Senegal",system:"Rainfed",latitude:14.1203,longitude:-16.0351,currentCrop:"groundnut",soil:"SANDY_LOAM",irrigated:false,priority:"drought_resilience"},
  {id:"iowa",name:"Iowa Corn Belt",country:"USA",system:"Rainfed",latitude:42.0308,longitude:-93.6319,currentCrop:"maize",soil:"LOAM",irrigated:false,priority:"soil_recovery"},
  {id:"punjab",name:"Punjab / Indus Basin",country:"Pakistan",system:"Irrigated",latitude:30.1575,longitude:71.5249,currentCrop:"cotton",soil:"CLAY_LOAM",irrigated:true,priority:"drought_resilience"},
  {id:"andes",name:"Andean smallholder",country:"Peru",system:"Rainfed",latitude:-13.5319,longitude:-71.9675,currentCrop:"potato",soil:"LOAM",irrigated:false,priority:"balanced"},
  {id:"western_australia",name:"Western Wheat Belt",country:"Australia",system:"Rainfed",latitude:-31.48,longitude:117.16,currentCrop:"barley",soil:"SANDY_LOAM",irrigated:false,priority:"crop_diversity"},
];
const profiles:Record<string,{rain:number;historic:number;heat:number;gdd:number;ph:number;om:number;sequences:string[][]}>={
  sahel:{rain:410,historic:570,heat:22,gdd:1710,ph:6.1,om:1.1,sequences:[["pearl_millet","cowpea","sunflower"],["sorghum","sweet_potato","cowpea"],["cowpea","pearl_millet","sunflower"]]},
  iowa:{rain:610,historic:640,heat:7,gdd:1320,ph:6.5,om:2.8,sequences:[["soybean","sunflower","barley"],["cowpea","maize","canola"],["canola","soybean","sorghum"]]},
  punjab:{rain:285,historic:370,heat:31,gdd:1980,ph:7.8,om:.9,sequences:[["pearl_millet","cowpea","sunflower"],["sorghum","chickpea","canola"],["barley","sunflower","cowpea"]]},
  andes:{rain:520,historic:590,heat:2,gdd:980,ph:5.8,om:2.1,sequences:[["cowpea","barley","sunflower"],["canola","cowpea","sorghum"],["sunflower","chickpea","barley"]]},
  western_australia:{rain:330,historic:410,heat:13,gdd:1240,ph:6,om:1.3,sequences:[["chickpea","canola","barley"],["canola","cowpea","sorghum"],["sunflower","chickpea","barley"]]},
};

export function mockEvaluation(demo:Demo,rainChange=0,tempChange=0,irrigation=demo.irrigated,lang:"en"|"ar"="en"):Evaluation{
  const t=DICTS[lang];
  const cropLabel=(id:string)=>lang==="ar"?(CROPS[id]?.ar??id):CROPS[id]?.en??id;
  const p=profiles[demo.id]||profiles.sahel;const rain=p.rain*(1+rainChange/100);const anomaly=((rain-p.historic)/p.historic)*100;const penalty=Math.max(0,-rainChange)*.25+tempChange*2.4-(irrigation?4:0);
  const rotations=p.sequences.map((sequence,index)=>{const climate=Math.max(50,Math.round(92-index*4-tempChange*5));const water=Math.max(42,Math.round(88-index*3-penalty));const soil=Math.max(55,Math.round(84-index*2+(sequence.some(c=>["cowpea","chickpea","soybean"].includes(c))?4:0)));const diversity=Math.max(60,88-index*4);const overall=Math.round(climate*.3+water*.3+soil*.25+diversity*.15);return {rank:index+1,sequence:sequence.map((crop,year)=>({year:year+1,crop_id:crop,name:cropLabel(crop)})),scores:{overall,climate,water,soil,diversity},explanations:[t.mock.explain1(cropLabel(sequence[0])),t.mock.explain2(cropLabel(sequence[1])),t.mock.explain3],warnings:["Regional observations may not reflect field drainage, cultivar choice, pest pressure, or seed availability."],factors:{climate:[Math.round(p.gdd*(1+tempChange*.035))+" seasonal GDD",(p.heat+Math.round(tempChange*6))+" heat-stress days"],water:[Math.round(rain)+" mm seasonal rainfall",anomaly.toFixed(1)+"% rainfall anomaly"],soil:[p.ph.toFixed(1)+" estimated pH","Legume contribution included"],diversity:["3 crop families","Alternating root profiles"]}}}).sort((a,b)=>b.scores.overall-a.scores.overall).map((r,i)=>({...r,rank:i+1}));
  return {status:"success",evaluation_id:"demo-"+demo.id+"-"+Date.now(),environmental_context:{annual_gdd:Math.round(p.gdd*(1+tempChange*.035)),seasonal_rainfall_mm:Math.round(rain),historical_rainfall_mm:p.historic,precipitation_anomaly_pct:Number(anomaly.toFixed(1)),rainfall_status:anomaly<-25?"SIGNIFICANT_DEFICIT":anomaly<-10?"MODERATE_DEFICIT":"NEAR_NORMAL",heat_stress_days:p.heat+Math.round(tempChange*6),soil_moisture_state:"UNAVAILABLE",soil_texture:demo.soil,soil_ph:p.ph,soil_organic_matter_pct:p.om,data_quality:{climate:"FALLBACK",soil:"ESTIMATED",soil_moisture:"UNAVAILABLE"}},data_provenance:[{variable:"temperature_and_rainfall",source:"Demonstration regional profile",status:"FALLBACK"},{variable:"soil_properties",source:"Demonstration soil estimate",status:"ESTIMATED"},{variable:"root_zone_moisture",source:"Optional SMAP adapter not configured",status:"UNAVAILABLE"}],recommended_rotations:rotations};
}
