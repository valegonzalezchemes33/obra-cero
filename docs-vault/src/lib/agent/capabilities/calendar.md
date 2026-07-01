---
tags: [agent-module]
aliases: [agent/capabilities/calendar]
---

# agent/capabilities/calendar

Agent module: agent/capabilities/calendar

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/agent/capabilities/calendar.ts`
- **ID:** `agent:agent/capabilities/calendar`

## Metadatos

```json
{
  "exports": [
    "scheduleEvent",
    "listEvents",
    "completeEvent",
    "cancelEvent",
    "calendarToolSchemas"
  ],
  "importCount": 4,
  "lineCount": 290,
  "intentCount": 0,
  "isTool": false,
  "isHandler": false,
  "isDispatcher": false,
  "isAutomation": false
}
```

## Relacionado

- [[architecture/agents|agent-module]] — Arquitectura de agent-modules
- [[src/lib/agent]]
- [[src/lib/tools/registry-definitions]]

## Dependencias

- `@/lib/db`
- `@/lib/agent`
- `@/lib/logger`
