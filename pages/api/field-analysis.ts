import type { NextApiRequest, NextApiResponse } from "next";
import { analyzeFieldImage, enrichFieldImageAnalysis } from "../../lib/field-image-analysis";

interface FieldAnalysisBody {
  image_data_url?: string;
  seed_name?: string;
  state?: string;
  district?: string;
  mode?: "field" | "seed" | "combined";
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb"
    }
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body as FieldAnalysisBody;
    const imageDataUrl = String(body?.image_data_url || "").trim();
    const seedName = String(body?.seed_name || "").trim();
    const state = String(body?.state || "").trim();
    const district = String(body?.district || "").trim();
    const mode = body?.mode || "combined";

    if (!state || !district) {
      return res.status(400).json({ error: "State and district are required." });
    }

    if (mode === "field" && !imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "A valid uploaded image is required for field analysis." });
    }

    if (mode === "seed" && !seedName) {
      return res.status(400).json({ error: "Seed name is required for seed analysis." });
    }

    if (mode === "combined") {
      if (!imageDataUrl.startsWith("data:image/")) {
        return res.status(400).json({ error: "A valid uploaded image is required for combined analysis." });
      }
      if (!seedName) {
        return res.status(400).json({ error: "Seed name is required for combined analysis." });
      }
    }

    const base = await analyzeFieldImage({
      imageDataUrl,
      seedName,
      state,
      district,
      mode
    });

    const analysis = enrichFieldImageAnalysis(base);

    console.log(
      JSON.stringify({
        stage: "field_image_analysis_completed",
        seed_name: seedName || "Not specified",
        state,
        district,
        soil: analysis.soil_analysis.soil,
        moisture: analysis.soil_analysis.moisture,
        compatibility: analysis.seed_data.compatibility,
        decision: analysis.ai_decision.decision
      })
    );

    return res.status(200).json(analysis);
  } catch (error) {
    return res.status(500).json({
      error: "Field image analysis failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
