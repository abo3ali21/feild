export type Lang = "en" | "ar";

export const CROPS: Record<string, { en: string; ar: string }> = {
  maize: { en: "Maize", ar: "الذرة الشامية" },
  pearl_millet: { en: "Pearl millet", ar: "الدخن اللؤلؤي" },
  sorghum: { en: "Sorghum", ar: "الذرة الرفيعة" },
  soybean: { en: "Soybean", ar: "فول الصويا" },
  cowpea: { en: "Cowpea", ar: "اللوبيا" },
  chickpea: { en: "Chickpea", ar: "الحمّص" },
  groundnut: { en: "Groundnut", ar: "فول السوداني" },
  potato: { en: "Potato", ar: "البطاطس" },
  tomato: { en: "Tomato", ar: "البندورة" },
  canola: { en: "Rapeseed / Canola", ar: "اللفت الزيتي (كانيولا)" },
  sunflower: { en: "Sunflower", ar: "عباد الشمس" },
  cassava: { en: "Cassava", ar: "الكاسافا" },
  cotton: { en: "Cotton", ar: "القطن" },
  barley: { en: "Barley", ar: "الشعير" },
  sweet_potato: { en: "Sweet potato", ar: "البطاطا الحلوة" },
};

export const SOIL_TEXTURES: Record<string, { en: string; ar: string }> = {
  SANDY: { en: "Sandy", ar: "رملية" },
  SANDY_LOAM: { en: "Sandy loam", ar: "طمية رملية" },
  LOAM: { en: "Loam", ar: "طميية" },
  CLAY_LOAM: { en: "Clay loam", ar: "طينية طميية" },
  CLAY: { en: "Heavy clay", ar: "طينية ثقيلة" },
};

// API provenance vocabulary (stable codes and the fixed source strings emitted by the backend).
export const PROVENANCE_VARIABLES: Record<string, { en: string; ar: string }> = {
  temperature_and_rainfall: { en: "Temperature and rainfall", ar: "الحرارة وهطول الأمطار" },
  soil_properties: { en: "Soil properties", ar: "خصائص التربة" },
  root_zone_moisture: { en: "Root-zone moisture", ar: "رطوبة منطقة الجذور" },
};

export const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  LIVE: { en: "Live", ar: "مباشر" },
  CACHED: { en: "Cached", ar: "مؤقت" },
  ESTIMATED: { en: "Estimated", ar: "تقديري" },
  FALLBACK: { en: "Fallback", ar: "بيانات بديلة" },
  UNAVAILABLE: { en: "Unavailable", ar: "غير متاح" },
  SENSOR: { en: "Sensor", ar: "مستشعر" },
};

export const SOURCE_LABELS: Record<string, { en: string; ar: string }> = {
  "NASA POWER": { en: "NASA POWER", ar: "NASA POWER" },
  "ISRIC SoilGrids": { en: "ISRIC SoilGrids", ar: "ISRIC SoilGrids" },
  "Demonstration regional profile": { en: "Demonstration regional profile", ar: "ملف إقليمي توضيحي" },
  "Demonstration soil estimate": { en: "Demonstration soil estimate", ar: "تقدير تربة توضيحي" },
  "Optional SMAP adapter not configured": { en: "Optional SMAP adapter not configured", ar: "محوّل SMAP الاختياري غير مُهيّأ" },
  "ESP32 field sensor (device-relative two-point index)": { en: "ESP32 field sensor (device-relative two-point index)", ar: "مستشعر ميداني ESP32 (مؤشر نسبي بنقطتي معايرة)" },
};

// The engine's single warning constant is stable text; it maps exactly.
export const WARNING_LABELS: Record<string, { en: string; ar: string }> = {
  "Regional observations may not reflect field-level drainage, cultivar choice, pest pressure, or seed availability.": {
    en: "Regional observations may not reflect field-level drainage, cultivar choice, pest pressure, or seed availability.",
    ar: "قد لا تعكس الملاحظات الإقليمية صرف الحقل أو اختيار الصنف أو ضغط الآفات أو توفر البذور.",
  },
  "Regional observations may not reflect field drainage, cultivar choice, pest pressure, or seed availability.": {
    en: "Regional observations may not reflect field drainage, cultivar choice, pest pressure, or seed availability.",
    ar: "قد لا تعكس الملاحظات الإقليمية صرف الحقل أو اختيار الصنف أو ضغط الآفات أو توفر البذور.",
  },
};

export const DEMO_LABELS: Record<string, { name: string; country: string; system: string }> = {
  sahel: { name: "الساحل شبه القاحل", country: "السنغال", system: "بعل" },
  iowa: { name: "حزام الذرة في آيوا", country: "الولايات المتحدة", system: "بعل" },
  punjab: { name: "بنجاب / حوض السند", country: "باكستان", system: "مروي" },
  andes: { name: "مزرعة صغيرة في جبال الأنديز", country: "بيرو", system: "بعل" },
  western_australia: { name: "حزام القمح الغربي", country: "أستراليا", system: "بعل" },
};

export const en = {
  meta: { title: "Field Shift — Climate-resilient crop rotations", description: "Compare three-year crop strategies using NASA climate records, estimated soil conditions, and transparent agronomic rules." },
  toggle: { label: "العربية", aria: "Switch to Arabic" },
  nav: { method: "Method", sources: "Data sources", ready: "Analysis ready", demoSafe: "Demo-safe", home: "Field Shift home", primary: "Primary navigation" },
  hero: {
    eyebrow: "NASA-powered decision support",
    h1: "Build crop rotations for a changing climate.",
    lede: "Compare three-year strategies using regional climate records, estimated soil conditions, and transparent agronomic rules.",
    climateHistory: "Climate history", nasa: "NASA POWER",
    soilContext: "Soil context", soilGrids: "ISRIC SoilGrids",
    stressTests: "Stress tests", rainHeat: "Rainfall + heat",
    micro: "Comparative guidance, not a yield forecast. Verify recommendations with local extension guidance before planting.",
  },
  planner: {
    steps: ["Location", "Conditions", "Primary goal", "Review"],
    titles: ["Define the farm", "Current conditions", "What matters most?", "Review the farm"],
    stepAria: "Step", stepAriaOf: "of 4",
    back: "Back", continue: "Continue", analyse: "Analyse rotations",
  },
  band: {
    title: "Regional evidence, clearly labelled",
    items: ["NASA POWER", "ISRIC SoilGrids", "Optional SMAP adapter", "Rule-based MCDA"],
  },
  location: {
    farmsAria: "Demo farms", region: "Selected region", approximateAria: "Approximate selected location",
    useLocation: "Use my location", latitude: "Latitude", longitude: "Longitude",
    customFarm: "Custom farm", customCountry: "Selected location",
    systemRainfed: "Rainfed", systemIrrigated: "Irrigated",
  },
  conditions: {
    currentCrop: "Current crop", cropHelp: "Used to enforce crop-family break rules.",
    soilTexture: "Soil texture", optional: "optional", textureHelp: "Overrides the regional estimate when you know the field.",
    irrigation: "Irrigation available", irrigationHelp: "Include supplemental water when screening crops.",
    note: "Crop reference values are configurable planning parameters, not universal biological constants.",
  },
  priorities: [
    { id: "balanced", label: "Balanced", help: "A practical balance of climate, water, soil and diversity." },
    { id: "drought_resilience", label: "Drought resilience", help: "Put more weight on water fit and drought tolerance." },
    { id: "soil_recovery", label: "Soil recovery", help: "Prioritise legumes, residue and varied root depth." },
    { id: "crop_diversity", label: "Crop diversity", help: "Maximise crop-family and root-profile variety." },
  ],
  review: {
    region: "Region", startingCrop: "Starting crop", irrigationOn: "Irrigation available", irrigationOff: "Rainfed system",
    soilContext: "Soil context", soilHelp: "Regional estimate or supplied value",
    goal: "Primary goal", goalHelp: "Sets transparent MCDA weights",
    shield: "The engine applies hard agronomic filters before scoring any sequence.",
  },
  loading: {
    label: "Regional analysis", h1: "Comparing viable rotations",
    p: "No model is predicting yield. Field Shift is testing transparent crop rules against the available regional evidence.",
    stages: ["Reading regional climate history", "Estimating soil conditions", "Testing crop suitability", "Comparing rotation strategies"],
  },
  results: {
    h1: "Three strategies worth considering.",
    p: "Ranked against the selected goal and current regional evidence. Scores are comparative, not yield estimates.",
    dataStatus: "Data status",
    apiConnected: "Connected to the Field Shift API.",
    apiFallback: "Demonstration estimate — the live API was unavailable or demo mode is active.",
    scenarioApi: "Scenario re-run by the deterministic API engine.",
    scenarioMock: "Scenario calculated with the bundled deterministic demonstration profile.",
    metrics: {
      rainfall: "Seasonal rainfall", heatStress: "Heat stress", soilCondition: "Soil condition", seasonalHeat: "Seasonal heat",
      highRisk: "High heat-stress risk", withinThreshold: "Within configured threshold", gddNote: "Crop-season estimate",
      rainDeficitBig: "Significant rainfall deficit", rainDeficitMod: "Moderate rainfall deficit", rainAbove: "Above-normal rainfall", rainNear: "Near-normal rainfall",
      heatUnit: "days", mm: "mm", gddUnit: "GDD",
    },
    tabsAria: "Result view", tabRanked: "Ranked strategies", tabCompare: "Side-by-side compare",
    toolbar: "Strategy worth considering based on available regional evidence",
    rank: "Rank", sequence: "Three-year sequence", strongestFit: "Strongest fit", year: "Year",
    why: "Why this ranked highly", dimensions: { climate: "Climate", water: "Water", soil: "Soil", diversity: "Diversity" },
    sourceBadge: "EN", sourceBadgeTitle: "Explanation text is provided in English by the analysis engine.",
  },
  scenario: {
    label: "Stress test", h1: "What if conditions shift?",
    p: "Re-run the same deterministic engine under a rainfall or temperature change. Rankings can move when crops cross hard suitability thresholds.",
    rainfallChange: "Rainfall change", temperatureChange: "Temperature change", irrigation: "Irrigation",
    available: "Available", unavailable: "Unavailable", rerun: "Re-run scenario",
  },
  provenance: {
    label: "Evidence trail", h1: "Data provenance",
  },
  responsible: {
    title: "Responsible use",
    p: "Field Shift provides comparative decision support based on regional satellite observations and configurable agronomic rules. Verify recommendations with local extension guidance, field observations, seed availability, and soil testing before planting.",
  },
  method: {
    close: "Close", label: "Methodology", title: "How Field Shift ranks a rotation",
    description: "Every result comes from explicit rules and normalized scores. No LLM or yield-prediction model changes the ranking.",
    steps: [
      { title: "Observe", text: "NASA POWER climate history and SoilGrids estimates establish regional context." },
      { title: "Filter", text: "Hard rules remove crops that fail GDD, pH, water, irrigation, heat, or family-break constraints." },
      { title: "Score", text: "Viable rotations receive climate, water, soil and diversity scores from 0–100." },
      { title: "Explain", text: "The top three materially different strategies show factors, provenance and uncertainty." },
    ],
    formula: "overall = climate × weight + water × weight + soil × weight + diversity × weight",
    limit: "Field Shift cannot determine field drainage, local pest pressure, cultivar performance, future daily weather, seed availability, or exact fertilizer needs.",
  },
  mock: {
    explain1: (crop: string) => `${crop} is comparatively well matched to the regional heat and water profile.`,
    explain2: (crop: string) => `${crop} introduces a contrasting crop family and root pattern.`,
    explain3: "The full sequence respects the configured family-break rules.",
  },
};

export const ar: typeof en = {
  meta: { title: "فيلد شيفت — دورات زراعية قادرة على التكيف مع المناخ", description: "قارن استراتيجيات ثلاثية السنوات باستخدام السجلات المناخية من ناسا وتقديرات حالة التربة وقواعد زراعية شفافة." },
  toggle: { label: "English", aria: "التبديل إلى الإنجليزية" },
  nav: { method: "المنهجية", sources: "مصادر البيانات", ready: "التحليل جاهز", demoSafe: "وضع العرض", home: "الصفحة الرئيسية — فيلد شيفت", primary: "التنقل الرئيسي" },
  hero: {
    eyebrow: "دعم قرارات مدعوم ببيانات ناسا",
    h1: "ابنِ دورات زراعية تتكيّف مع المناخ المتغير.",
    lede: "قارن استراتيجيات ثلاثية السنوات باستخدام السجلات المناخية الإقليمية وتقديرات حالة التربة وقواعد زراعية شفافة.",
    climateHistory: "التاريخ المناخي", nasa: "NASA POWER",
    soilContext: "سياق التربة", soilGrids: "ISRIC SoilGrids",
    stressTests: "اختبارات الإجهاد", rainHeat: "الأمطار والحرارة",
    micro: "إرشادات مقارنة وليست توقعًا للمحصول. تحقق من التوصيات مع الإرشاد الزراعي المحلي قبل الزراعة.",
  },
  planner: {
    steps: ["الموقع", "الظروف", "الهدف الرئيسي", "المراجعة"],
    titles: ["حدّد المزرعة", "الظروف الحالية", "ما الأهم بالنسبة لك؟", "مراجعة بيانات المزرعة"],
    stepAria: "الخطوة", stepAriaOf: "من 4",
    back: "رجوع", continue: "متابعة", analyse: "حلّل الدورات الزراعية",
  },
  band: {
    title: "أدلة إقليمية موسومة بوضوح",
    items: ["NASA POWER", "ISRIC SoilGrids", "محوّل SMAP الاختياري", "تحليل MCDA قائم على قواعد"],
  },
  location: {
    farmsAria: "مزارع العرض التوضيحي", region: "المنطقة المختارة", approximateAria: "الموقع التقريبي المختار",
    useLocation: "استخدم موقعي", latitude: "خط العرض", longitude: "خط الطول",
    customFarm: "مزرعة مخصصة", customCountry: "الموقع المحدد",
    systemRainfed: "بعل", systemIrrigated: "مروي",
  },
  conditions: {
    currentCrop: "المحصول الحالي", cropHelp: "يُستخدم لتطبيق قواعد الفصل بين الفصائل الزراعية.",
    soilTexture: "قوام التربة", optional: "اختياري", textureHelp: "يستبدل التقدير الإقليمي عندما تعرف حالة حقلك.",
    irrigation: "توفر الري", irrigationHelp: "احتسب المياه التكميلية عند فحص المحاصيل.",
    note: "قيم المحاصيل المرجعية معايير تخطيط قابلة للضبط، وليست ثوابت بيولوجية عامة.",
  },
  priorities: [
    { id: "balanced", label: "متوازن", help: "توازن عملي بين المناخ والمياه والتربة والتنوع." },
    { id: "drought_resilience", label: "الصمود أمام الجفاف", help: "إعطاء وزن أكبر لملاءمة المياه والتحمل للجفاف." },
    { id: "soil_recovery", label: "استعادة خصوبة التربة", help: "إعطاء الأولوية للبقوليات والمخلفات وتنوع أعماق الجذور." },
    { id: "crop_diversity", label: "تنوع المحاصيل", help: "تعظيم تنوع الفصائل الزراعية وملامح الجذور." },
  ],
  review: {
    region: "المنطقة", startingCrop: "المحصول البداية", irrigationOn: "توفر الري", irrigationOff: "نظام بعل",
    soilContext: "سياق التربة", soilHelp: "تقدير إقليمي أو قيمة مُدخلة",
    goal: "الهدف الرئيسي", goalHelp: "يحدد أوزان تحليل MCDA الشفافة",
    shield: "يطبّق المحرك مرشحات زراعية صارمة قبل تقييم أي دورة.",
  },
  loading: {
    label: "تحليل إقليمي", h1: "جارٍ مقارنة الدورات القابلة للتطبيق",
    p: "لا يتنبأ أي نموذج بالمحصول. يقوم فيلد شيفت باختبار قواعد محاصيل شفافة مقابل الأدلة الإقليمية المتاحة.",
    stages: ["قراءة التاريخ المناخي الإقليمي", "تقدير حالة التربة", "فحص ملاءمة المحاصيل", "مقارنة استراتيجيات الدوران"],
  },
  results: {
    h1: "ثلاث استراتيجيات جديرة بالاعتبار.",
    p: "مرتبة وفق الهدف المختار والأدلة الإقليمية الحالية. الدرجات مقارنة وليست تقديرًا للمحصول.",
    dataStatus: "حالة البيانات",
    apiConnected: "تم الاتصال بواجهة فيلد شيفت البرمجية.",
    apiFallback: "تقدير توضيحي — لم تكن الواجهة المباشرة متاحة أو وضع العرض مفعّل.",
    scenarioApi: "أُعيد تشغيل السيناريو بواسطة محرك الواجهة الحتمي.",
    scenarioMock: "حُسب السيناريو بملف العرض التوضيحي الحتمي المضمّن.",
    metrics: {
      rainfall: "هطول موسمي", heatStress: "الإجهاد الحراري", soilCondition: "حالة التربة", seasonalHeat: "حرارة الموسم",
      highRisk: "خطر حرارة مرتفع", withinThreshold: "ضمن الحد المُهيّأ", gddNote: "تقدير موسم المحصول",
      rainDeficitBig: "عجز كبير في الأمطار", rainDeficitMod: "عجز متوسط في الأمطار", rainAbove: "أمطار فوق المعدل", rainNear: "أمطار قريبة من المعدل",
      heatUnit: "يوم", mm: "مم", gddUnit: "GDD",
    },
    tabsAria: "عرض النتائج", tabRanked: "الاستراتيجيات المرتبة", tabCompare: "مقارنة جنبًا إلى جنب",
    toolbar: "استراتيجية جديرة بالاعتبار وفق الأدلة الإقليمية المتاحة",
    rank: "الترتيب", sequence: "دورة ثلاثية السنوات", strongestFit: "الأكثر ملاءمة", year: "السنة",
    why: "لماذا تصدّرت هذه الدورة", dimensions: { climate: "المناخ", water: "المياه", soil: "التربة", diversity: "التنوع" },
    sourceBadge: "EN", sourceBadgeTitle: "نص التوضيح يُقدَّم بالإنجليزية من محرك التحليل.",
  },
  scenario: {
    label: "اختبار إجهاد", h1: "ماذا لو تغيّرت الظروف؟",
    p: "أعد تشغيل المحرك الحتمي نفسه عند تغيّر في الأمطار أو الحرارة. قد تتغير الترتيبات عندما تتجاوز المحاصيل عتبات الملاءمة الصارمة.",
    rainfallChange: "التغيّر في الأمطار", temperatureChange: "التغيّر في الحرارة", irrigation: "الري",
    available: "متاح", unavailable: "غير متاح", rerun: "إعادة تشغيل السيناريو",
  },
  provenance: {
    label: "مسار الأدلة", h1: "مصدر البيانات",
  },
  responsible: {
    title: "الاستخدام المسؤول",
    p: "يقدّم فيلد شيفت دعمًا مقارنًا للقرارات بناءً على مرئيات إقليمية من الأقمار الصناعية وقواعد زراعية قابلة للضبط. تحقق من التوصيات مع الإرشاد المحلي وملاحظات الحقل وتوفر البذور وتحليل التربة قبل الزراعة.",
  },
  method: {
    close: "إغلاق", label: "المنهجية", title: "كيف يرتّب فيلد شيفت الدورة الزراعية",
    description: "كل نتيجة تأتي من قواعد صريحة ودرجات معيارية. لا يغيّر أي نموذج لغوي أو توقع محصول هذا الترتيب.",
    steps: [
      { title: "الرصد", text: "يؤسس تاريخ NASA POWER المناخي وتقديرات SoilGrids السياق الإقليمي." },
      { title: "التصفية", text: "تستبعد القواعد الصارمة المحاصيل غير المستوفية لمعايير GDD والحموضة والمياه والري والحرارة وفصل الفصائل." },
      { title: "التقييم", text: "تحصل الدورات القابلة للتطبيق على درجات مناخ ومياه وتربة وتنوع من 0 إلى 100." },
      { title: "التوضيح", text: "تعرض أفضل ثلاث استراتيجيات متمايزة العوامل ومصادر البيانات ودرجة عدم اليقين." },
    ],
    formula: "الدرجة الكلية = المناخ × الوزن + المياه × الوزن + التربة × الوزن + التنوع × الوزن",
    limit: "لا يستطيع فيلد شيفت تحديد صرف الحقل أو ضغط الآفات المحلي أو أداء الأصناف أو طقس الأيام المستقبلية أو توفر البذور أو احتياجات التسميد الدقيقة.",
  },
  mock: {
    explain1: (crop: string) => `«${crop}» ملاءمته نسبيًا جيدة لملف الحرارة والمياه الإقليمي.`,
    explain2: (crop: string) => `تُدخل «${crop}» فصيلًا زراعيًا ونمط جذور مغايرين.`,
    explain3: "تحترم الدورة كاملة قواعد الفصل بين الفصائل المُهيّأة.",
  },
};

export const DICTS: Record<Lang, typeof en> = { en, ar };
