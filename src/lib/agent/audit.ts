// ============================================================
// AUDIT LOG — Trazabilidad y seguridad del agente
// ============================================================
// Registra cada ejecución de tool y request del agente.
// Persiste en AgentAction (type="audit") para mantener el
// esquema de Prisma sin cambios.
//
// Registra:
//   - Tool executions (quién, qué, cuándo, resultado)
//   - Requests fallidos
//   - Groq availability changes
//   - Confirmation requests / responses
//   - Token usage (estimado)
//
// NO guarda el contenido de los mensajes del usuario (privacidad)
// salvo el intent/plan asociado.
// ============================================================

import { db } from "@/lib/db";
import type { ToolName } from "@/lib/tool-registry";
import type { RiskLevel } from "@/lib/agent/types";
import { agentRateLimiter } from "@/lib/rate-limit";

export type AuditEventType =
  | "tool_execution"
  | "tool_validation_failed"
  | "tool_not_found"
  | "confirmation_requested"
  | "confirmation_approved"
  | "confirmation_rejected"
  | "plan_created"
  | "plan_executed"
  | "plan_failed"
  | "rate_limited"
  | "groq_unavailable"
  | "unknown_intent";

export interface AuditEntry {
  type: AuditEventType;
  tool?: ToolName | string;
  intent?: string;
  risk?: RiskLevel;
  userId?: string;
  sessionId?: string;
  source?: "groq" | "local" | "compound" | "hybrid" | "memory";
  confidence?: number;
  success?: boolean;
  errorMessage?: string;
  tokensUsed?: number;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export function checkRateLimit(sessionId: string): { allowed: boolean; remaining: number; resetIn: number } {
  return agentRateLimiter(sessionId);
}

// ──────────────────────────────────────────────────────────────
// Sanitización de inputs antes de Groq
// ──────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  { pattern: /\b\d{2}\.?\d{3}\.?\d{3}\b/g, replacement: "[DNI]" },
  { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, replacement: "[TARJETA]" },
  { pattern: /password\s*[=:]\s*\S+/gi, replacement: "password=[REDACTED]" },
  { pattern: /token\s*[=:]\s*\S+/gi, replacement: "token=[REDACTED]" },
  { pattern: /api[_-]?key\s*[=:]\s*\S+/gi, replacement: "api_key=[REDACTED]" },
  { pattern: /Bearer\s+[A-Za-z0-9_\-\.]+/g, replacement: "Bearer [REDACTED]" },
];

export function sanitizeForGroq(text: string): string {
  let sanitized = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  return sanitized.slice(0, 4000); // Límite de tamaño para Groq
}

// ──────────────────────────────────────────────────────────────
// Persistir entrada de auditoría
// ──────────────────────────────────────────────────────────────

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    const { type, tool, intent, risk, userId, sessionId, source, confidence, success, errorMessage, tokensUsed, durationMs, metadata } = entry;

    const title = formatAuditTitle(entry);
    const description = formatAuditDescription(entry);
    const severity = severityFromEntry(entry);

    await db.agentAction.create({
      data: {
        type: "audit",
        severity,
        title,
        description,
        status: "active",
        payload: JSON.stringify({
          tool,
          intent,
          risk,
          userId,
          sessionId,
          source,
          confidence,
          success,
          errorMessage: errorMessage?.slice(0, 500),
          tokensUsed,
          durationMs,
          ...metadata,
        }).slice(0, 4000),
        organizationId: "default",
      },
    });
  } catch {
    // Nunca fallar la request principal por un error de auditoría
    const { auditLogger } = await import("@/lib/logger");
    auditLogger.warn({ module: "audit" }, "Failed to write audit log");
  }
}

// ──────────────────────────────────────────────────────────────
// Helper: severity desde entry
// ──────────────────────────────────────────────────────────────

function severityFromEntry(entry: AuditEntry): string {
  if (entry.type === "rate_limited") return "warning";
  if (entry.type === "tool_validation_failed" || entry.type === "tool_not_found") return "warning";
  if (entry.type === "confirmation_rejected") return "info";
  if (entry.type === "confirmation_approved") return "info";
  if (entry.success === false) return "warning";
  if (entry.risk === "destructive") return "warning";
  return "info";
}

// ──────────────────────────────────────────────────────────────
// Helper: título legible
// ──────────────────────────────────────────────────────────────

function formatAuditTitle(e: AuditEntry): string {
  const toolLabel = e.tool ? `**${e.tool}**` : "(sin tool)";
  switch (e.type) {
    case "tool_execution":
      return `${e.success !== false ? "✅" : "❌"} Tool ejecutada: ${toolLabel}`;
    case "tool_validation_failed":
      return `⚠️ Tool inválida: ${toolLabel}`;
    case "tool_not_found":
      return `⚠️ Tool no hallada: ${toolLabel}`;
    case "confirmation_requested":
      return `🔶 Confirmación requerida: ${toolLabel}`;
    case "confirmation_approved":
      return `✅ Confirmación aprobada: ${toolLabel}`;
    case "confirmation_rejected":
      return `❌ Confirmación rechazada: ${toolLabel}`;
    case "plan_created":
      return `📋 Plan creado: ${e.intent || "?"} (${e.source})`;
    case "plan_executed":
      return `🚀 Plan ejecutado: ${e.intent || "?"} | ${e.durationMs}ms`;
    case "plan_failed":
      return `❌ Plan falló: ${e.errorMessage || "error desconocido"}`;
    case "rate_limited":
      return `🚫 Rate limit: session=${e.sessionId || "?"}`;
    case "groq_unavailable":
      return `⚡ Groq no disponible — fallback local`;
    case "unknown_intent":
      return `❓ Intent no reconocido`;
    default:
      return `📝 Evento: ${e.type}`;
  }
}

function formatAuditDescription(e: AuditEntry): string {
  const parts: string[] = [];
  if (e.userId) parts.push(`User: ${e.userId}`);
  if (e.sessionId) parts.push(`Session: ${e.sessionId.slice(0, 8)}`);
  if (e.confidence) parts.push(`Confianza: ${(e.confidence * 100).toFixed(0)}%`);
  if (e.tokensUsed) parts.push(`Tokens: ${e.tokensUsed}`);
  if (e.durationMs) parts.push(`Duración: ${e.durationMs}ms`);
  if (e.errorMessage) parts.push(`Error: ${e.errorMessage.slice(0, 100)}`);
  return parts.join(" · ") || "-";
}

// ──────────────────────────────────────────────────────────────
// Integración con tool-execution.ts
// ──────────────────────────────────────────────────────────────

import { getToolDefinition } from "@/lib/tools/registry-definitions";

export async function auditToolExecution(
  tool: ToolName,
  args: Record<string, any>,
  result: { ok: boolean; errors?: string[] },
  ctx: { sessionId?: string; userId?: string; rawText?: string }
): Promise<void> {
  const risk = (() => {
    const def = getToolDefinition(tool);
    return def?.riskLevel || "safe";
  })();

  const sanitizedArgs = sanitizeToolArgsForAudit(args);

  await auditLog({
    type: result.ok ? "tool_execution" : "tool_validation_failed",
    tool,
    intent: tool,
    risk,
    userId: ctx.userId,
    sessionId: ctx.sessionId,
    success: result.ok,
    errorMessage: result.errors?.join("; "),
    metadata: { args: sanitizedArgs, errorCount: result.errors?.length },
  });
}

function sanitizeToolArgsForAudit(args: Record<string, any>): Record<string, any> {
  const sanitized = { ...args };
  const secretKeys = ["password", "token", "api_key", "secret", "key", "Authorization"];
  for (const key of Object.keys(sanitized)) {
    if (secretKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      (sanitized as any)[key] = "[REDACTED]";
    }
  }
  return sanitized;
}