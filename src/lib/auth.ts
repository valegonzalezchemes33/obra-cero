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

export const AUTH_SECRET = process.env.NEXTAUTH_SECRET || "obracero-dev-secret-change-me";

function getEnvCredentials(): { user: string; password: string } | null {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  if (!user || !password) return null;
  return { user, password };
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
          // Modo "sin credenciales configuradas" → السماح (allow) si AUTH_DISABLED=1
          if (process.env.AUTH_DISABLED === "1") {
            return { id: "guest", name: "guest", email: "guest@local" };
          }
          return null;
        }

        if (!credentials?.username || !credentials?.password) return null;

        const okUser = credentials.username === env.user;
        const okPass = credentials.password === env.password;
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
  if (process.env.AUTH_DISABLED === "1") return false;
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASSWORD);
}
