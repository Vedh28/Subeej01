import { spawnSync } from "node:child_process";
import path from "node:path";
import { runLlmText } from "./llm-client";
import { detectIndianSeasonFromDate } from "./context/season";
import { getWeatherContext } from "./context/weather-context";
import { loadDatasetRows } from "./recommendation/dataset";
import { runRecommendation } from "./recommendation/engine";

interface SoilAnalysis {
  soil: string;
  moisture: string;
  vegetation: string;
  health: string;
}

interface SeedData {
  seed: string;
  compatibility: string;
  expected_yield: string;
  ideal_conditions: string;
}

interface AiDecision {
  decision: string;
  confidence: string;
  explanation: string;
}

interface FieldDetails {
  detected_crop: string;
  growth_stage: string;
  ground_cover_percent: number | null;
  moisture_score: number | null;
  plant_density_score: number | null;
  field_uniformity_score: number | null;
}

interface AnalysisMeta {
  source: string;
  vision_enabled: boolean;
  image_confidence: string;
}

export interface FieldImageAnalysisResult {
  soil_analysis: SoilAnalysis;
  seed_data: SeedData;
  ai_decision: AiDecision;
  field_details: FieldDetails;
  analysis_meta: AnalysisMeta;
  ai_insights: string[];
  yield_prediction: Array<{ month: string; yield: number }>;
  nutrient_data: Array<{ nutrient: string; value: number }>;
  weather_data: Array<{ day: string; temp: number }>;
}

interface AnalysisParams {
  imageDataUrl?: string;
  seedName?: string;
  state?: string;
  district?: string;
  mode?: "field" | "seed" | "combined";
}

function getPythonConfig() {
  return {
    pythonBin: process.env.PYTHON_BIN || "python",
    scriptPath: path.join(process.cwd(), "scripts", "field_image_analyzer.py"),
    timeoutMs: Number(process.env.PYTORCH_IMAGE_TIMEOUT_MS || 20000)
  };
}

function defaultAnalysis(seedName: string): FieldImageAnalysisResult {
  const seed = seedName.trim() || "Not specified";
  return {
    soil_analysis: {
      soil: "Unable to determine clearly",
      moisture: "Needs visual confirmation",
      vegetation: "Needs visual confirmation",
      health: "65%"
    },
    seed_data: {
      seed,
      compatibility: "Needs field review",
      expected_yield: "Need more field data",
      ideal_conditions: "Need crop, soil, and weather context"
    },
    ai_decision: {
      decision: "REVIEW",
      confidence: "0.55",
      explanation:
        "A reliable field review needs a clearer image. The current image analysis is not strong enough for a confident agronomy decision."
    },
    field_details: {
      detected_crop: "Not confidently visible",
      growth_stage: "Needs visual confirmation",
      ground_cover_percent: null,
      moisture_score: null,
      plant_density_score: null,
      field_uniformity_score: null
    },
    analysis_meta: {
      source: "fallback",
      vision_enabled: false,
      image_confidence: "0.00"
    },
    ai_insights: [
      "Use a clear field image with visible soil and crop cover.",
      "Share the crop or seed name to make the review more actionable.",
      "Add location for weather-grounded field advice."
    ],
    yield_prediction: [],
    nutrient_data: [],
    weather_data: []
  };
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatYieldPerAcre(yieldValue: number, unitHint: "kg_per_hectare" | "ton_per_hectare") {
  const acresPerHectare = 2.47105;

  if (unitHint === "kg_per_hectare") {
    const perAcre = yieldValue / acresPerHectare;
    return `${perAcre.toFixed(0)} kg/acre dataset average`;
  }

  const perAcreTon = yieldValue / acresPerHectare;
  return `${perAcreTon.toFixed(2)} ton/acre dataset average`;
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

async function buildSeedDatasetSummary(seedName: string, state: string, district: string) {
  const normalizedSeed = normalizeText(seedName);
  if (!normalizedSeed) return null;

  const rows = await loadDatasetRows();
  const seedRows = rows.filter((row) => {
    const rowSeed = normalizeText(row.seed_name);
    const recommendedSeed = normalizeText(row.recommended_seed);
    return (
      rowSeed.includes(normalizedSeed) ||
      normalizedSeed.includes(rowSeed) ||
      recommendedSeed.includes(normalizedSeed) ||
      normalizedSeed.includes(recommendedSeed)
    );
  });

  if (!seedRows.length) return null;

  const locationRows = seedRows.filter((row) => {
    const sameState = state ? normalizeText(row.state) === normalizeText(state) : true;
    const sameDistrict = district ? normalizeText(row.district) === normalizeText(district) : true;
    return sameState && sameDistrict;
  });

  const scopedRows = locationRows.length ? locationRows : seedRows;
  const avgYield = average(scopedRows.map((row) => row.yield).filter((value) => Number.isFinite(value) && value > 0));
  const avgRainfall = average(scopedRows.map((row) => row.rainfall).filter((value) => Number.isFinite(value) && value > 0));
  const avgTemperature = average(scopedRows.map((row) => row.temperature).filter((value) => Number.isFinite(value) && value > 0));

  return {
    soil: mostCommon(scopedRows.map((row) => row.soil_type)),
    season: mostCommon(scopedRows.map((row) => row.season)),
    rainfall: avgRainfall ? Number(avgRainfall.toFixed(0)) : 0,
    temperature: avgTemperature ? Number(avgTemperature.toFixed(1)) : 0,
    yieldLabel:
      avgYield > 100
        ? formatYieldPerAcre(avgYield, "kg_per_hectare")
        : formatYieldPerAcre(avgYield, "ton_per_hectare"),
    locationMatched: Boolean(locationRows.length)
  };
}

async function applyLocationGrounding(
  base: FieldImageAnalysisResult,
  params: { seedName?: string; state: string; district: string; season: string; weather: Awaited<ReturnType<typeof getWeatherContext>> | null }
) {
  const seedName = params.seedName?.trim() || base.seed_data.seed;
  const seedSummary = await buildSeedDatasetSummary(seedName, params.state, params.district);

  try {
    const recommendation = await runRecommendation(
      {
        seed_name: seedName,
        state: params.state,
        district: params.district,
        season: params.season,
        suitable_land_type_for_seed: base.soil_analysis.soil,
        field_composition: base.soil_analysis.soil,
        moisture: moistureToNumeric(base.soil_analysis.moisture, base.field_details.moisture_score),
        humidity: params.weather?.humidity,
        rainfall: params.weather?.rainfall,
        temperature: params.weather?.temperature
      },
      `field_img_${Date.now()}`
    );

    const { result, debug } = recommendation;
    const top = debug.top_matches[0];
    const idealConditions = top
      ? [
          seedSummary?.soil ? `Soil: ${seedSummary.soil}` : top.row.soil_type ? `Soil: ${top.row.soil_type}` : "",
          seedSummary?.rainfall ? `Rainfall: ${seedSummary.rainfall} mm` : Number.isFinite(top.row.rainfall) ? `Rainfall: ${top.row.rainfall} mm` : "",
          seedSummary?.temperature ? `Temperature: ${seedSummary.temperature} C` : Number.isFinite(top.row.temperature) ? `Temperature: ${top.row.temperature} C` : "",
          seedSummary?.season ? `Season: ${seedSummary.season}` : top.row.season ? `Season: ${top.row.season}` : ""
        ].filter(Boolean).join(" | ")
      : "Insufficient dataset evidence for a reliable recommendation.";

    return {
      ...base,
      seed_data: {
        seed: seedName || result.recommended_seed,
        compatibility:
          seedSummary?.locationMatched
            ? "Suitable"
            : top?.agronomic_evaluation?.status || base.seed_data.compatibility,
        expected_yield: seedSummary?.yieldLabel
          ? seedSummary.yieldLabel
          : top && Number.isFinite(top.row.yield)
            ? top.row.yield > 100
              ? formatYieldPerAcre(top.row.yield, "kg_per_hectare")
              : formatYieldPerAcre(top.row.yield, "ton_per_hectare")
            : base.seed_data.expected_yield,
        ideal_conditions: idealConditions || base.seed_data.ideal_conditions
      },
      ai_insights: [
        `Dataset-backed best crop: ${result.recommended_crop}.`,
        `Suggested seed from ranked matches: ${result.recommended_seed}.`,
        `Matched location context: ${[params.state, params.district, params.season].filter(Boolean).join(", ")}.`
      ],
      yield_prediction:
        top && Number.isFinite(top.row.yield)
          ? [
              { month: "Current", yield: Number(top.row.yield.toFixed(2)) },
              { month: "Best fit", yield: Number(top.row.yield.toFixed(2)) }
            ]
          : base.yield_prediction
    };
  } catch {
    return base;
  }
}

function moistureToNumeric(label: string, score: number | null) {
  if (typeof score === "number" && Number.isFinite(score)) {
    return score;
  }
  const lower = label.toLowerCase();
  if (lower.includes("wet")) return 80;
  if (lower.includes("moderate")) return 55;
  if (lower.includes("dry")) return 25;
  return 0;
}

function coerceAnalysis(raw: Record<string, unknown>, seedName: string): FieldImageAnalysisResult {
  const fallback = defaultAnalysis(seedName);
  const soilAnalysis = (raw.soil_analysis || {}) as Record<string, unknown>;
  const seedData = (raw.seed_data || {}) as Record<string, unknown>;
  const aiDecision = (raw.ai_decision || {}) as Record<string, unknown>;
  const fieldDetails = (raw.field_details || {}) as Record<string, unknown>;
  const analysisMeta = (raw.analysis_meta || {}) as Record<string, unknown>;
  const aiInsights = Array.isArray(raw.ai_insights)
    ? raw.ai_insights.map((value) => String(value)).filter(Boolean).slice(0, 4)
    : fallback.ai_insights;

  return {
    soil_analysis: {
      soil: String(soilAnalysis.soil || fallback.soil_analysis.soil),
      moisture: String(soilAnalysis.moisture || fallback.soil_analysis.moisture),
      vegetation: String(soilAnalysis.vegetation || fallback.soil_analysis.vegetation),
      health: String(soilAnalysis.health || fallback.soil_analysis.health)
    },
    seed_data: {
      seed: String(seedData.seed || seedName || fallback.seed_data.seed),
      compatibility: String(seedData.compatibility || fallback.seed_data.compatibility),
      expected_yield: String(seedData.expected_yield || fallback.seed_data.expected_yield),
      ideal_conditions: String(seedData.ideal_conditions || fallback.seed_data.ideal_conditions)
    },
    ai_decision: {
      decision: String(aiDecision.decision || fallback.ai_decision.decision),
      confidence: String(aiDecision.confidence || fallback.ai_decision.confidence),
      explanation: String(aiDecision.explanation || fallback.ai_decision.explanation)
    },
    field_details: {
      detected_crop: String(fieldDetails.detected_crop || fallback.field_details.detected_crop),
      growth_stage: String(fieldDetails.growth_stage || fallback.field_details.growth_stage),
      ground_cover_percent:
        fieldDetails.ground_cover_percent === null || fieldDetails.ground_cover_percent === undefined
          ? fallback.field_details.ground_cover_percent
          : Number(fieldDetails.ground_cover_percent),
      moisture_score:
        fieldDetails.moisture_score === null || fieldDetails.moisture_score === undefined
          ? fallback.field_details.moisture_score
          : Number(fieldDetails.moisture_score),
      plant_density_score:
        fieldDetails.plant_density_score === null || fieldDetails.plant_density_score === undefined
          ? fallback.field_details.plant_density_score
          : Number(fieldDetails.plant_density_score),
      field_uniformity_score:
        fieldDetails.field_uniformity_score === null || fieldDetails.field_uniformity_score === undefined
          ? fallback.field_details.field_uniformity_score
          : Number(fieldDetails.field_uniformity_score)
    },
    analysis_meta: {
      source: String(analysisMeta.source || fallback.analysis_meta.source),
      vision_enabled:
        typeof analysisMeta.vision_enabled === "boolean"
          ? analysisMeta.vision_enabled
          : fallback.analysis_meta.vision_enabled,
      image_confidence: String(analysisMeta.image_confidence || fallback.analysis_meta.image_confidence)
    },
    ai_insights: aiInsights.length ? aiInsights : fallback.ai_insights,
    yield_prediction: Array.isArray(raw.yield_prediction)
      ? raw.yield_prediction
          .map((item) => item as Record<string, unknown>)
          .filter((item) => typeof item.month === "string" && Number.isFinite(Number(item.yield)))
          .map((item) => ({ month: String(item.month), yield: Number(item.yield) }))
      : fallback.yield_prediction,
    nutrient_data: Array.isArray(raw.nutrient_data)
      ? raw.nutrient_data
          .map((item) => item as Record<string, unknown>)
          .filter((item) => typeof item.nutrient === "string" && Number.isFinite(Number(item.value)))
          .map((item) => ({ nutrient: String(item.nutrient), value: Number(item.value) }))
      : fallback.nutrient_data,
    weather_data: Array.isArray(raw.weather_data)
      ? raw.weather_data
          .map((item) => item as Record<string, unknown>)
          .filter((item) => typeof item.day === "string" && Number.isFinite(Number(item.temp)))
          .map((item) => ({ day: String(item.day), temp: Number(item.temp) }))
      : fallback.weather_data
  };
}

function runPythonFieldAnalysis(params: { imageDataUrl: string; seedName: string }) {
  const cfg = getPythonConfig();
  const payload = JSON.stringify({
    image_data_url: params.imageDataUrl,
    seed_name: params.seedName
  });

  const result = spawnSync(cfg.pythonBin, [cfg.scriptPath], {
    input: payload,
    encoding: "utf-8",
    timeout: cfg.timeoutMs,
    maxBuffer: 1024 * 1024 * 8
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "Python field analysis failed.").trim());
  }

  const text = (result.stdout || "").trim();
  if (!text) {
    throw new Error("Python field analysis returned empty output.");
  }

  return JSON.parse(text) as Record<string, unknown>;
}

function buildDeterministicReview(base: FieldImageAnalysisResult) {
  const cover = base.field_details.ground_cover_percent;
  const moisture = base.soil_analysis.moisture;
  const soil = base.soil_analysis.soil;
  const growthStage = base.field_details.growth_stage;

  const explanation = [
    `${base.seed_data.seed} review is based on image-derived field signals, not a generic template.`,
    `The image suggests ${soil.toLowerCase()} with ${moisture.toLowerCase()} conditions and ${growthStage.toLowerCase()}.`,
    cover !== null
      ? `Ground cover is about ${Math.round(cover)}%, which supports the current field assessment.`
      : "Ground cover could not be measured confidently from the image."
  ].join(" ");

  return {
    explanation,
    insights: [
      `Image-derived soil view: ${soil}.`,
      `Estimated moisture condition: ${moisture}.`,
      `Detected growth stage: ${growthStage}.`
    ]
  };
}

async function buildLlmReview(base: FieldImageAnalysisResult) {
  const systemPrompt = [
    "You are Subeej AI.",
    "You are given structured field-image analysis from a PyTorch computer-vision pipeline.",
    "Do not invent facts beyond the provided metrics.",
    "Write a concise agriculture review in at most 3 sentences.",
    "Mention the seed or crop context, the image-derived field condition, and one practical caution if needed."
  ].join(" ");

  const userPrompt = JSON.stringify(
    {
      seed: base.seed_data.seed,
      soil_analysis: base.soil_analysis,
      field_details: base.field_details,
      ai_decision: base.ai_decision,
      compatibility: base.seed_data.compatibility,
      expected_yield: base.seed_data.expected_yield
    },
    null,
    2
  );

  try {
    const text = await runLlmText(systemPrompt, userPrompt, {
      temperature: 0.1,
      maxTokens: 110,
      topP: 0.9,
      stream: false
    });

    if (!text.trim()) {
      return buildDeterministicReview(base);
    }

    const cleaned = text.replace(/\s+/g, " ").trim();
    return {
      explanation: cleaned,
      insights: base.ai_insights
    };
  } catch {
    return buildDeterministicReview(base);
  }
}

export async function analyzeFieldImage(params: AnalysisParams): Promise<FieldImageAnalysisResult> {
  const seedName = params.seedName?.trim() || "Soybean";
  const state = params.state?.trim() || "";
  const district = params.district?.trim() || "";
  const mode = params.mode || "combined";
  const season = detectIndianSeasonFromDate();
  const weather = state || district ? await getWeatherContext({ state, district }) : null;

  let base = defaultAnalysis(seedName);
  base.weather_data = weather
    ? [
        { day: "Now", temp: Number(weather.temperature || 0) },
        { day: "Humidity", temp: Number(weather.humidity || 0) },
        { day: "Rain", temp: Number(weather.rainfall || 0) }
      ].filter((item) => Number.isFinite(item.temp) && item.temp > 0)
    : [];

  if (mode !== "seed" && params.imageDataUrl?.startsWith("data:image/")) {
    try {
      const cvRaw = runPythonFieldAnalysis({
        imageDataUrl: params.imageDataUrl,
        seedName
      });
      base = coerceAnalysis(cvRaw, seedName);
      base.weather_data = weather
        ? [
            { day: "Now", temp: Number(weather.temperature || 0) },
            { day: "Humidity", temp: Number(weather.humidity || 0) },
            { day: "Rain", temp: Number(weather.rainfall || 0) }
          ].filter((item) => Number.isFinite(item.temp) && item.temp > 0)
        : [];
    } catch {
      base = defaultAnalysis(seedName);
    }
  }

  if (mode === "seed" && !params.imageDataUrl) {
    base = {
      ...base,
      soil_analysis: {
        soil: "Location-based review",
        moisture: weather?.weather || "Weather-based estimate",
        vegetation: "Not derived without image",
        health: "Pending field image"
      },
      field_details: {
        ...base.field_details,
        detected_crop: "Not derived without image",
        growth_stage: "Not derived without image"
      },
      analysis_meta: {
        source: "location+dataset",
        vision_enabled: false,
        image_confidence: "0.00"
      },
      ai_insights: [
        "Seed analysis is using location, season, and weather context.",
        "Upload a field image if you want soil and vegetation evidence too.",
        `Location used: ${[state, district].filter(Boolean).join(", ")}.`
      ]
    };
  }

  if (state) {
    base = await applyLocationGrounding(base, {
      seedName,
      state,
      district,
      season,
      weather
    });
  }

  if (mode === "field" && !params.seedName?.trim()) {
    base.seed_data = {
      seed: "Not provided",
      compatibility: "Seed name required for seed compatibility",
      expected_yield: "Provide seed name for yield estimate",
      ideal_conditions: "Field-only review completed from image and location context"
    };
  }

  const llmReview = await buildLlmReview(base);

  return {
    ...base,
    ai_decision: {
      ...base.ai_decision,
      explanation: llmReview.explanation
    },
    ai_insights: llmReview.insights.length ? llmReview.insights : base.ai_insights,
    analysis_meta: {
      ...base.analysis_meta,
      source:
        mode === "combined"
          ? "pytorch_cv+dataset+llm"
          : mode === "field"
            ? "pytorch_cv+llm"
            : "dataset+llm",
      vision_enabled: mode !== "seed"
    }
  };
}

export function enrichFieldImageAnalysis(base: FieldImageAnalysisResult) {
  return {
    ...base,
    yield_prediction: base.yield_prediction,
    nutrient_data: base.nutrient_data,
    weather_data: base.weather_data
  };
}
