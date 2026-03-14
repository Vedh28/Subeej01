export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  history?: Message[];
}

type LlmProvider = "ollama" | "mistral_api" | "auto";

async function parseJsonResponse<T>(response: Response, source: string) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    throw new Error(`${source} failed (${response.status}): ${text}`);
  }

  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error(`${source} returned HTML instead of JSON. Check the configured endpoint and server state.`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${source} returned invalid JSON.`);
  }
}

async function parseSseText(response: Response, source: string) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${source} failed (${response.status}): ${text}`);
  }

  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error(`${source} returned HTML instead of JSON. Check the configured endpoint and server state.`);
  }

  let combined = "";
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
      };
      combined += parsed.choices?.[0]?.delta?.content || "";
    } catch {
      // Ignore partial/non-JSON event lines.
    }
  }

  return combined.trim();
}

async function parseOllamaStream(response: Response, source: string) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${source} failed (${response.status}): ${text}`);
  }

  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    throw new Error(`${source} returned HTML instead of JSON. Check the configured endpoint and server state.`);
  }

  let combined = "";
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed) as { message?: { content?: string } };
      combined += parsed.message?.content || "";
    } catch {
      // Ignore malformed stream fragments.
    }
  }

  return combined.trim();
}

function getLlmConfig() {
  return {
    provider: ((process.env.LLM_PROVIDER || "ollama").toLowerCase() as LlmProvider),
    fallbackProvider: ((process.env.LLM_FALLBACK_PROVIDER || "").toLowerCase() as Exclude<LlmProvider, "auto"> | ""),
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
    ollamaModel: process.env.OLLAMA_MODEL ?? "mistral",
    mistralApiKey: process.env.MISTRAL_API_KEY ?? "",
    mistralModel: process.env.MISTRAL_MODEL ?? "mistral-large-latest",
    mistralBaseUrl: process.env.MISTRAL_BASE_URL ?? "https://api.mistral.ai/v1",
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS ?? 60000)
  };
}

function getProviderOrder(provider: LlmProvider, fallbackProvider: Exclude<LlmProvider, "auto"> | "") {
  if (provider === "auto") {
    return fallbackProvider === "ollama"
      ? (["mistral_api", "ollama"] as const)
      : (["ollama", "mistral_api"] as const);
  }

  if (!fallbackProvider || fallbackProvider === provider) {
    return [provider] as const;
  }

  return [provider, fallbackProvider] as const;
}

async function callOllama(messages: Message[], options?: ChatOptions, signal?: AbortSignal) {
  const cfg = getLlmConfig();
  const stream = options?.stream ?? false;
  const response = await fetch(`${cfg.ollamaBaseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      model: cfg.ollamaModel,
      messages,
      stream,
      options: {
        temperature: options?.temperature ?? 0.1,
        num_predict: options?.maxTokens ?? 220,
        top_p: options?.topP ?? 0.9
      }
    })
  });

  if (stream) {
    return parseOllamaStream(response, "Ollama call");
  }

  const data = await parseJsonResponse<{ message?: { content?: string } }>(response, "Ollama call");
  return (data.message?.content || "").trim();
}

async function callMistral(messages: Message[], options?: ChatOptions, signal?: AbortSignal) {
  const cfg = getLlmConfig();
  if (!cfg.mistralApiKey) {
    throw new Error("MISTRAL_API_KEY is missing.");
  }

  const stream = options?.stream ?? false;

  const response = await fetch(`${cfg.mistralBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.mistralApiKey}`
    },
    signal,
    body: JSON.stringify({
      model: cfg.mistralModel,
      temperature: options?.temperature ?? 0.1,
      max_tokens: options?.maxTokens ?? 220,
      top_p: options?.topP ?? 0.9,
      stream,
      messages
    })
  });

  if (stream) {
    return parseSseText(response, "Mistral API");
  }

  const data = await parseJsonResponse<{
    choices?: Array<{ message?: { content?: string } }>;
  }>(response, "Mistral API");

  return (data.choices?.[0]?.message?.content || "").trim();
}

async function runChat(messages: Message[], options?: ChatOptions) {
  const cfg = getLlmConfig();
  const providerOrder = getProviderOrder(cfg.provider, cfg.fallbackProvider);
  let lastError: Error | null = null;

  for (const provider of providerOrder) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      if (provider === "mistral_api") {
        return await callMistral(messages, options, controller.signal);
      }
      return await callOllama(messages, options, controller.signal);
    } catch (error) {
      const details =
        error instanceof Error && error.name === "AbortError"
          ? `${provider} timed out after ${cfg.timeoutMs}ms`
          : error instanceof Error
            ? error.message
            : "Unknown LLM provider error.";
      lastError = new Error(details);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("No LLM provider could return a response.");
}

export async function runLlmJson(systemPrompt: string, userPrompt: string) {
  return runChat([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ], { temperature: 0.1, maxTokens: 220, topP: 0.9, stream: false });
}

export async function runLlmText(systemPrompt: string, userPrompt: string, options?: ChatOptions) {
  const history = Array.isArray(options?.history)
    ? options.history.filter(
        (message) =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
      )
    : [];

  return runChat([
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userPrompt }
  ], {
    temperature: options?.temperature ?? 0.2,
    maxTokens: options?.maxTokens ?? 420,
    topP: options?.topP ?? 0.9,
    stream: options?.stream ?? true
  });
}
