"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  History,
  Search,
  MessageSquare,
  Bot,
  User,
  CalendarDays,
  Clock,
  Trash2,
  CornerUpLeft,
  Loader2,
  Inbox,
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ───

interface HistoryMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  intent?: string;
  createdAt: string;
}

interface ConversationSession {
  id: string;
  label: string;
  date: Date;
  dateKey: string; // "2024-01-15"
  messages: HistoryMessage[];
  preview: string;
  messageCount: number;
}

// ─── Utilidad: agrupar mensajes por sesión ───
// Una sesión = mensajes separados por menos de 30 minutos

const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutos

function groupMessagesBySession(messages: HistoryMessage[]): ConversationSession[] {
  if (messages.length === 0) return [];

  const sessions: ConversationSession[] = [];
  let currentMessages: HistoryMessage[] = [messages[0]];

  for (let i = 1; i < messages.length; i++) {
    const prev = new Date(messages[i - 1].createdAt).getTime();
    const curr = new Date(messages[i].createdAt).getTime();

    if (curr - prev < SESSION_GAP_MS) {
      currentMessages.push(messages[i]);
    } else {
      sessions.push(createSession(currentMessages));
      currentMessages = [messages[i]];
    }
  }
  sessions.push(createSession(currentMessages));

  // Ordenar más reciente primero
  sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
  return sessions;
}

function createSession(messages: HistoryMessage[]): ConversationSession {
  const firstMsg = messages[0];
  const lastMsg = messages[messages.length - 1];
  const date = new Date(lastMsg.createdAt);

  // Encontrar el primer mensaje del usuario para el preview
  const firstUserMsg = messages.find((m) => m.role === "user");
  const preview = firstUserMsg?.content.slice(0, 100) || "(sin mensajes)";

  // Generar ID único basado en timestamp
  const id = `session-${firstMsg.createdAt}-${messages.length}`;

  return {
    id,
    label: preview.slice(0, 50) + (preview.length > 50 ? "..." : ""),
    date,
    dateKey: date.toISOString().slice(0, 10),
    messages,
    preview,
    messageCount: messages.filter((m) => m.role === "user").length,
  };
}

// ─── Agrupar sesiones por fecha ───

function groupByDate(sessions: ConversationSession[]): Record<string, ConversationSession[]> {
  const grouped: Record<string, ConversationSession[]> = {};

  for (const session of sessions) {
    const key = session.dateKey;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(session);
  }

  return grouped;
}

function getDateLabel(dateKey: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (dateKey === today) return "Hoy";
  if (dateKey === yesterday) return "Ayer";

  const date = new Date(dateKey + "T00:00:00");
  return date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

// ─── Props ───

interface ConversationHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadConversation: (messages: HistoryMessage[]) => void;
}

// ─── Componente principal ───

export function ConversationHistory({
  open,
  onOpenChange,
  onLoadConversation,
}: ConversationHistoryProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["conversation-history"],
    queryFn: async () => {
      const r = await fetch("/api/agent/conversation");
      if (!r.ok) throw new Error("Error al cargar historial");
      const json = await r.json();
      return (json.messages || []) as HistoryMessage[];
    },
    enabled: open,
  });

  // Reset search when dialog opens
  useEffect(() => {
    if (open) setSearchQuery("");
  }, [open]);

  // Agrupar y filtrar
  const { sessions, groupedSessions } = useMemo(() => {
    if (!data || data.length === 0) {
      return { sessions: [], groupedSessions: {} };
    }

    let filtered = data;

    // Filtrar por búsqueda
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = data.filter(
        (m) =>
          m.content.toLowerCase().includes(q) ||
          (m.intent && m.intent.toLowerCase().includes(q))
      );
    }

    const sessionList = groupMessagesBySession(filtered);
    const grouped = groupByDate(sessionList);

    return { sessions: sessionList, groupedSessions: grouped };
  }, [data, searchQuery]);

  const handleLoad = (session: ConversationSession) => {
    onLoadConversation(session.messages);
    onOpenChange(false);
    toast.success(`Conversación cargada (${session.messageCount} mensajes)`);
  };

  const handleDeleteAll = async () => {
    try {
      const r = await fetch("/api/agent/conversation", { method: "DELETE" });
      if (!r.ok) throw new Error();
      refetch();
      toast.success("Historial eliminado");
    } catch {
      toast.error("Error al eliminar el historial");
    }
  };

  const totalSessions = sessions.length;
  const totalMessages = data?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <History className="h-4 w-4" />
            Historial de conversaciones
          </DialogTitle>
          <DialogDescription>
            {totalMessages > 0
              ? `${totalMessages} mensajes en ${totalSessions} conversaciones`
              : "Tus conversaciones con el asistente aparecen acá"}
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar en el historial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-[13px]"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && data && data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center mb-3">
                <Inbox className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-[13px] font-medium">Sin historial todavía</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                Tus conversaciones con el asistente se guardan automáticamente
              </p>
            </div>
          )}

          {!isLoading && searchQuery && sessions.length === 0 && data && data.length > 0 && (
            <div className="text-center py-12">
              <p className="text-[13px] text-muted-foreground">
                No se encontraron resultados para "{searchQuery}"
              </p>
            </div>
          )}

          {!isLoading &&
            Object.entries(groupedSessions).map(([dateKey, dateSessions]) => (
              <div key={dateKey}>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    {getDateLabel(dateKey)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {dateSessions.length}{" "}
                    {dateSessions.length === 1 ? "conversación" : "conversaciones"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {dateSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleLoad(session)}
                      className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-border hover:bg-accent/30 transition-all group"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* Preview */}
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-[13px] font-medium truncate">
                              {session.label}
                            </span>
                          </div>

                          {/* Message snippets */}
                          <div className="space-y-0.5 mt-1.5">
                            {session.messages.slice(0, 3).map((msg) => (
                              <div
                                key={msg.id}
                                className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                              >
                                {msg.role === "user" ? (
                                  <User className="h-2.5 w-2.5 mt-0.5 shrink-0 text-primary" />
                                ) : (
                                  <Bot className="h-2.5 w-2.5 mt-0.5 shrink-0 text-emerald-500" />
                                )}
                                <span className="line-clamp-1">
                                  {msg.content.slice(0, 80)}
                                  {msg.content.length > 80 ? "..." : ""}
                                </span>
                              </div>
                            ))}
                            {session.messages.length > 3 && (
                              <div className="text-[10px] text-muted-foreground/50 pl-4">
                                +{session.messages.length - 3} mensajes más
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 tabular">
                            {session.messageCount}{" "}
                            {session.messageCount === 1 ? "msg" : "msgs"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {session.date.toLocaleTimeString("es-AR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Cargar button on hover */}
                      <div className="flex justify-end mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                          <CornerUpLeft className="h-2.5 w-2.5" />
                          Cargar conversación
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Footer */}
        {data && data.length > 0 && (
          <div className="border-t pt-3 mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {totalMessages} mensajes guardados
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] text-destructive hover:text-destructive"
              onClick={handleDeleteAll}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar todo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
