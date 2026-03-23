import type { NextApiRequest, NextApiResponse } from "next";
import { runRecommendation } from "../../../lib/recommendation/engine";
import { RecommendationInput } from "../../../lib/recommendation/types";

interface RecommendationRequestBody {
  field_input?: Partial<RecommendationInput>;
}

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function requestId() {
  return `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rid = requestId();
  try {
    const body = req.body as RecommendationRequestBody;
    const fieldInput = body?.field_input || {};

    const { result, debug } = await runRecommendation(fieldInput, rid);

    const enableDebug = boolEnv("RECOMMENDER_DEBUG", false);
    console.log(
      JSON.stringify({
        stage: "recommendation_completed",
        request_id: rid,
        input: debug.input,
        top_matches: debug.top_matches.map((m) => ({
          row_id: m.row.row_id,
          crop: m.row.recommended_crop,
          seed: m.row.recommended_seed,
          score: m.score,
          matched_features: m.matched_features
        })),
        ranking_summary: debug.ranking_summary,
        llm_prompt: debug.llm_prompt,
        llm_raw_response: debug.llm_raw_response,
        result
      })
    );

    return res.status(200).json(
      enableDebug
        ? {
            ...result,
            _debug: {
              request_id: rid,
              ranking_summary: debug.ranking_summary
            }
          }
        : result
    );
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
}
