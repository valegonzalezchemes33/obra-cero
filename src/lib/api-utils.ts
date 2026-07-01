import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Session } from "next-auth";
import { logApiAudit } from "@/lib/api-audit";
import { timingSafeEqual } from "crypto";
import { apiLogger } from "@/lib/logger";
import { mutationRateLimiter } from "@/lib/rate-limit";
import { isProd } from "@/lib/env";

// Re-export para obtener org desde la sesión
export { getSessionOrganization } from "@/lib/auth";

type Handler = (req: NextRequest, context: any) => Promise<NextResponse>;

const MAX_BODY_BYTES = 1_000_000; // 1 MB

/**
 * Lee el body JSON con un límite de tamaño para prevenir DoS.
 * Si supera el límite, devuelve una respuesta 413.
 */
export async function parseBodyWithLimit<T = any>(req: NextRequest): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength) > MAX_BODY_BYTES) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Body demasiado grande. Máximo 1 MB." }, { status: 413 }),
    };
  }

  try {
    const text = await req.clone().text();
    if (text.length > MAX_BODY_BYTES) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Body demasiado grande. Máximo 1 MB." }, { status: 413 }),
      };
    }
    const data = JSON.parse(text) as T;
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "JSON inválido" }, { status: 400 }),
    };
  }
}

export function withErrorHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    const start = Date.now();
    const path = new URL(req.url).pathname;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";

    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const rl = mutationRateLimiter(ip);
      if (!rl.allowed) {
        return NextResponse.json(
          { error: "Demasiadas solicitudes. Reintentá en un minuto." },
          { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetIn / 1000)) } },
        );
      }
    }

    try {
      const response = await handler(req, ctx);
      const durationMs = Date.now() - start;
      logApiAudit({ method: req.method, path, status: response.status, durationMs, ip });
      return response;
    } catch (error: any) {
      const durationMs = Date.now() - start;
      if (error instanceof AuthRequiredError) return authRequiredResponse();
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { error: "Demasiadas solicitudes. Reintentá en un minuto." },
          { status: 429 },
        );
      }
      apiLogger.error({ err: error, method: req.method, path, durationMs }, "Handler error");
      logApiAudit({ method: req.method, path, status: 500, durationMs, ip, error: error.message });
      return NextResponse.json(
        { error: isProd() ? "Error interno del servidor" : error.message || "Error interno del servidor" },
        { status: 500 }
      );
    }
  };
}

function dummySession(): Session {
  return {
    user: {
      id: "guest",
      name: "guest",
      email: "guest@local",
      organizationId: "default",
      organizationRole: "admin",
      isLegacy: true,
    } as any,
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as unknown as Session;
}

export async function getSession(): Promise<Session | null> {
  if (process.env.AUTH_DISABLED === "1") {
    return dummySession();
  }

  try {
    return await getServerSession(authOptions);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  // Auth deshabilitada: sesión dummy para desarrollo/testing
  if (process.env.AUTH_DISABLED === "1") {
    return dummySession();
  }

  const session = await getSession();
  if (!session?.user) {
    throw new AuthRequiredError();
  }
  const key = `session:${(session.user as any).id || "unknown"}`;
  const rl = mutationRateLimiter(key);
  if (!rl.allowed) {
    throw new RateLimitError();
  }
  return session;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Sesión requerida");
    this.name = "AuthRequiredError";
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("Demasiadas solicitudes");
    this.name = "RateLimitError";
  }
}

export function authRequiredResponse() {
  return NextResponse.json(
    { error: "Sesión requerida." },
    { status: 401 },
  );
}

export function rateLimitResponse() {
  return NextResponse.json(
    { error: "Demasiadas solicitudes. Reintentá en un minuto." },
    { status: 429 },
  );
}

export function requireAgentApiKey(req: NextRequest): boolean {
  const expected = process.env.AGENT_API_KEY;
  if (!expected) return process.env.NODE_ENV !== "production";
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