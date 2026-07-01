# Arquitectura del Agente IA — ObraCero

Relacionado: [[architecture/agents]], [[agents/extending]], [[agents/tools]], [[memory/roadmap]]

## Overview

El agente de ObraCero es un sistema conversacional de tres niveles con IA integrada que funciona como **empleado virtual** del CRM de construcción. Consulta, ejecuta acciones y automatiza procesos mediante una arquitectura modular basada en Tool Calling.

Ver [[architecture/agents]] para el listado completo de módulos y [[agents/tools]] para el catálogo de herramientas.

---

## Arquitectura de Capas

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION        Chat UI · ToolBadges · PlanViewer     │
│  src/components/     agent.tsx (views)                      │
├─────────────────────────────────────────────────────────────┤
│  ORQUESTACIÓN        Router / Planificador                  │
│  src/lib/agent/router.ts    │                               │
│  src/lib/agent/context.ts    ├─ Planner                      │
├─────────────────────────────────────────────────────────────┤
│  CAPACIDADES         Tool Registry (24+ herramientas)       │
│  src/lib/agent/       ├─ CRUD Tools (proyectos, tareas…)     │
│  capabilities/       ├─ Capabilities (calendario, docs…)    │
│                      ├─ Memory Tools (preferencias)         │
│                      └─ Search Tools (búsquedas)            │
├─────────────────────────────────────────────────────────────┤
│  SERVICIOS           agent.ts · agent-extended.ts            │
│  src/lib/            dispatchByIntent() → handlers         │
├─────────────────────────────────────────────────────────────┤
│  LLM                 llm-provider.ts → groq.ts → Groq API    │
│  src/lib/            Multi-provider: Groq/OpenAI/Anthropic  │
└─────────────────────────────────────────────────────────────┘
```

---

## Flujo de Mensaje

```
Usuario
   │
   ▼
POST /api/agent  (legacy)  ←── O ──→  POST /api/agent/message  (nuevo)
   │                                      │
   ▼                                      ▼
normalizeMessage()                   checkRateLimit()
   │                                 sanitizeForGroq()
   ▼                                      │
getConversationContext()                    route()
   │                                 ┌────┴────────────────────┐
   ▼                                 │                         │
getPendingAction()?                  │  Groq Intent Detection  │
   │                                 │  NLU Local fallback     │
   ▼                                 │  Compound detection     │
tryGroqCompoundIntent()                └────┬────────────────────┘
   │                                          │
   ├─ compound → processCompoundMessage()    │
   │                                         ▼
   ├─ action → processMessageWithIntent()  AgentPlan
   │      │                                  │
   │      ▼                                  │
   │   dispatchByIntent()               requiresConfirmation?
   │      │                              │
   │      ▼                              ├─ Sí → confirmation prompt
   │   executeToolCall()                 └─ No → executePlan()
   │      │                                      │
   │      ▼                                      ▼
   │   handlers                         executeToolCall()
   │      │                                      │
   ├─ query → enrichQueryWithGroq()      ┌────┴────────────────────┐
   │                                     │                         │
   ├─ action → enrichActionResponseWithGroq │  Audit Log             │
   │                                     │  Tool Registry           │
   └─ fallback → NLU local                  │  tool-execution.ts    │
                                           └────┬────────────────────┘
                                                  │
                                                  ▼
                                           Groq Response (enriched)
                                                  │
                                                  ▼
                                            AgentMessage (DB)
                                                  │
                                                  ▼
                                               Usuario
```

---

## Archivos Clave

### Nuevos (FASE 1-5)

| Archivo | Descripción |
|---|---|
| `src/lib/agent/types.ts` | Tipos unificados: `AgentPlan`, `PlanStep`, `AgentContext` |
| `src/lib/agent/context.ts` | Context Manager: historial, preferencias, scratchpad |
| `src/lib/agent/router.ts` | Router/Planificador: decide intent + herramientas |
| `src/lib/agent/audit.ts` | Audit log + rate limiting + sanitización PII |
| `src/lib/agent/capabilities/memory-tools.ts` | remember/recall/forget preference |
| `src/lib/agent/capabilities/calendar.ts` | schedule/list/complete/cancel event |
| `src/lib/agent/capabilities/notifications.ts` | send/list/resolve/dismiss notifications |
| `src/lib/agent/capabilities/documents.ts` | generate_document (7 tipos) |
| `src/lib/agent/capabilities/search-tools.ts` | search projects/clients/budgets |
| `src/app/api/agent/message/route.ts` | Endpoint unificado |
| `src/components/agent/tool-badge.tsx` | Badges visuales de tools usadas |

### Extendidos (FASE 5)

| Archivo | Cambio |
|---|---|
| `src/lib/agent.ts` | +17 nuevos intents `capability_*` |
| `src/lib/tool-registry.ts` | +17 nuevas tools + schemas |
| `src/lib/tools/registry-definitions.ts` | Implementaciones de las 17 nuevas tools |
| `src/lib/tool-execution.ts` | Llamadas a audit log (fire-and-forget) |

### Existentes (sin modificar)

| Archivo | Rol |
|---|---|
| `src/lib/llm-provider.ts` | Cliente multi-provider (Groq/OpenAI/Anthropic/Ollama) |
| `src/lib/groq.ts` | Wrapper específico de Groq |
| `src/lib/groq-integration.ts` | Bridge Groq ↔ Agente |
| `src/lib/agent-nlu.ts` | Normalizador de mensajes en español |
| `src/lib/agent-memory.ts` | Memoria conversacional, pending actions, undo |
| `src/lib/agent-rag.ts` | RAG local con TF-IDF |
| `src/lib/agent-predictive.ts` | Detección de patrones |
| `src/lib/workflow-engine.ts` | Motor de automatizaciones |
| `src/app/api/agent/route.ts` | Endpoint legacy (mantiene compatibilidad) |

---

## Endpoints del Agente

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/agent` | Legacy — flujo original del agente |
| GET | `/api/agent` | Lista acciones activas + corre automatizaciones |
| POST | `/api/agent/stream` | Streaming SSE con Groq |
| GET | `/api/agent/conversation` | Historial de mensajes |
| GET | `/api/agent/tools` | Catálogo de herramientas |
| POST | `/api/agent/tools/execute` | Ejecutar una tool específica |
| GET | `/api/agent/actions` | Acciones/alertas pendientes |
| **POST** | **`/api/agent/message`** | **Nuevo endpoint unificado (Router + Planner)** |
| GET | `/api/agent/message` | Catálogo de capacidades + stats |

---

## Decisiones de Diseño

### 1. La IA nunca accede directamente a la DB
Todas las queries van por `db` (Prisma) o a través de funciones en `src/lib/agent/capabilities/*`. El Context Manager delega, no consulta.

### 2. Compatibilidad hacia atrás
El endpoint `/api/agent` sigue funcionando exactamente igual. El nuevo `/api/agent/message` es adicional y usa el Router.

### 3. Groq es opcional
Si `GROQ_API_KEY` no está configurada, el sistema cae al NLU local con fallback a regex patterns. No hay degradación catastrófica.

### 4. Capabilities como modulo
Las nuevas tools están aisladas en `src/lib/agent/capabilities/`. Cada archivo es independiente y expose funciones `execute` que retornan `AgentResponse`.

### 5. Audit log no bloqueante
Todas las llamadas a `auditLog` usan `.catch(() => {})` para no afectar la latencia de las respuestas.

### 6. Rate limiting por sesión
Límite de 30 requests/min por session ID (en memoria, sin Redis). Se puede mejorar con Redis en producción.

---

## Groq API Key — Configuración

```env
# .env
GROQ_API_KEY=gsk_...         # Obtener en https://console.groq.com/keys
LLM_ACTIVE_PROVIDER=groq       # Provider por defecto (ya viene así)
```

Cuando se cargue la clave, todas las funciones de IA enriquecimiento funcionan automáticamente.

---

## Métricas y Observabilidad

- **Audit log** en `AgentAction` (type="audit") con severity, duración, tool, intent, fuente (groq/local), confidence
- **`GET /api/agent/message`** devuelve stats: toolsCount, llmProvider, llmAvailable, newCapabilities
- **`auditToolExecution`** en `tool-execution.ts` registra cada ejecución de tool