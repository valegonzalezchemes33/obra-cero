// ============================================================
// AUTENTICACIÓN — NextAuth v4 con credenciales en env
// ============================================================
// Configuración minimalista para un CRM interno:
//  - Un único usuario admin (definido por variables de entorno)
//  - JWT strategy (sin persistencia en DB)
//  - Sesión de 8 horas
//
// Para crecer a múltiples usuarios + DB persistence más adelante,
// cambiar a CredentialsProvider con Prisma + bcrypt.
// ============================================================

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { timingSafeEqual } from "crypto";
import { authLogger } from "@/lib/logger";

const PLACEHOLDER_SECRETS = new Set([
  "obracero-dev-secret-change-me",
  "obracero-dev-secret-CHANGE-ME-IN-PRODUCTION-3f8a2c",
  "cambiar-en-produccion-openssl-rand-base64-32",
]);

function resolveSecret(): string {
  const secret =
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "";
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

export const AUTH_SECRET = resolveSecret();

function safeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) {
    // Para evitar filtrar Longitud en passwords de largo variable, se hace
    // un compare dummy de longitud fija cuando difieren.
    const filler = Buffer.alloc(ab.length);
    timingSafeEqual(ab, filler);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

function getEnvCredentials(): { user: string; password: string } | null {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  if (!user || !password) return null;
  return { user, password };
}

function isAuthDisabledAllowed(): boolean {
  // AUTH_DISABLED solo se acepta en desarrollo. En producción siempre fail-closed.
  if (process.env.AUTH_DISABLED !== "1") return false;
  return process.env.NODE_ENV !== "production";
}

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
      name: "Credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const env = getEnvCredentials();
        if (!env) {
          // Modo "sin credenciales configuradas" → guest solo fuera de producción.
          if (isAuthDisabledAllowed()) {
            return { id: "guest", name: "guest", email: "guest@local" };
          }
          return null;
        }

        if (!credentials?.username || !credentials?.password) return null;

        const okUser = safeStringEqual(credentials.username, env.user);
        const okPass = safeStringEqual(credentials.password, env.password);
        if (!okUser || !okPass) return null;

        return {
          id: env.user,
          name: env.user,
          email: `${env.user}@obracero.local`,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
};

// ─── Helper para chequear si la auth está activa ───

export function isAuthEnabled(): boolean {
  if (process.env.AUTH_DISABLED === "1" && process.env.NODE_ENV !== "production") {
    return false;
  }
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD);
}
