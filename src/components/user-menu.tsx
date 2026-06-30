"use client";

import { useSession, signOut } from "next-auth/react";
import { LogOut, User, Settings, ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />;
  }

  if (!session?.user) {
    return null;
  }

  const name = session.user.name || session.user.email || "Usuario";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/60 transition-colors"
      >
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center text-xs font-semibold shadow-sm">
          {initial}
        </div>
        <span className="text-[13px] font-medium hidden sm:block">{name}</span>
        <ChevronDown className="h-3 w-3 text-muted-foreground hidden sm:block" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-border/60 bg-popover p-1 shadow-lg shadow-black/5"
            >
              <div className="px-2.5 py-2 border-b border-border/40 mb-1">
                <div className="text-[13px] font-medium truncate">{name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{session.user.email}</div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] text-destructive hover:bg-destructive/5 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Cerrar sesión
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
