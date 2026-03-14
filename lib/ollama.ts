import { BASE_SYSTEM_PROMPT } from "./prompts/subeej-system";

type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface OllamaChatResponse {
  message?: {
    role?: string;
    content?: string;
  };
}

export function getOllamaConfig() {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    model: process.env.OLLAMA_MODEL ?? "mistral",
    systemPrompt: process.env.OLLAMA_SYSTEM_PROMPT ?? BASE_SYSTEM_PROMPT,
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 60000)
  };
}

export async function chatWithOllama(userMessage: string, history: ChatMessage[] = []) {
  const { baseUrl, model, systemPrompt, timeoutMs } = getOllamaConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: userMessage }
    ];

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data.message?.content?.trim();

    if (!content) {
      throw new Error("Ollama returned an empty response.");
    }

    return content;
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkOllamaHealth() {
  const { baseUrl, model } = getOllamaConfig();

  const tagsResponse = await fetch(`${baseUrl}/api/tags`);
  if (!tagsResponse.ok) {
    throw new Error(`Unable to reach Ollama at ${baseUrl}`);
  }

  const tagsData = (await tagsResponse.json()) as {
    models?: Array<{ name?: string; model?: string }>;
  };

  const models = tagsData.models ?? [];
  const expected = model.toLowerCase();
  const found = models.some((entry) => {
    const name = (entry.name || entry.model || "").toLowerCase();
    return name === expected || name.startsWith(`${expected}:`);
  });

  return {
    baseUrl,
    model,
    modelAvailable: found,
    availableModels: models.map((entry) => entry.name || entry.model || "unknown")
  };
}
