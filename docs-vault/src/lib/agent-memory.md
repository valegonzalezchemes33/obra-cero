---
tags: [agent-module]
aliases: [agent-memory]
---

# agent-memory

Agent module: agent-memory

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/agent-memory.ts`
- **ID:** `agent:agent-memory`

## Metadatos

```json
{
  "exports": [
    "getConversationContext",
    "resolveReferences",
    "getPendingAction",
    "savePendingAction",
    "clearPendingAction",
    "saveContextMetadata",
    "CONFIRMATION_INTENTS",
    "requiresConfirmation",
    "isConfirmation",
    "isCancellation",
    "generateActionSummary",
    "savePendingDelete",
    "getPendingDelete",
    "clearPendingDelete",
    "saveUndoSnapshot",
    "findUndoSnapshot",
    "executeUndo"
  ],
  "importCount": 3,
  "lineCount": 568,
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

## Dependencias

- `@/lib/db`
- `./agent`
- `@/lib/logger`
