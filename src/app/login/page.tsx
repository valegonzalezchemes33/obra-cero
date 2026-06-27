"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorFromUrl = searchParams.get("error");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    errorFromUrl ? "Credenciales inválidas. Probá de nuevo." : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (!res) {
        setError("Sin respuesta del servidor.");
        return;
      }
      if (res.error) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-border/60 bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">OC</span>
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">ObraCero</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sistema de gestión para constructoras
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="username">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              placeholder="admin"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full rounded-md bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Acceso restringido · Sistema interno
      </p>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-xl border border-border/60 bg-card p-8 shadow-sm animate-pulse">
        <div className="h-12 w-12 mx-auto rounded-xl bg-muted mb-8" />
        <div className="space-y-3">
          <div className="h-9 bg-muted rounded-md" />
          <div className="h-9 bg-muted rounded-md" />
          <div className="h-9 bg-muted rounded-md" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
