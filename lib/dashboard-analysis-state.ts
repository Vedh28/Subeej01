export const defaultDashboardAnalysis = {
  soil_analysis: {
    soil: "Awaiting image review",
    moisture: "Awaiting image review",
    vegetation: "Awaiting image review",
    health: "Not reviewed"
  },
  seed_data: {
    seed: "",
    compatibility: "Awaiting analysis",
    expected_yield: "Need image and field review",
    ideal_conditions: "Need crop, soil, and weather context"
  },
  ai_decision: {
    decision: "REVIEW",
    confidence: "0.00",
    explanation:
      "Upload a field image and run analysis to generate field and seed intelligence."
  },
  field_details: {
    detected_crop: "Not reviewed",
    growth_stage: "Not reviewed",
    ground_cover_percent: null as number | null,
    moisture_score: null as number | null,
    plant_density_score: null as number | null,
    field_uniformity_score: null as number | null
  },
  analysis_meta: {
    source: "fallback",
    vision_enabled: false,
    image_confidence: "0.00"
  },
  yield_prediction: [] as Array<{ month: string; yield: number }>,
  nutrient_data: [] as Array<{ nutrient: string; value: number }>,
  weather_data: [] as Array<{ day: string; temp: number }>,
  ai_insights: [
    "Field intelligence will appear after image analysis.",
    "Seed intelligence needs both image evidence and crop context.",
    "Use a vision-capable model for image-based AI review."
  ],
  image_url: "",
  seed_name: "",
  state: "",
  district: "",
  last_mode: "combined" as "field" | "seed" | "combined"
};

export type DashboardAnalysisState = typeof defaultDashboardAnalysis;

let inMemoryDashboardAnalysisState: DashboardAnalysisState = defaultDashboardAnalysis;

export function readDashboardAnalysisState() {
  return inMemoryDashboardAnalysisState;
}

export function writeDashboardAnalysisState(value: DashboardAnalysisState) {
  inMemoryDashboardAnalysisState = value;
}
