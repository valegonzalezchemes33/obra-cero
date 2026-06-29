import { db } from "@/lib/db";

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
    db.agentAction
      .create({
        data: {
          type: "audit",
          severity: entry.status >= 400 ? "warning" : "info",
          title: `${entry.method} ${entry.path} → ${entry.status}`,
          description: `${entry.durationMs}ms${entry.userId ? ` | user: ${entry.userId}` : ""}${entry.ip ? ` | ip: ${entry.ip}` : ""}`,
          status: "active",
          payload: JSON.stringify(entry).slice(0, 4000),
        },
      })
      .catch(() => {});
  } catch {}
}
