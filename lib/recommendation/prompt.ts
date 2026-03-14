import { RecommendationInput, RowScore } from "./types";

export function recommendationSystemPrompt() {
  return [
    "You are an agriculture recommendation assistant for a B2B platform.",
    "You must only use provided dataset context and ranking summary.",
    "Do not invent crop names, seed names, soil types, weather, or locations.",
    "Do not recommend anything outside retrieved matches.",
    "If information is weak, use reason: Insufficient dataset evidence.",
    "Return valid JSON only with keys:",
    "recommended_crop, recommended_seed, confidence_score, reason, matched_features, source_rows_used."
  ].join(" ");
}

export function buildRecommendationPrompt(input: RecommendationInput, topMatches: RowScore[], confidence: number) {
  const rowsBlock = topMatches
    .map((match, idx) => ({
      rank: idx + 1,
      row_id: match.row.row_id,
      score: match.score,
      score_breakdown: match.score_breakdown,
      matched_features: match.matched_features,
      agronomic_evaluation: match.agronomic_evaluation || null,
      row: {
        state: match.row.state,
        district: match.row.district,
        season: match.row.season,
        soil_type: match.row.soil_type,
        field_composition: match.row.field_composition,
        field_quality: match.row.field_quality,
        field_history: match.row.field_history,
        recommended_crop: match.row.recommended_crop,
        recommended_seed: match.row.recommended_seed,
        seed_name: match.row.seed_name,
        seed_variety: match.row.seed_variety,
        seed_type: match.row.seed_type,
        seed_quality: match.row.seed_quality,
        moisture: match.row.moisture,
        humidity: match.row.humidity,
        rainfall: match.row.rainfall,
        temperature: match.row.temperature
      }
    }))
    .map((item) => JSON.stringify(item))
    .join("\n");

  return `
Structured field input:
${JSON.stringify(input)}

Ranking confidence from backend scorer: ${confidence}

Top matched dataset rows:
${rowsBlock}

Instructions:
1) Explain only rank 1 recommendation unless confidence is below 0.45.
2) Use only dataset context and agronomic rule reasoning above.
3) Keep reason short and professional.
4) If agronomic evaluation shows a constraint, mention it in the reason.
5) matched_features should include key factors from ranking (max 5).
6) source_rows_used should include the row_id values used (prefer top 3).
7) Return JSON only.
`.trim();
}
