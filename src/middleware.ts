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

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p));
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;

    // Si está logueado y va a /login → redirigir al home
    if (req.nextauth.token && pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Auth desactivada por env → siempre autorizado
        if (process.env.AUTH_DISABLED === "1") return true;

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
