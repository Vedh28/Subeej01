export interface RecommendationInput {
  seed_name: string;
  seed_variety: string;
  seed_type: string;
  seed_quality: string;
  suitable_land_type_for_seed: string;
  field_quality: string;
  field_history_or_crops: string;
  field_composition: string;
  moisture: number;
  humidity: number;
  rainfall: number;
  temperature: number;
  state: string;
  district: string;
  suitable_crop_for_field: string;
  season?: string;
}

export interface DatasetRow {
  row_id: number;
  seed_name: string;
  seed_variety: string;
  seed_type: string;
  seed_quality: string;
  crop: string;
  season: string;
  soil_type: string;
  field_composition: string;
  soil_ph: number;
  temperature: number;
  humidity: number;
  rainfall: number;
  moisture: number;
  field_quality: string;
  field_history: string;
  state: string;
  district: string;
  recommended_crop: string;
  recommended_seed: string;
  area: number;
  production: number;
  yield: number;
}

export interface RowScore {
  row: DatasetRow;
  score: number;
  matched_features: string[];
  score_breakdown: Record<string, number>;
  agronomic_evaluation?: {
    penalty: number;
    adjusted_score: number;
    status: "Suitable" | "Suitable with conditions" | "Not suitable";
    rule_reasons: string[];
    notes: string[];
  };
}

export interface RecommendationOutput {
  recommended_crop: string;
  recommended_seed: string;
  confidence_score: number;
  reason: string;
  matched_features: string[];
  source_rows_used: number[];
}

export interface RecommendationDebug {
  request_id: string;
  input: RecommendationInput;
  top_matches: RowScore[];
  ranking_summary: string;
  llm_prompt: string;
  llm_raw_response: string;
  agronomic_summary?: string;
}
