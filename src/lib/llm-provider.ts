// ============================================================
// CAPA DE ABSTRACCIÓN MULTI-PROVIDER LLM
// Soporta: Groq, OpenAI, Anthropic, Ollama
// Interfaz unificada para chat, streaming, y parsing de intents
// ============================================================

export type LLMProviderType = "groq" | "openai" | "anthropic" | "ollama";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  onToken?: (token: string) => void;
}

export interface LLMResponse {
  success: boolean;
  content: string;
  provider: LLMProviderType;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
}

export interface LLMProviderConfig {
  type: LLMProviderType;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  label: string;
}

// ─── Providers disponibles ───

const PROVIDER_CONFIGS: Record<LLMProviderType, { envKey: string; defaultModel: string; baseUrl: string; label: string }> = {
  groq: {
    envKey: "GROQ_API_KEY",
    defaultModel: "llama-3.3-70b-versatile",
    baseUrl: "https://api.groq.com/openai/v1",
    label: "Groq (Llama, Mixtral, Gemma)",
  },
  openai: {
    envKey: "OPENAI_API_KEY",
    defaultModel: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
    label: "OpenAI (GPT-4, GPT-4o-mini)",
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "claude-3-haiku-20240307",
    baseUrl: "https://api.anthropic.com/v1",
    label: "Anthropic (Claude 3 Haiku, Sonnet)",
  },
  ollama: {
    envKey: "OLLAMA_HOST",
    defaultModel: "llama3.2",
    baseUrl: "http://localhost:11434",
    label: "Ollama (local, offline)",
  },
};

// ─── Obtener provider activo ───

let _activeProvider: LLMProviderType = "groq";

export function getActiveProvider(): LLMProviderType {
  return _activeProvider;
}

export function setActiveProvider(provider: LLMProviderType): void {
  _activeProvider = provider;
}

// ─── Obtener API key segura ───

function getProviderConfig(type?: LLMProviderType): LLMProviderConfig | null {
  const provider = type || _activeProvider;
  const config = PROVIDER_CONFIGS[provider];

  const apiKey = process.env[config.envKey];
  
  // Para Ollama, no se necesita API key
  if (provider === "ollama") {
    const host = process.env.OLLAMA_HOST || "http://localhost:11434";
    return { type: provider, baseUrl: host, model: config.defaultModel, label: config.label };
  }

  if (!apiKey || apiKey.length === 0) {
    return null;
  }

  return {
    type: provider,
    apiKey,
    baseUrl: config.baseUrl,
    model: process.env[`${provider.toUpperCase()}_MODEL`] || config.defaultModel,
    label: config.label,
  };
}

// ─── Chat completion (no streaming) ───

export async function chat(
  userMessage: string,
  systemPrompt?: string,
  options: LLMChatOptions & { provider?: LLMProviderType } = {}
): Promise<LLMResponse> {
  const config = getProviderConfig(options.provider);
  if (!config) {
    const providerName = options.provider || _activeProvider;
    const envKey = PROVIDER_CONFIGS[providerName]?.envKey || "API_KEY";
    return { success: false, content: "", provider: providerName, model: "", error: `${envKey} no configurada` };
  }

  const messages: LLMMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userMessage });

  try {
    switch (config.type) {
      case "groq":
      case "openai": {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 1024,
            stream: false,
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          return { success: false, content: "", provider: config.type, model: config.model!, error: `HTTP ${response.status}: ${err.slice(0, 200)}` };
        }

        const data = await response.json();
        return {
          success: true,
          content: data.choices?.[0]?.message?.content || "",
          provider: config.type,
          model: data.model || config.model!,
          usage: data.usage ? { promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, totalTokens: data.usage.total_tokens } : undefined,
        };
      }

      case "anthropic": {
        // Anthropic tiene API diferente
        const response = await fetch(`${config.baseUrl}/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.apiKey!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: config.model,
            system: systemPrompt || "",
            messages: messages.filter(m => m.role !== "system"),
            max_tokens: options.maxTokens ?? 1024,
            temperature: options.temperature ?? 0.7,
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          return { success: false, content: "", provider: config.type, model: config.model!, error: `HTTP ${response.status}: ${err.slice(0, 200)}` };
        }

        const data = await response.json();
        return {
          success: true,
          content: data.content?.[0]?.text || "",
          provider: config.type,
          model: data.model || config.model!,
          usage: data.usage ? { promptTokens: data.usage.input_tokens, completionTokens: data.usage.output_tokens, totalTokens: data.usage.input_tokens + data.usage.output_tokens } : undefined,
        };
      }

      case "ollama": {
        const response = await fetch(`${config.baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: config.model,
            messages: [
              ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
              { role: "user", content: userMessage },
            ],
            stream: false,
            options: { temperature: options.temperature ?? 0.7, num_predict: options.maxTokens ?? 1024 },
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          return { success: false, content: "", provider: config.type, model: config.model!, error: `HTTP ${response.status}: ${err.slice(0, 200)}` };
        }

        const data = await response.json();
        return {
          success: true,
          content: data.message?.content || "",
          provider: config.type,
          model: data.model || config.model!,
        };
      }
    }
  } catch (error: any) {
    return { success: false, content: "", provider: config.type, model: config.model!, error: `Error: ${error.message}` };
  }
}

// ─── Streaming ───

export async function chatStream(
  userMessage: string,
  systemPrompt: string,
  onToken: (token: string) => void,
  options: { provider?: LLMProviderType; temperature?: number; maxTokens?: number } = {}
): Promise<LLMResponse> {
  const config = getProviderConfig(options.provider);
  if (!config) {
    const providerName = options.provider || _activeProvider;
    const envKey = PROVIDER_CONFIGS[providerName]?.envKey || "API_KEY";
    onToken(`\n\n❌ Error: ${envKey} no configurada. Revisá tus variables de entorno.`);
    return { success: false, content: "", provider: providerName, model: "", error: `${envKey} no configurada` };
  }

  const messages: LLMMessage[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: userMessage });
  let fullContent = "";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
        stream: true,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      const msg = `Error HTTP ${response.status}: ${err.slice(0, 200)}`;
      onToken(`\n\n❌ ${msg}`);
      return { success: false, content: "", provider: config.type, model: config.model!, error: msg };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onToken("\n\n❌ Error: No se pudo leer el stream");
      return { success: false, content: "", provider: config.type, model: config.model!, error: "No reader" };
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content || "";
          if (token) {
            fullContent += token;
            onToken(token);
          }
        } catch {}
      }
    }

    return { success: true, content: fullContent, provider: config.type, model: config.model! };
  } catch (error: any) {
    if (error.name === "AbortError") {
      onToken("\n\n⏱️ Timeout: el LLM no respondió a tiempo");
      return { success: false, content: fullContent, provider: config.type, model: config.model!, error: "Timeout" };
    }
    onToken(`\n\n❌ Error: ${error.message}`);
    return { success: false, content: fullContent, provider: config.type, model: config.model!, error: error.message };
  }
}

// ─── Verificar disponibilidad de un provider ───

export async function checkProvider(type?: LLMProviderType): Promise<{ available: boolean; provider: string; model: string; error?: string }> {
  const config = getProviderConfig(type);
  if (!config) return { available: false, provider: type || _activeProvider, model: "", error: "No configurado" };

  if (config.type === "ollama") {
    try {
      const res = await fetch(`${config.baseUrl}/api/tags`);
      if (!res.ok) return { available: false, provider: config.type, model: config.model!, error: "Ollama no responde" };
      return { available: true, provider: config.type, model: config.model! };
    } catch {
      return { available: false, provider: config.type, model: config.model!, error: "Ollama no está corriendo" };
    }
  }

  try {
    const res = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
    if (!res.ok) return { available: false, provider: config.type, model: config.model!, error: `Error ${res.status}` };
    return { available: true, provider: config.type, model: config.model! };
  } catch (e: any) {
    return { available: false, provider: config.type, model: config.model!, error: e.message };
  }
}

// ─── Auto-inicialización: leer provider activo desde env ───

const activeEnv = process.env.LLM_ACTIVE_PROVIDER as LLMProviderType | undefined;
if (activeEnv && (["groq", "openai", "anthropic", "ollama"] as LLMProviderType[]).includes(activeEnv)) {
  _activeProvider = activeEnv;
}

// ─── Obtener lista de providers disponibles ───

export async function getAvailableProviders(): Promise<LLMProviderConfig[]> {
  const available: LLMProviderConfig[] = [];

  for (const [type, cfg] of Object.entries(PROVIDER_CONFIGS)) {
    const providerType = type as LLMProviderType;
    
    if (providerType === "ollama") {
      const host = process.env.OLLAMA_HOST || "http://localhost:11434";
      available.push({ type: providerType, baseUrl: host, model: cfg.defaultModel, label: cfg.label });
      continue;
    }

    const apiKey = process.env[cfg.envKey];
    if (apiKey && apiKey.length > 0) {
      available.push({
        type: providerType,
        apiKey: apiKey.slice(0, 8) + "...",
        baseUrl: cfg.baseUrl,
        model: process.env[`${providerType.toUpperCase()}_MODEL`] || cfg.defaultModel,
        label: cfg.label,
      });
    }
  }

  return available;
}
