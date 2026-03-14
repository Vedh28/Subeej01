import { applyAgronomicEvaluation, summarizeAgronomicEvaluation } from "../agronomy/crop-rules";
import { runLlmJson } from "../llm-client";
import { loadDatasetRows } from "./dataset";
import { buildRecommendationPrompt, recommendationSystemPrompt } from "./prompt";
import { calculateConfidence, describeRanking, rankCandidates } from "./scoring";
import { RecommendationDebug, RecommendationInput, RecommendationOutput } from "./types";
import { safeParseRecommendation, validateRecommendation } from "./validation";

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function normalizeInput(input: Partial<RecommendationInput>): RecommendationInput {
  return {
    seed_name: String(input.seed_name || "").trim(),
    seed_variety: String(input.seed_variety || "").trim(),
    seed_type: String(input.seed_type || "").trim(),
    seed_quality: String(input.seed_quality || "").trim(),
    suitable_land_type_for_seed: String(input.suitable_land_type_for_seed || "").trim(),
    field_quality: String(input.field_quality || "").trim(),
    field_history_or_crops: String(input.field_history_or_crops || "").trim(),
    field_composition: String(input.field_composition || "").trim(),
    moisture: Number(input.moisture || 0),
    humidity: Number(input.humidity || 0),
    rainfall: Number(input.rainfall || 0),
    temperature: Number(input.temperature || 0),
    state: String(input.state || "").trim(),
    district: String(input.district || "").trim(),
    suitable_crop_for_field: String(input.suitable_crop_for_field || "").trim(),
    season: String(input.season || "").trim()
  };
}

function generateRequestId() {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function runRecommendation(
  rawInput: Partial<RecommendationInput>,
  requestId = generateRequestId()
) {
  const input = normalizeInput(rawInput);
  const rows = await loadDatasetRows();
  const rankedMatches = rankCandidates(input, rows);
  const topMatches = applyAgronomicEvaluation(input, rankedMatches);
  const baseConfidence = calculateConfidence(input, topMatches);
  const agronomicPenalty = topMatches[0]?.agronomic_evaluation?.penalty ?? 0;
  const confidence = Number(
    Math.max(0, Math.min(1, baseConfidence - agronomicPenalty / 200)).toFixed(2)
  );
  const rankingSummary = describeRanking(topMatches);
  const agronomicSummary = summarizeAgronomicEvaluation(topMatches);
  const prompt = buildRecommendationPrompt(input, topMatches, confidence);

  let llmRaw = "";
  const llmEnabled = boolEnv("LLM_EXPLAINER_ENABLED", true);
  let parsed: RecommendationOutput | null = null;

  if (llmEnabled && topMatches.length) {
    try {
      llmRaw = await runLlmJson(recommendationSystemPrompt(), prompt);
      parsed = safeParseRecommendation(llmRaw);
    } catch (error) {
      llmRaw = `LLM error: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  }

  const result = validateRecommendation(parsed, topMatches, confidence);
  const debug: RecommendationDebug = {
    request_id: requestId,
    input,
    top_matches: topMatches,
    ranking_summary: rankingSummary,
    llm_prompt: prompt,
    llm_raw_response: llmRaw,
    agronomic_summary: agronomicSummary
  };

  return { result, debug };
}
