"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />;
  }

  if (!session?.user) {
    return null;
  }

  const initial = (session.user.name || session.user.email || "?").slice(0, 1).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      <div
        className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold"
        title={session.user.name || session.user.email || ""}
      >
        {initial}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="gap-1.5 hidden sm:inline-flex"
        title="Cerrar sesión"
      >
        <LogOut className="h-3.5 w-3.5" />
        Salir
      </Button>
    </div>
  );
}
