import { RecommendationOutput, RowScore } from "./types";

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function safeParseRecommendation(text: string) {
  const raw = extractJsonObject(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RecommendationOutput;
  } catch {
    return null;
  }
}

export function buildFallback(topMatches: RowScore[], confidence: number): RecommendationOutput {
  const best = topMatches[0];
  if (!best || best.score < 0.35 || confidence < 0.4) {
    return {
      recommended_crop: "",
      recommended_seed: "",
      confidence_score: Number(Math.min(confidence, 0.39).toFixed(2)),
      reason: "Insufficient dataset evidence for a reliable recommendation.",
      matched_features: [],
      source_rows_used: []
    };
  }

  return {
    recommended_crop: best.row.recommended_crop,
    recommended_seed: best.row.recommended_seed,
    confidence_score: confidence,
    reason:
      best.agronomic_evaluation?.rule_reasons[0] ||
      `Top ranked dataset match indicates ${best.row.recommended_crop} with ${best.row.recommended_seed}.`,
    matched_features: best.matched_features.slice(0, 5),
    source_rows_used: topMatches.map((m) => m.row.row_id)
  };
}

export function validateRecommendation(
  candidate: RecommendationOutput | null,
  topMatches: RowScore[],
  confidence: number
) {
  const fallback = buildFallback(topMatches, confidence);
  if (!candidate) return fallback;

  const allowedCrops = new Set(topMatches.map((m) => m.row.recommended_crop.toLowerCase()));
  const allowedSeeds = new Set(topMatches.map((m) => m.row.recommended_seed.toLowerCase()));

  const crop = (candidate.recommended_crop || "").trim();
  const seed = (candidate.recommended_seed || "").trim();

  if (!crop || !seed) return fallback;
  if (!allowedCrops.has(crop.toLowerCase())) return fallback;
  if (!allowedSeeds.has(seed.toLowerCase())) return fallback;

  const normalized: RecommendationOutput = {
    recommended_crop: crop,
    recommended_seed: seed,
    confidence_score: confidence,
    reason:
      String(candidate.reason || "").trim() ||
      `Top ranked dataset match indicates ${crop} with ${seed}.`,
    matched_features:
      Array.isArray(candidate.matched_features) && candidate.matched_features.length
        ? candidate.matched_features.slice(0, 5).map((item) => String(item))
        : fallback.matched_features,
    source_rows_used:
      Array.isArray(candidate.source_rows_used) && candidate.source_rows_used.length
        ? candidate.source_rows_used.map((x) => Number(x)).filter((n) => Number.isFinite(n))
        : fallback.source_rows_used
  };

  if (!normalized.source_rows_used.length) {
    normalized.source_rows_used = fallback.source_rows_used;
  }

  if (confidence < 0.4) {
    return {
      ...buildFallback(topMatches, confidence),
      confidence_score: confidence
    };
  }

  return normalized;
}
