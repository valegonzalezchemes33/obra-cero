import { db } from "@/lib/db";
import { getTenantSafe } from "@/lib/tenant";
import { auditLogger } from "@/lib/logger";

interface ApiAuditEntry {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip?: string;
  userId?: string;
  error?: string;
}

export function logApiAudit(entry: ApiAuditEntry) {
  try {
    getTenantSafe().then(tenant => {
      db.agentAction
        .create({
          data: {
            type: "audit",
            severity: entry.status >= 400 ? "warning" : "info",
            title: `${entry.method} ${entry.path} → ${entry.status}`,
            description: `${entry.durationMs}ms${entry.userId ? ` | user: ${entry.userId}` : ""}${entry.ip ? ` | ip: ${entry.ip}` : ""}`,
            status: "active",
            payload: JSON.stringify(entry).slice(0, 4000),
            organizationId: tenant?.organizationId ?? "default",
          },
        })
        .catch(() => {});
    });
  } catch (e) { auditLogger.warn({ module: "api-audit" }, "catch swallowed: registrar auditoría de API") }
}
