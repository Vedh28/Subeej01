import type { NextApiRequest, NextApiResponse } from "next";
import { checkLlmHealth } from "../../../lib/llm-health";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const health = await checkLlmHealth();
    const statusCode = health.status === "ok" ? 200 : 503;
    return res.status(statusCode).json(health);
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ status: "error", details });
  }
}
