// ============================================================
// AUTENTICACIÓN — NextAuth v4 con Prisma (multi-tenant)
// ============================================================
// Soporta dos modos:
//   1. DB mode (recomendado): usuarios registrados en Prisma
//   2. Env mode (legacy): ADMIN_USER/ADMIN_PASSWORD para migración
//
// El login espera "email" (puede ser el username legacy también).
// El JWT incluye userId, organizationId y role para tenant isolation.
// ============================================================

import type { NextAuthOptions, Session, TokenSet } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { timingSafeEqual } from "crypto";
import { authLogger } from "@/lib/logger";
import { loginRateLimiter } from "@/lib/rate-limit";
import { loginUser } from "@/lib/auth-service";
import { db } from "@/lib/db";

const PLACEHOLDER_SECRETS = new Set([
  "obracero-dev-secret-change-me",
  "obracero-dev-secret-CHANGE-ME-IN-PRODUCTION-3f8a2c",
  "cambiar-en-produccion-openssl-rand-base64-32",
]);

function resolveSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      throw new Error(
        "❌ NEXTAUTH_SECRET no configurado. Generá uno con `openssl rand -base64 32`.",
      );
    }
    throw new Error(
      "❌ NEXTAUTH_SECRET no configurado. Para dev podés setear NEXTAUTH_SECRET arbitrario.",
    );
  }

  if (isProd && PLACEHOLDER_SECRETS.has(secret)) {
    throw new Error(
      "❌ NEXTAUTH_SECRET es un placeholder. En producción requiere un valor único (openssl rand -base64 32).",
    );
  }

  return secret;
}

const AUTH_SECRET = resolveSecret();

function safeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    const filler = Buffer.alloc(ab.length);
    timingSafeEqual(ab, filler);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

// ─── Legacy env credentials (backward compat) ────────────────

function getEnvCredentials(): { user: string; password: string } | null {
  const user = process.env.ADMIN_USER?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!user || !password) return null;
  return { user, password };
}

function isAuthDisabledAllowed(): boolean {
  if (process.env.AUTH_DISABLED !== "1") return false;
  return process.env.NODE_ENV !== "production";
}

// ─── Extender tipos de Session ───────────────────────────────

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      organizationId?: string;
      organizationRole?: string;
      organizationName?: string;
      isLegacy?: boolean;
    };
  }

  // Extend JWT (no TokenSet — that causes duplicate identifier issues)
  interface JWT {
    organizationId?: string;
    organizationRole?: string;
    organizationName?: string;
    isLegacy?: boolean;
  }
}

// ─── Auth Options ─────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  secret: AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 horas
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Contraseña", type: "password" },
        organizationId: { label: "Organización", type: "text" },
      },
      async authorize(credentials, req) {
        const ip =
          req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req?.headers?.get("x-real-ip") ||
          "unknown";

        const rl = loginRateLimiter(ip);
        if (!rl.allowed) {
          authLogger.warn({ ip, remaining: rl.remaining, resetIn: rl.resetIn }, "Login rate limited");
          return null;
        }

        if (!credentials?.email || !credentials?.password) return null;

        // ─── MODO 1: DB Auth (intentar con Prisma) ───
        try {
          const result = await loginUser(credentials.email, credentials.password);
          if (result.ok) {
            // Si hay múltiples orgs, usar la seleccionada (o la primera)
            const orgId = credentials.organizationId || result.organizations[0]?.id;
            const org = result.organizations.find((o) => o.id === orgId) || result.organizations[0];
            return {
              id: result.user.id,
              name: result.user.name || result.user.email.split("@")[0],
              email: result.user.email,
              organizationId: org?.id,
              organizationRole: org?.role,
              organizationName: org?.name,
              isLegacy: false,
            };
          }
        } catch (e) {
          authLogger.warn({ err: e }, "DB login falló, probando env fallback");
        }

        // ─── MODO 2: Env Auth (legacy, backward compat) ───
        const env = getEnvCredentials();
        console.log("[AUTH_DEBUG] getEnvCredentials result:", {
          hasUser: !!process.env.ADMIN_USER,
          hasPass: !!process.env.ADMIN_PASSWORD,
          userLen: (process.env.ADMIN_USER || "").length,
          passLen: (process.env.ADMIN_PASSWORD || "").length,
          found: !!env
        });
        if (!env) {
          if (isAuthDisabledAllowed()) {
            return { id: "guest", name: "guest", email: "guest@local" };
          }
          return null;
        }

        // El campo "email" puede contener el username legacy
        const okUser = safeStringEqual(credentials.email.trim(), env.user);
        const okPass = safeStringEqual(credentials.password, env.password);
        console.log("[AUTH_DEBUG] comparison:", {
          email: credentials.email,
          envUser: env.user,
          emailLen: credentials.email.length,
          envUserLen: env.user.length,
          okUser,
          okPass
        });
        if (okUser && okPass) {
          return {
            id: env.user,
            name: env.user,
            email: `${env.user}@obracero.local`,
            isLegacy: true,
          };
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = (user as any).id;
        token.name = user.name;
        token.email = user.email;
        token.organizationId = (user as any).organizationId;
        token.organizationRole = (user as any).organizationRole;
        token.organizationName = (user as any).organizationName;
        token.isLegacy = (user as any).isLegacy;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).organizationRole = token.organizationRole;
        (session.user as any).organizationName = token.organizationName;
        (session.user as any).isLegacy = token.isLegacy;
      }
      return session;
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────

export function isAuthEnabled(): boolean {
  if (process.env.AUTH_DISABLED === "1" && process.env.NODE_ENV !== "production") {
    return false;
  }
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD);
}

/**
 * Obtiene la organización activa desde la sesión.
 * Si el usuario es legacy (env vars), busca la primera organización real en la DB.
 */
export function getSessionOrganization(session: Session | null): {
  organizationId: string;
  role: string;
  name: string;
} | null {
  const user = session?.user as any;
  if (!user) return null;

  // Usuarios legacy: buscar la primera organización real en la DB
  if (user.isLegacy) {
    // Síncrono no puede await, pero podemos retornar un placeholder
    // que luego se resuelve en tenant.ts
    return {
      organizationId: "__find_first_org__", // placeholder resuelto en getTenant()
      role: "admin",
      name: "Default",
    };
  }

  if (user.organizationId) {
    return {
      organizationId: user.organizationId,
      role: user.organizationRole || "admin",
      name: user.organizationName || "Workspace",
    };
  }

  return null;
}
