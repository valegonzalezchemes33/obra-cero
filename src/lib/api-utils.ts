import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";
import { logApiAudit } from "@/lib/api-audit";
import { timingSafeEqual } from "crypto";
import { apiLogger } from "@/lib/logger";

type Handler = (req: NextRequest, context: any) => Promise<NextResponse>;

export function withErrorHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    const start = Date.now();
    const path = new URL(req.url).pathname;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
    try {
      const response = await handler(req, ctx);
      const durationMs = Date.now() - start;
      logApiAudit({ method: req.method, path, status: response.status, durationMs, ip });
      return response;
    } catch (error: any) {
      const durationMs = Date.now() - start;
      apiLogger.error({ err: error, method: req.method, path, durationMs }, "Handler error");
      logApiAudit({ method: req.method, path, status: 500, durationMs, ip, error: error.message });
      return NextResponse.json(
        { error: error.message || "Error interno del servidor" },
        { status: 500 }
      );
    }
  };
}

export async function getSession(): Promise<Session | null> {
  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) {
    throw new AuthRequiredError();
  }
  return session;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Sesión requerida");
    this.name = "AuthRequiredError";
  }
}

export function authRequiredResponse() {
  return NextResponse.json(
    { error: "Sesión requerida." },
    { status: 401 },
  );
}

export function requireAgentApiKey(req: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) return true;
  const provided = req.headers.get("x-agent-key") || "";
  const ab = Buffer.from(provided, "utf8");
  const bb = Buffer.from(expected, "utf8");
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, Buffer.alloc(ab.length));
    return false;
  }
  return timingSafeEqual(ab, bb);
}

export function agentApiKeyRequiredResponse() {
  return NextResponse.json(
    { error: "API key de agente inválida o faltante. Proporcioná x-agent-key." },
    { status: 401 },
  );
}