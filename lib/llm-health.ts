import { getLlmRuntimeConfig, type LlmProvider } from "./llm-client";
import { checkOllamaHealth } from "./ollama";

interface MistralModelsResponse {
  data?: Array<{ id?: string }>;
}

type ProviderHealth =
  | {
      provider: "ollama";
      healthy: boolean;
      configured: true;
      baseUrl: string;
      model: string;
      modelAvailable: boolean;
      availableModels: string[];
      error?: string;
    }
  | {
      provider: "mistral_api";
      healthy: boolean;
      configured: boolean;
      baseUrl: string;
      model: string;
      modelAvailable: boolean;
      availableModels: string[];
      error?: string;
    }
  | {
      provider: "huggingface";
      healthy: boolean;
      configured: boolean;
      baseUrl: string;
      model: string;
      modelAvailable: boolean;
      availableModels: string[];
      error?: string;
    };

function normalizeProvider(provider: LlmProvider | ""): "ollama" | "mistral_api" | "huggingface" {
  if (provider === "mistral_api") return "mistral_api";
  if (provider === "huggingface") return "huggingface";
  return "ollama";
}

async function checkMistralHealth(): Promise<ProviderHealth> {
  const cfg = getLlmRuntimeConfig();
  const model = cfg.mistralModel;
  const baseUrl = cfg.mistralBaseUrl;

  if (!cfg.mistralApiKeyConfigured) {
    return {
      provider: "mistral_api",
      healthy: false,
      configured: false,
      baseUrl,
      model,
      modelAvailable: false,
      availableModels: [],
      error: "MISTRAL_API_KEY is missing."
    };
  }

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY ?? ""}`
      }
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        provider: "mistral_api",
        healthy: false,
        configured: true,
        baseUrl,
        model,
        modelAvailable: false,
        availableModels: [],
        error: `Mistral API failed (${response.status}): ${text}`
      };
    }

    const payload = JSON.parse(text) as MistralModelsResponse;
    const availableModels = (payload.data ?? []).map((item) => String(item.id || "").trim()).filter(Boolean);
    const modelAvailable = availableModels.includes(model);

    return {
      provider: "mistral_api",
      healthy: modelAvailable,
      configured: true,
      baseUrl,
      model,
      modelAvailable,
      availableModels,
      error: modelAvailable ? undefined : `Configured model "${model}" was not returned by Mistral API.`
    };
  } catch (error) {
    return {
      provider: "mistral_api",
      healthy: false,
      configured: true,
      baseUrl,
      model,
      modelAvailable: false,
      availableModels: [],
      error: error instanceof Error ? error.message : "Unknown Mistral API error."
    };
  }
}

async function checkHuggingFaceHealth(): Promise<ProviderHealth> {
  const cfg = getLlmRuntimeConfig();
  const model = cfg.huggingFaceModel;
  const baseUrl = cfg.huggingFaceBaseUrl;

  if (!cfg.huggingFaceApiKeyConfigured) {
    return {
      provider: "huggingface",
      healthy: false,
      configured: false,
      baseUrl,
      model,
      modelAvailable: false,
      availableModels: [],
      error: "HUGGINGFACE_API_KEY or HF_TOKEN is missing."
    };
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY ?? ""}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
        temperature: 0
      })
    });

    const text = await response.text();
    if (!response.ok) {
      return {
        provider: "huggingface",
        healthy: false,
        configured: true,
        baseUrl,
        model,
        modelAvailable: false,
        availableModels: [],
        error: `Hugging Face API failed (${response.status}): ${text}`
      };
    }

    return {
      provider: "huggingface",
      healthy: true,
      configured: true,
      baseUrl,
      model,
      modelAvailable: true,
      availableModels: [model]
    };
  } catch (error) {
    return {
      provider: "huggingface",
      healthy: false,
      configured: true,
      baseUrl,
      model,
      modelAvailable: false,
      availableModels: [],
      error: error instanceof Error ? error.message : "Unknown Hugging Face API error."
    };
  }
}

async function checkConfiguredProvider(provider: "ollama" | "mistral_api" | "huggingface"): Promise<ProviderHealth> {
  if (provider === "mistral_api") {
    return checkMistralHealth();
  }

  if (provider === "huggingface") {
    return checkHuggingFaceHealth();
  }

  try {
    const health = await checkOllamaHealth();
    return {
      provider: "ollama",
      healthy: health.modelAvailable,
      configured: true,
      baseUrl: health.baseUrl,
      model: health.model,
      modelAvailable: health.modelAvailable,
      availableModels: health.availableModels
    };
  } catch (error) {
    const cfg = getLlmRuntimeConfig();
    return {
      provider: "ollama",
      healthy: false,
      configured: true,
      baseUrl: cfg.ollamaBaseUrl,
      model: cfg.ollamaModel,
      modelAvailable: false,
      availableModels: [],
      error: error instanceof Error ? error.message : "Unknown Ollama error."
    };
  }
}

export async function checkLlmHealth() {
  const cfg = getLlmRuntimeConfig();
  const primaryProvider = normalizeProvider(cfg.provider);
  const fallbackProvider = cfg.fallbackProvider ? normalizeProvider(cfg.fallbackProvider) : null;

  const primary = await checkConfiguredProvider(primaryProvider);
  const fallback =
    fallbackProvider && fallbackProvider !== primaryProvider
      ? await checkConfiguredProvider(fallbackProvider)
      : null;

  const status = primary.healthy
    ? "ok"
    : !primary.configured
      ? "misconfigured"
      : primary.modelAvailable
        ? "ok"
        : "unavailable";

  return {
    status,
    provider: primaryProvider,
    fallbackProvider,
    primary,
    fallback
  };
}
