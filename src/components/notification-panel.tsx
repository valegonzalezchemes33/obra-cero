"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, CheckCircle2, AlertTriangle, Info, Trash2, Clock, Sparkles, BellOff } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  status: string;
  createdAt: string;
}

export function NotificationPanel() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newNotification, setNewNotification] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar notificaciones iniciales
  const { data: initialData } = useQuery({
    queryKey: ["agent-actions"],
    queryFn: async () => {
      const r = await fetch("/api/agent");
      if (!r.ok) throw new Error("Error al cargar acciones");
      return r.json();
    },
    enabled: !open,
  });

  // Sincronizar estado inicial
  useEffect(() => {
    if (initialData?.actions) {
      const active = initialData.actions.filter((a: Notification) => a.status === "active");
      setNotifications(active);
      setUnreadCount(active.length);
      setLoading(false);
    }
  }, [initialData]);

  // SSE — actualizaciones en tiempo real
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        es = new EventSource("/api/events");
        esRef.current = es;

        es.addEventListener("connected", () => {
          console.log("[SSE] Conectado a notificaciones en tiempo real");
        });

        es.addEventListener("notifications", (event) => {
          try {
            const data = JSON.parse(event.data);
            const active = (data.actions || []).filter((a: Notification) => a.status === "active");

            setNotifications((prev) => {
              // Detectar si hay notificaciones nuevas
              const prevIds = new Set(prev.map((n) => n.id));
              const hasNew = active.some((a: Notification) => !prevIds.has(a.id));
              if (hasNew) {
                setNewNotification(true);
                // Auto-limpiar el indicador después de 5s
                setTimeout(() => setNewNotification(false), 5000);
                // Sonido sutil para críticas
                const critical = active.some((a: Notification) => a.severity === "critical" && !prevIds.has(a.id));
                if (critical) {
                  try {
                    const audio = new Audio("/sounds/notification.mp3");
                    audio.volume = 0.3;
                    audio.play().catch(() => {});
                  } catch {}
                }
              }
              return active;
            });
            setUnreadCount(data.count || active.length);
          } catch {}
        });

        es.onerror = () => {
          es?.close();
          // Reconectar después de 5s
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
      }
    }

    connect();

    return () => {
      es?.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch("/api/agent/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "dismissed" }),
      });
      if (!r.ok) throw new Error();
      return r.json();
    },
    onMutate: async (id) => {
      // Optimistic update
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-actions"] });
      queryClient.invalidateQueries({ queryKey: ["agent-actions-count"] });
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      // Dismiss all visible notifications
      const ids = notifications.map((n) => n.id);
      await Promise.all(
        ids.map((id) =>
          fetch("/api/agent/actions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status: "dismissed" }),
          })
        )
      );
    },
    onMutate: () => {
      setNotifications([]);
      setUnreadCount(0);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-actions"] });
      queryClient.invalidateQueries({ queryKey: ["agent-actions-count"] });
    },
  });

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-3.5 w-3.5" />;
      case "warning": return <AlertTriangle className="h-3.5 w-3.5" />;
      default: return <Info className="h-3.5 w-3.5" />;
    }
  };

  const severityStyles = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-destructive/10 border-destructive/20 text-destructive";
      case "warning":
        return "bg-warning-soft/70 border-warning/20 text-warning";
      default:
        return "bg-info-soft/70 border-info/20 text-info";
    }
  };

  return (
    <>
      {/* Botón campanita en la topbar */}
      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (o) setNewNotification(false); }}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="relative">
            <Bell className="h-4 w-4" />
            {newNotification && (
              <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-destructive animate-ping" />
            )}
            {unreadCount > 0 && (
              <span className={cn(
                "absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white",
                newNotification ? "bg-destructive" : "bg-primary"
              )}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-[380px] sm:w-[440px] p-0 flex flex-col">
          <SheetHeader className="px-5 py-4 border-b border-border/60 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-[15px] font-medium">Notificaciones</SheetTitle>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {unreadCount} activas
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => dismissAllMutation.mutate()}
                    title="Descartar todas"
                  >                        <BellOff className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7"
                  onClick={() => setOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {unreadCount > 0
                ? `Tenés ${unreadCount} ${unreadCount === 1 ? "notificación pendiente" : "notificaciones pendientes"}`
                : "Sin notificaciones activas"}
            </p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg border shimmer" />
                ))}
              </div>
            )}

            {!loading && notifications.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="text-[14px] font-medium">Todo al día</h3>
                <p className="text-[12px] text-muted-foreground mt-1 max-w-xs leading-relaxed">
                  No hay alertas ni notificaciones activas. El asistente monitorea tu operación en segundo plano.
                </p>
              </div>
            )}

            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "group relative p-3.5 rounded-lg border transition-all hover:shadow-xs",
                  n.severity === "critical"
                    ? "bg-destructive/[0.03] border-destructive/15"
                    : n.severity === "warning"
                    ? "bg-warning-soft/30 border-warning/15"
                    : "bg-info-soft/30 border-info/15"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "mt-0.5 h-7 w-7 rounded-md flex items-center justify-center shrink-0",
                    severityStyles(n.severity)
                  )}>
                    {severityIcon(n.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[13px] font-medium leading-snug">{n.title}</h4>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        onClick={() => dismissMutation.mutate(n.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {n.description && (
                      <p className="text-[12px] text-muted-foreground mt-1 leading-snug line-clamp-3">
                        {n.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/70">
                      <span className="flex items-center gap-1 tabular">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDateTime(n.createdAt)}
                      </span>
                      <Badge variant="outline" className={cn(
                        "text-[9px] px-1 py-0",
                        n.severity === "critical" ? "border-destructive/30 text-destructive" :
                        n.severity === "warning" ? "border-warning/30 text-warning" :
                        "border-info/30 text-info"
                      )}>
                        {n.severity === "critical" ? "Crítica" : n.severity === "warning" ? "Advertencia" : "Info"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-5 py-3 border-t border-border/60 shrink-0">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Generadas por el asistente
                </span>
                <button
                  onClick={() => dismissAllMutation.mutate()}
                  className="hover:text-foreground transition-colors font-medium"
                >
                  Descartar todas
                </button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
