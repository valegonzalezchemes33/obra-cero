"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { HardHat, Eye, EyeOff, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorFromUrl = searchParams.get("error");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(
    errorFromUrl ? "Credenciales inválidas. Probá de nuevo." : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: username,
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
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-8 shadow-lg shadow-black/5">
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md shadow-primary/20">
              <HardHat className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-display tracking-tight">ObraCero</h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Sistema de gestión para constructoras
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/90" htmlFor="username">
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
                className="w-full rounded-lg border border-input bg-background/50 px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 placeholder:text-muted-foreground/50"
                placeholder="Ingresá tu usuario"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground/90" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full rounded-lg border border-input bg-background/50 px-3 py-2.5 pr-10 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50 placeholder:text-muted-foreground/50"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full rounded-lg bg-primary text-primary-foreground py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ingresando…
                </>
              ) : (
                "Ingresar"
              )}
            </button>
          </form>
        </div>
      </motion.div>

      <p className="text-center text-xs text-muted-foreground/60 mt-6">
        Acceso restringido · Sistema interno
      </p>
    </div>
  );
}

function LoginFormFallback() {
  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border/50 bg-card/80 p-8 shadow-lg">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-muted animate-pulse" />
          <div className="space-y-2 text-center">
            <div className="h-6 w-32 bg-muted rounded animate-pulse mx-auto" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse mx-auto" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-10 bg-muted rounded-lg animate-pulse" />
          <div className="h-10 bg-muted rounded-lg animate-pulse" />
          <div className="h-10 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/50 p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-info/[0.03] blur-3xl" />
      </div>
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
