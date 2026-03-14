import type { NextApiRequest, NextApiResponse } from "next";
import { checkOllamaHealth } from "../../../lib/ollama";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const health = await checkOllamaHealth();
    return res.status(200).json({
      status: health.modelAvailable ? "ok" : "model_missing",
      ...health
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ status: "error", details });
  }
}
