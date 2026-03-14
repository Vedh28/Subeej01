import type { NextApiRequest, NextApiResponse } from "next";
import { handleUserMessage } from "../../../lib/chat-controller";

interface ChatRequestBody {
  message?: string;
  session_id?: string;
  history?: Array<{ role?: string; content?: string }>;
  image_present?: boolean;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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
    const details = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "LLM request failed", details });
  }
}
