---
tags: [agent-module]
aliases: [agent/capabilities/notifications]
---

# agent/capabilities/notifications

Agent module: agent/capabilities/notifications

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/agent/capabilities/notifications.ts`
- **ID:** `agent:agent/capabilities/notifications`

## Metadatos

```json
{
  "exports": [
    "sendNotification",
    "listNotifications",
    "resolveNotification",
    "dismissAllNotifications",
    "notificationToolSchemas"
  ],
  "importCount": 4,
  "lineCount": 224,
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
