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

export type SequenceItem = {
  year: number;
  crop_id: string;
  name: string;
};

export type ScoreSet = {
  overall: number;
  climate: number;
  water: number;
  soil: number;
  diversity: number;
};

export type Rotation = {
  rank: number;
  sequence: SequenceItem[];
  scores: ScoreSet;
  explanations: string[];
  warnings: string[];
  factors?: Record<string, string[]>;
};

export type DataStatus = string;

export type EnvironmentalContext = {
  annual_gdd: number;
  seasonal_rainfall_mm: number;
  historical_rainfall_mm: number;
  precipitation_anomaly_pct: number;
  rainfall_status: string;
  heat_stress_days: number;
  soil_moisture_state: string;
  soil_moisture_index?: number | null;
  soil_texture: string;
  soil_texture_source?: string;
  soil_ph: number;
  soil_organic_matter_pct: number;
  effective_water_mm?: number | null;
  crop_gdd?: Record<string, number>;
  crop_heat_stress_days?: Record<string, number>;
  data_quality?: Record<string, string>;
};

export type Provenance = {
  variable: string;
  source: string;
  status: string;
  unit?: string | null;
  observation_period?: string | null;
  retrieval_timestamp?: string | null;
};

export type Decision = {
  passed: boolean;
  rule: string;
  reason: string;
};

export type Evaluation = {
  status: string;
  evaluation_id: string;
  environmental_context: EnvironmentalContext;
  data_provenance: Provenance[];
  recommended_rotations: Rotation[];
  rejected_examples?: Decision[];
};

export type Demo = {
  id: string;
  name: string;
  country: string;
  system: string;
  latitude: number;
  longitude: number;
  currentCrop: string;
  soil: string;
  irrigated: boolean;
  priority: string;
};
