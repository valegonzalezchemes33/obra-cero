import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL es requerida").optional(),
  DIRECT_URL: z.string().optional(),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET es requerida en producción").or(z.literal("")).optional(),
  AUTH_SECRET: z.string().optional(),
  ADMIN_USER: z.string().min(1).optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY es requerida para el agente IA").optional(),
  AUTH_DISABLED: z.literal("1").optional(),
  AGENT_API_KEY: z.string().optional(),
  WEBHOOK_API_KEY: z.string().optional(),
  WEBHOOK_SECRET: z.string().optional(),
  LLM_ACTIVE_PROVIDER: z.enum(["groq", "openai", "anthropic", "ollama"]).optional(),
  OLLAMA_HOST: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  OBSIDIAN_API_KEY: z.string().optional().describe("API Key del plugin Local REST API de Obsidian"),
  OBSIDIAN_BASE_URL: z.string().url().optional().describe("URL base del plugin Local REST API (default: https://127.0.0.1:27124)"),
  ALLOWED_ORIGINS: z.string().optional(),
  ALLOWED_ORIGIN: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  if (process.env.NODE_ENV === "production") {
    const prodMissing = parsed.error.issues
      .filter((i) => i.path.includes("NEXTAUTH_SECRET"))
      .map((i) => i.path.join("."));
    if (prodMissing.length > 0) {
      throw new Error("❌ NEXTAUTH_SECRET es requerida en producción");
    }
  }
}

export const env = parsed.data ?? {
  NODE_ENV: (process.env.NODE_ENV as string) || "development",
  DATABASE_URL: process.env.DATABASE_URL || "",
};

export function isProd(): boolean {
  return env.NODE_ENV === "production";
}

export function isAuthDisabledAllowed(): boolean {
  return process.env.AUTH_DISABLED === "1";
}
