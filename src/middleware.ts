// ============================================================
// MIDDLEWARE — Protección de rutas con NextAuth (JWT)
// ============================================================
// Por defecto, todas las rutas de la app requieren sesión.
// Las únicas rutas públicas son:
//   - /login            (formulario de autenticación)
//   - /api/auth/*       (endpoint de NextAuth)
//   - /api/health       (healthcheck opcional)
//   - /_next/static/*   (assets)
//   - /favicon.ico
//
// Para desarrollo/desarrollo inicial donde todavía no hay
// ADMIN_USER/ADMIN_PASSWORD configurados, definir:
//   AUTH_DISABLED=1
// en .env para desactivar la auth.
// ============================================================

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/health",
  "/_next",
  "/favicon.ico",
  "/sounds",
];

const CSRF_EXEMPT_PATHS = [
  "/api/auth",
  "/api/webhooks",
  "/api/workflows/webhook",
  "/api/health",
];

const STATE_CHANGING_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p));
}

function isCsrfExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isAuthDisabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.AUTH_DISABLED === "1";
}

function getExpectedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS || process.env.NEXTAUTH_URL || process.env.ALLOWED_ORIGIN || "";
  const candidates = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const origins: string[] = [];
  for (const c of candidates) {
    try {
      origins.push(new URL(c).origin);
    } catch {
      // ignore invalid URLs
    }
  }
  return origins;
}

function checkCsrf(req: { method: string; nextUrl: URL; headers: Headers }): boolean {
  if (!STATE_CHANGING_METHODS.includes(req.method)) return true;
  if (isCsrfExempt(req.nextUrl.pathname)) return true;

  const origin = req.headers.get("origin");
  if (!origin) return true;

  const expected = getExpectedOrigins();
  if (expected.length === 0) return true;

  try {
    const parsedOrigin = new URL(origin).origin;
    if (expected.includes(parsedOrigin)) return true;
    if (/^https?:\/\/localhost(:\d+)?$/.test(parsedOrigin)) return true;
  } catch {
    return false;
  }

  return false;
}

const isProd = process.env.NODE_ENV === "production";

const LLM_ENDPOINTS: Record<string, string> = {
  groq: "https://api.groq.com",
  openai: "https://api.openai.com",
  anthropic: "https://api.anthropic.com",
  ollama: "",
};

const activeProvider = (process.env.LLM_ACTIVE_PROVIDER || "groq").toLowerCase();
const llmEndpoint = LLM_ENDPOINTS[activeProvider] || LLM_ENDPOINTS.groq;
const connectSrc = `connect-src 'self'${llmEndpoint ? ` ${llmEndpoint}` : ""}`;

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  connectSrc,
  "frame-ancestors 'none'",
  "base-uri 'self'",
].join("; ");

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;

    if (req.nextauth.token && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (!checkCsrf(req)) {
      return new NextResponse(JSON.stringify({ error: "CSRF validation failed" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const res = NextResponse.next();

    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.headers.set("X-XSS-Protection", "0");

    if (isProd) {
      res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    }

    res.headers.set("Content-Security-Policy", CSP);

    return res;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Auth desactivada (solo fuera de producción).
        if (isAuthDisabled()) return true;

        const { pathname } = req.nextUrl;
        if (isPublic(pathname)) return true;

        // Cualquier otra ruta requiere token
        return Boolean(token);
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match todas las rutas excepto:
     *  - api/auth/* (manejado por NextAuth)
     *  - _next/static, _next/image (assets)
     *  - favicon.ico, robots.txt
     *  - archivos con extensiones comunes de imagens/fonts
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|mp3|woff|woff2|ttf|eot)).*)",
  ],
};
