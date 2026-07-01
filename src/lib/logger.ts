import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

const baseLogger = pino({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  ...(isProd ? {} : { transport: { target: "pino/file", options: { destination: 1 } } }),
});

export function createLogger(module: string) {
  return baseLogger.child({ module });
}

export const apiLogger = createLogger("api");
export const agentLogger = createLogger("agent");
export const authLogger = createLogger("auth");
export const webhookLogger = createLogger("webhook");
export const dbLogger = createLogger("db");
export const auditLogger = createLogger("audit");
export const llmLogger = createLogger("llm");
