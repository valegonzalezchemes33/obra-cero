"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Bot, Send, AlertTriangle, Zap, Trash2, Lightbulb, Clock, Sparkles, ChevronUp, CheckCircle2, XCircle, History } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS_BY_CONTEXT = [
  { label: "¿Cómo vamos?", group: "Panorama" },
  { label: "¿Qué alertas hay?", group: "Panorama" },
  { label: "Recomendaciones", group: "Panorama" },
  { label: "Detectar anomalías", group: "Análisis" },
  { label: "Margen por obra", group: "Análisis" },
  { label: "Comparar con mes anterior", group: "Análisis" },
  { label: "¿Qué materiales faltan?", group: "Inventario" },
  { label: "Valor del inventario", group: "Inventario" },
  { label: "Stock muerto", group: "Inventario" },
  { label: "Estado de las obras", group: "Obras" },
  { label: "Proyección de presupuesto", group: "Obras" },
  { label: "Flujo de caja", group: "Finanzas" },
  { label: "¿En qué gasté más?", group: "Finanzas" },
  { label: "Tareas atrasadas", group: "Tareas" },
];

interface Msg {
  role: "user" | "agent";
  content: string;
  intent?: string;
  suggestions?: string[];
  actions?: any[];
  timestamp: Date;
  _requiresConfirmation?: any;
  _confirmed?: boolean;
  _completed?: boolean;
}

interface AgentViewProps {
  initialQuery?: string | null;
}

export function AgentView({ initialQuery }: AgentViewProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const initialQueryConsumed = useRef<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Cargar historial de conversación al montar
  const { data: historyData } = useQuery({
    queryKey: ["agent-history"],
    queryFn: async () => {
      const r = await fetch("/api/agent/conversation");
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !historyLoaded,
  });

  useEffect(() => {
    if (historyData && !historyLoaded) {
      const historyMessages: Msg[] = (historyData.messages || []).map((m: any) => ({
        role: m.role,
        content: m.content,
        intent: m.intent || undefined,
        suggestions: m.suggestions || undefined,
        timestamp: new Date(m.createdAt),
      }));
      if (historyMessages.length > 0) {
        setMessages(historyMessages);
      }
      setHistoryLoaded(true);
    }
  }, [historyData, historyLoaded]);

  const { data: actions } = useQuery({
    queryKey: ["agent-actions"],
    queryFn: async () => {
      const r = await fetch("/api/agent");
      if (!r.ok) throw new Error("Error al cargar acciones");
      return r.json();
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Detect scroll position to show "scroll to bottom" button
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200);
  };

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const r = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      if (!r.ok) throw new Error("Error al procesar el mensaje");
      return r.json();
    },
    onMutate: (text) => {
      setMessages((prev) => [...prev, { role: "user", content: text, timestamp: new Date() }]);
      setIsThinking(true);
      setInput("");
    },
    onSuccess: (data) => {
      // Detectar si es una respuesta de confirmación
      const isConfirmation = data._requiresConfirmation || data._confirmed || data._completed;

      // Para confirmaciones: agregar la respuesta del agente
      setMessages((prev) => [
        ...prev,
        {
          role: "agent",
          content: data.text,
          intent: data.intent,
          suggestions: data.suggestions || (isConfirmation ? ["Sí, confirmar", "No, cancelar"] : undefined),
          actions: data.actions,
          timestamp: new Date(),
          _requiresConfirmation: data._requiresConfirmation || undefined,
          _confirmed: data._confirmed || undefined,
          _completed: data._completed || undefined,
        },
      ]);
      setIsThinking(false);
      queryClient.invalidateQueries({ queryKey: ["agent-actions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => {
      setIsThinking(false);
      toast.error("Error procesando el mensaje");
    },
  });

  // Handle initial query from Cmd+K
  useEffect(() => {
    if (initialQuery && initialQuery !== initialQueryConsumed.current && !isThinking) {
      initialQueryConsumed.current = initialQuery;
      sendMutation.mutate(initialQuery);
    }
  }, [initialQuery, isThinking, sendMutation]);

  const clearMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/agent/conversation", { method: "DELETE" });
      if (!r.ok) throw new Error("Error al limpiar");
    },
    onSuccess: () => {
      setMessages([]);
      toast.success("Conversación reiniciada");
    },
    onError: () => {
      toast.error("Error al limpiar la conversación");
    },
  });

  const runAutomationsMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/automations/run", { method: "POST" });
      if (!r.ok) throw new Error("Error al ejecutar automatizaciones");
      return r.json();
    },
    onSuccess: (data) => {
      toast.success(`${data.count} ${data.count === 1 ? "automatización activada" : "automatizaciones activadas"}`);
      queryClient.invalidateQueries({ queryKey: ["agent-actions"] });
    },
    onError: () => {
      toast.error("Error al ejecutar automatizaciones");
    },
  });

  const dismissAction = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch("/api/agent/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "dismissed" }),
      });
      if (!r.ok) throw new Error("Error al descartar acción");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-actions"] });
    },
    onError: () => {
      toast.error("Error al descartar la acción");
    },
  });

  const handleSend = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isThinking) return;
    sendMutation.mutate(msg);
  };

  // Agrupar sugerencias por grupo
  const groupedSuggestions = SUGGESTIONS_BY_CONTEXT.reduce((acc, s) => {
    if (!acc[s.group]) acc[s.group] = [];
    acc[s.group].push(s.label);
    return acc;
  }, {} as Record<string, string[]>);

  // Mostrar countdown de mensajes
  const messageCount = messages.filter((m) => m.role === "user").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-medium">Asistente IA</span>
              <Badge variant="success" className="tabular">
                <span className="size-1.5 rounded-full bg-success mr-1" /> activo
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Memoria conversacional · {messageCount} mensajes en esta sesión
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => runAutomationsMutation.mutate()} disabled={runAutomationsMutation.isPending}>
            <Zap className="h-3.5 w-3.5 mr-1.5" /> Ejecutar automatizaciones
          </Button>
          {messages.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => clearMutation.mutate()}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat */}
        <Card className="lg:col-span-2 flex flex-col h-[640px] relative">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-[13px]">Conversación</CardTitle>
            <CardDescription>Escribí en español, en lenguaje natural</CardDescription>
          </CardHeader>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
          >
            {messages.length === 0 && !isThinking && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <div className="h-10 w-10 rounded-md bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <h3 className="text-[15px] font-medium">¿En qué te puedo ayudar?</h3>
                <p className="text-[13px] text-muted-foreground mt-1.5 max-w-md leading-relaxed">
                  Puedo analizar tu operación, darte recomendaciones, proyectar presupuestos,
                  detectar gastos atípicos y mucho más. Ahora con **memoria conversacional**: entiendo
                  referencias como "esa obra" o "este mes".
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center max-w-xl mt-5">
                  {["¿Cómo vamos?", "¿Qué alertas hay?", "Recomendaciones", "Detectar anomalías", "Margen por obra", "¿Qué materiales faltan?"].map((s) => (
                    <Button key={s} variant="outline" size="sm" className="h-7 text-[12px]" onClick={() => handleSend(s)}>
                      {s}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className="group animate-fade-up">
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-primary text-primary-foreground rounded-lg rounded-br-sm px-3.5 py-2 text-[13px] leading-relaxed">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-muted-foreground mb-1 font-medium">Asistente</div>

                      {/* Badge de confirmación */}
                      {m._confirmed && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success text-[10px] font-medium mb-2">
                          <CheckCircle2 className="h-3 w-3" /> Acción confirmada
                        </div>
                      )}
                      {m._requiresConfirmation && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning/10 border border-warning/20 text-warning text-[10px] font-medium mb-2">
                          <AlertTriangle className="h-3 w-3" /> Requiere confirmación
                        </div>
                      )}

                      <div className="prose prose-sm max-w-none text-[13px] leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground [&_p]:my-1.5 [&_ul]:my-2 [&_ul]:space-y-1 [&_li]:text-[13px] [&_li]:leading-relaxed [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[12px] [&_code]:font-mono [&_*]:text-foreground/90">
                        <ReactMarkdown
                          components={{
                            li: ({ children }) => (
                              <li className="flex gap-2">
                                <span className="text-primary mt-1.5 size-1 shrink-0 rounded-full bg-primary" />
                                <span>{children}</span>
                              </li>
                            ),
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                      </div>

                      {/* Botones de confirmación */}
                      {m._requiresConfirmation && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" className="h-8 text-[12px]" onClick={() => handleSend("sí")}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Sí, confirmar
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => handleSend("no")}>
                            <XCircle className="h-3.5 w-3.5 mr-1.5" /> No, cancelar
                          </Button>
                        </div>
                      )}

                      {m.suggestions && m.suggestions.length > 0 && !m._requiresConfirmation && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {m.suggestions.map((s) => (
                            <Button key={s} variant="outline" size="xs" className="h-6 text-[11px]" onClick={() => handleSend(s)}>
                              {s}
                            </Button>
                          ))}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground/70 mt-2 tabular opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.timestamp.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex gap-2.5">
                <div className="h-7 w-7 rounded-md bg-primary/10 ring-1 ring-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-muted-foreground mb-1 font-medium">Asistente</div>
                  <div className="flex gap-1.5 py-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 animate-pulse" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {showScrollBtn && (
            <button
              onClick={() => {
                if (scrollRef.current) scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
              }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 size-7 rounded-full border border-border bg-card shadow-md flex items-center justify-center hover:bg-muted transition-colors"
              aria-label="Scroll to bottom"
            >
              <ChevronUp className="h-3.5 w-3.5 rotate-180" />
            </button>
          )}

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <Input
                placeholder="Preguntá sobre tu operación…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                disabled={isThinking}
                className="flex-1 h-9"
              />
              <Button onClick={() => handleSend()} disabled={isThinking || !input.trim()} size="icon" className="h-9 w-9">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[10px] text-muted-foreground">
                <kbd className="font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">⏎</kbd> enviar ·{" "}
                <kbd className="font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">Shift+⏎</kbd> nueva línea
              </span>
              <span className="text-[10px] text-muted-foreground">100% local</span>
            </div>
          </div>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Alertas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[13px]">
                <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                Alertas activas
              </CardTitle>
              <CardDescription>{actions?.actions?.length || 0} generadas por automatizaciones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 max-h-72 overflow-y-auto pt-0">
              {(!actions?.actions || actions.actions.length === 0) && (
                <p className="text-[12px] text-muted-foreground text-center py-3">Sin alertas activas</p>
              )}
              {actions?.actions?.map((a: any) => (
                <div
                  key={a.id}
                  className={`p-2.5 rounded-md border text-[12px] group ${
                    a.severity === "critical"
                      ? "bg-destructive/5 border-destructive/15"
                      : a.severity === "warning"
                      ? "bg-warning-soft/50 border-warning/15"
                      : "bg-info-soft/50 border-info/15"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-[12px] leading-tight">{a.title}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{a.description}</div>
                    </div>
                    <Button size="icon-sm" variant="ghost" className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => dismissAction.mutate(a.id)}>
                      <Trash2 className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 mt-1.5 flex items-center gap-1 tabular">
                    <Clock className="h-2.5 w-2.5" /> {formatDateTime(a.createdAt)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick queries */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[13px]">
                <Lightbulb className="h-3.5 w-3.5 text-warning" />
                Consultas rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 max-h-80 overflow-y-auto">
              {Object.entries(groupedSuggestions).map(([group, items]) => (
                <div key={group}>
                  <div className="micro-label text-muted-foreground/70 mb-1.5 px-1">{group}</div>
                  <div className="space-y-0.5">
                    {items.map((s) => (
                      <Button key={s} variant="ghost" size="sm" className="w-full justify-start text-left h-7 text-[12px] font-normal"
                        onClick={() => handleSend(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Memory Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[13px]">
                <History className="h-3.5 w-3.5 text-primary" />
                Estado de memoria
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mensajes en sesión</span>
                  <span className="font-medium">{messageCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Alertas activas</span>
                  <span className="font-medium">{actions?.actions?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Resolución de referencias</span>
                  <Badge variant="success" className="text-[9px]">
                    Activo
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Confirmación acciones</span>
                  <Badge variant="success" className="text-[9px]">
                    Activo
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
