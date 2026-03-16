import "dotenv/config";
import cors from "cors";
import express from "express";
import { handleUserMessage } from "../lib/chat-controller";
import { analyzeFieldImage, enrichFieldImageAnalysis } from "../lib/field-image-analysis";
import { checkLlmHealth } from "../lib/llm-health";
import { loadDatasetRows } from "../lib/recommendation/dataset";
import { runRecommendation } from "../lib/recommendation/engine";
import type { RecommendationInput } from "../lib/recommendation/types";

interface RecommendationRequestBody {
  field_input?: Partial<RecommendationInput>;
}

interface ChatRequestBody {
  message?: string;
  session_id?: string;
  history?: Array<{ role?: string; content?: string }>;
  image_present?: boolean;
}

interface FieldAnalysisBody {
  image_data_url?: string;
  seed_name?: string;
  state?: string;
  district?: string;
  mode?: "field" | "seed" | "combined";
}

type SeedVisualProfile = {
  shape: "sphere" | "oval" | "flat-oval" | "elongated" | "kidney";
  scale: [number, number, number];
  baseColor: string;
  accentColor: string;
  gloss: number;
  roughness: number;
  speckle: boolean;
};

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function requestId() {
  return `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeKey(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function pickTop<T extends string>(counts: Map<T, number>) {
  let best = "" as T;
  let bestCount = 0;
  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

function pickTopN(counts: Map<string, number>, n = 3) {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([value]) => value);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function colorFromCrop(crop: string) {
  const value = crop.toLowerCase();
  if (value.includes("cotton")) return "#f3f0e8";
  if (value.includes("rice")) return "#e9e1cf";
  if (value.includes("wheat")) return "#d9b26e";
  if (value.includes("maize") || value.includes("corn")) return "#e6c34f";
  if (value.includes("soy")) return "#a57b4b";
  if (value.includes("bajra") || value.includes("millet")) return "#c8a070";
  if (value.includes("groundnut") || value.includes("peanut")) return "#c28b5a";
  return "#9a764f";
}

function shapeFromSeedType(seedType: string, crop: string): SeedVisualProfile["shape"] {
  const type = seedType.toLowerCase();
  const cropName = crop.toLowerCase();
  if (cropName.includes("rice")) return "elongated";
  if (cropName.includes("wheat")) return "oval";
  if (cropName.includes("cotton")) return "kidney";
  if (cropName.includes("soy")) return "oval";
  if (type.includes("hyv")) return "flat-oval";
  if (type.includes("hybrid")) return "oval";
  return "sphere";
}

function buildSeedMatchSummary(rows: Awaited<ReturnType<typeof loadDatasetRows>>, seedName: string) {
  const normalizedSeed = normalize(seedName);
  const matches = rows.filter((row) => {
    const seed = normalize(row.seed_name || "");
    const recommended = normalize(row.recommended_seed || "");
    return seed.includes(normalizedSeed) || recommended.includes(normalizedSeed);
  });

  const scope = matches.length ? matches : rows.filter((row) => normalize(row.seed_name || "").includes(normalizedSeed));
  const crops = new Map<string, number>();
  const types = new Map<string, number>();
  const qualities = new Map<string, number>();

  for (const row of scope) {
    const crop = String(row.recommended_crop || row.crop || "").trim();
    const type = String(row.seed_type || "").trim();
    const quality = String(row.seed_quality || "").trim();
    if (crop) crops.set(crop, (crops.get(crop) || 0) + 1);
    if (type) types.set(type, (types.get(type) || 0) + 1);
    if (quality) qualities.set(quality, (qualities.get(quality) || 0) + 1);
  }

  return {
    matchCount: scope.length,
    topCrop: pickTop(crops),
    topSeedType: pickTop(types),
    topSeedQuality: pickTop(qualities)
  };
}

function profileFromSeed(seedName: string, matches: ReturnType<typeof buildSeedMatchSummary>): SeedVisualProfile {
  const crop = matches.topCrop || "";
  const seedType = matches.topSeedType || "";
  const seedQuality = matches.topSeedQuality || "";
  const baseColor = colorFromCrop(crop);
  const accentColor = seedQuality.toLowerCase().includes("fresh") ? "#e8d9c2" : "#8b6a45";
  const shape = shapeFromSeedType(seedType, crop);

  let scale: [number, number, number] = [1.1, 0.75, 0.75];
  if (shape === "elongated") scale = [1.5, 0.5, 0.5];
  if (shape === "flat-oval") scale = [1.3, 0.55, 0.8];
  if (shape === "kidney") scale = [1.35, 0.65, 0.85];
  if (shape === "sphere") scale = [1.0, 1.0, 1.0];

  const gloss = seedQuality.toLowerCase().includes("fresh") ? 0.35 : 0.15;
  const roughness = seedQuality.toLowerCase().includes("fresh") ? 0.45 : 0.7;
  const speckle = seedName.toLowerCase().includes("bt") || seedType.toLowerCase().includes("hyv");

  return { shape, scale, baseColor, accentColor, gloss, roughness, speckle };
}

const palette = ["#2f7d4c", "#7a5c3e", "#2f6f73", "#9c6b3f", "#4062bb", "#8f3b76", "#4d9078", "#c56b3c", "#6b6b83", "#1f7a8c", "#7a6bbd", "#b26b3b"];

function buildColorMap(values: string[]) {
  const map: Record<string, string> = {};
  Array.from(new Set(values.filter(Boolean))).forEach((value, index) => {
    map[value] = palette[index % palette.length];
  });
  return map;
}

function buildLayerMappings(rows: Awaited<ReturnType<typeof loadDatasetRows>>, key: "soil_type" | "seed_type" | "field_quality" | "field_history" | "field_composition") {
  const districtCounts = new Map<string, Map<string, number>>();
  const stateCounts = new Map<string, Map<string, number>>();
  const overallCounts = new Map<string, number>();
  const values: string[] = [];

  for (const row of rows) {
    const stateKey = normalizeKey(row.state || "");
    const districtKey = normalizeKey(row.district || "");
    const value = String(row[key] || "Unknown").trim();
    if (!value) continue;
    values.push(value);
    overallCounts.set(value, (overallCounts.get(value) || 0) + 1);

    if (stateKey) {
      if (!stateCounts.has(stateKey)) stateCounts.set(stateKey, new Map());
      const counts = stateCounts.get(stateKey)!;
      counts.set(value, (counts.get(value) || 0) + 1);
    }

    if (stateKey && districtKey) {
      const joinedKey = `${districtKey}||${stateKey}`;
      if (!districtCounts.has(joinedKey)) districtCounts.set(joinedKey, new Map());
      const counts = districtCounts.get(joinedKey)!;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  const districtMap: Record<string, string> = {};
  for (const [keyName, counts] of districtCounts.entries()) {
    districtMap[keyName] = pickTop(counts);
  }

  const stateMap: Record<string, string> = {};
  for (const [keyName, counts] of stateCounts.entries()) {
    stateMap[keyName] = pickTop(counts);
  }

  const colorMap = buildColorMap(values);
  return {
    districtMap,
    stateMap,
    colorMap,
    legend: Object.entries(colorMap).map(([value, color]) => ({ value, color })),
    overall: pickTop(overallCounts)
  };
}

function buildNumericLayerMappings(rows: Awaited<ReturnType<typeof loadDatasetRows>>, key: "moisture" | "soil_ph" | "temperature" | "humidity" | "rainfall") {
  const districtTotals = new Map<string, { sum: number; count: number }>();
  const stateTotals = new Map<string, { sum: number; count: number }>();
  let overallSum = 0;
  let overallCount = 0;

  for (const row of rows) {
    const stateKey = normalizeKey(row.state || "");
    const districtKey = normalizeKey(row.district || "");
    const raw = row[key];
    const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw ?? ""));
    if (!Number.isFinite(value)) continue;

    overallSum += value;
    overallCount += 1;

    if (stateKey) {
      if (!stateTotals.has(stateKey)) stateTotals.set(stateKey, { sum: 0, count: 0 });
      const stateBucket = stateTotals.get(stateKey)!;
      stateBucket.sum += value;
      stateBucket.count += 1;
    }

    if (stateKey && districtKey) {
      const joinedKey = `${districtKey}||${stateKey}`;
      if (!districtTotals.has(joinedKey)) districtTotals.set(joinedKey, { sum: 0, count: 0 });
      const districtBucket = districtTotals.get(joinedKey)!;
      districtBucket.sum += value;
      districtBucket.count += 1;
    }
  }

  const districtMap: Record<string, number> = {};
  for (const [keyName, bucket] of districtTotals.entries()) {
    districtMap[keyName] = bucket.count ? bucket.sum / bucket.count : 0;
  }

  const stateMap: Record<string, number> = {};
  for (const [keyName, bucket] of stateTotals.entries()) {
    stateMap[keyName] = bucket.count ? bucket.sum / bucket.count : 0;
  }

  return { districtMap, stateMap, overall: overallCount ? overallSum / overallCount : 0 };
}

const app = express();
const port = Number(process.env.PORT || 3001);
const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim();

app.use(
  cors({
    origin: frontendOrigin ? frontendOrigin.split(",").map((value) => value.trim()).filter(Boolean) : true
  })
);
app.use(express.json({ limit: "8mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/llm/health", async (_req, res) => {
  try {
    const health = await checkLlmHealth();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  } catch (error) {
    res.status(500).json({ status: "error", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/api/llm/chat", async (req, res) => {
  try {
    const body = (req.body || {}) as ChatRequestBody;
    const message = String(body.message || "").trim();
    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const result = await handleUserMessage({
      message,
      sessionId: body.session_id,
      history: Array.isArray(body.history) ? body.history : [],
      imagePresent: Boolean(body.image_present)
    });

    return res.status(200).json({
      session_id: result.sessionId,
      reply: result.reply,
      structured_response: result.structured
    });
  } catch (error) {
    return res.status(500).json({ error: "LLM request failed", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/api/recommendation", async (req, res) => {
  const rid = requestId();
  try {
    const body = req.body as RecommendationRequestBody;
    const fieldInput = body?.field_input || {};
    const { result, debug } = await runRecommendation(fieldInput, rid);
    const enableDebug = boolEnv("RECOMMENDER_DEBUG", false);

    console.log(JSON.stringify({
      stage: "recommendation_completed",
      request_id: rid,
      input: debug.input,
      top_matches: debug.top_matches.map((match) => ({
        row_id: match.row.row_id,
        crop: match.row.recommended_crop,
        seed: match.row.recommended_seed,
        score: match.score,
        matched_features: match.matched_features
      })),
      ranking_summary: debug.ranking_summary,
      llm_prompt: debug.llm_prompt,
      llm_raw_response: debug.llm_raw_response,
      result
    }));

    return res.status(200).json(enableDebug ? { ...result, _debug: { request_id: rid, ranking_summary: debug.ranking_summary } } : result);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    console.error(JSON.stringify({ stage: "recommendation_error", request_id: rid, details }));
    return res.status(500).json({
      recommended_crop: "",
      recommended_seed: "",
      confidence_score: 0.0,
      reason: "Insufficient dataset evidence for a reliable recommendation.",
      matched_features: [],
      source_rows_used: [],
      error: details
    });
  }
});

app.post("/api/field-analysis", async (req, res) => {
  try {
    const body = req.body as FieldAnalysisBody;
    const imageDataUrl = String(body?.image_data_url || "").trim();
    const seedName = String(body?.seed_name || "").trim();
    const state = String(body?.state || "").trim();
    const district = String(body?.district || "").trim();
    const mode = body?.mode || "combined";

    if (!state || !district) return res.status(400).json({ error: "State and district are required." });
    if (mode === "field" && !imageDataUrl.startsWith("data:image/")) return res.status(400).json({ error: "A valid uploaded image is required for field analysis." });
    if (mode === "seed" && !seedName) return res.status(400).json({ error: "Seed name is required for seed analysis." });
    if (mode === "combined" && !imageDataUrl.startsWith("data:image/")) return res.status(400).json({ error: "A valid uploaded image is required for combined analysis." });
    if (mode === "combined" && !seedName) return res.status(400).json({ error: "Seed name is required for combined analysis." });

    const base = await analyzeFieldImage({ imageDataUrl, seedName, state, district, mode });
    const analysis = enrichFieldImageAnalysis(base);

    console.log(JSON.stringify({
      stage: "field_image_analysis_completed",
      seed_name: seedName || "Not specified",
      state,
      district,
      soil: analysis.soil_analysis.soil,
      moisture: analysis.soil_analysis.moisture,
      compatibility: analysis.seed_data.compatibility,
      decision: analysis.ai_decision.decision
    }));

    return res.status(200).json(analysis);
  } catch (error) {
    return res.status(500).json({ error: "Field image analysis failed", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/field-map", async (_req, res) => {
  try {
    const rows = await loadDatasetRows();
    const districtInsights: Record<string, { topCrops: string[]; topSeeds: string[] }> = {};
    const statesWithData = new Set<string>();
    const districtCropCounts = new Map<string, Map<string, number>>();
    const districtSeedCounts = new Map<string, Map<string, number>>();

    for (const row of rows) {
      const stateKey = normalizeKey(row.state || "");
      const districtKey = normalizeKey(row.district || "");
      if (!stateKey || !districtKey) continue;
      const key = `${districtKey}||${stateKey}`;
      statesWithData.add(stateKey);

      if (!districtCropCounts.has(key)) districtCropCounts.set(key, new Map());
      if (!districtSeedCounts.has(key)) districtSeedCounts.set(key, new Map());

      const crop = String(row.recommended_crop || row.crop || "Unknown").trim();
      const seed = String(row.recommended_seed || row.seed_name || "Unknown").trim();
      districtCropCounts.get(key)!.set(crop, (districtCropCounts.get(key)!.get(crop) || 0) + 1);
      districtSeedCounts.get(key)!.set(seed, (districtSeedCounts.get(key)!.get(seed) || 0) + 1);
    }

    for (const [key, counts] of districtCropCounts.entries()) {
      const seeds = districtSeedCounts.get(key) || new Map();
      districtInsights[key] = { topCrops: pickTopN(counts, 3), topSeeds: pickTopN(seeds, 3) };
    }

    return res.status(200).json({
      layers: {
        soil: buildLayerMappings(rows, "soil_type"),
        seedType: buildLayerMappings(rows, "seed_type"),
        fieldQuality: buildLayerMappings(rows, "field_quality"),
        fieldHistory: buildLayerMappings(rows, "field_history"),
        fieldComposition: buildLayerMappings(rows, "field_composition"),
        moisture: buildNumericLayerMappings(rows, "moisture"),
        soilPh: buildNumericLayerMappings(rows, "soil_ph"),
        temperature: buildNumericLayerMappings(rows, "temperature"),
        humidity: buildNumericLayerMappings(rows, "humidity"),
        rainfall: buildNumericLayerMappings(rows, "rainfall")
      },
      districtInsights,
      statesWithData: Array.from(statesWithData)
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to build field map", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/seed-visual", async (req, res) => {
  const seedName = String(req.query.seed_name || "").trim();
  if (!seedName) return res.status(400).json({ error: "seed_name is required" });

  try {
    const rows = await loadDatasetRows();
    const summary = buildSeedMatchSummary(rows, seedName);
    const profile = profileFromSeed(seedName, summary);
    return res.status(200).json({ seedName, summary, profile });
  } catch (error) {
    return res.status(500).json({ error: "Failed to build seed visual", details: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.listen(port, () => {
  console.log(`Subeej backend listening on port ${port}`);
});
