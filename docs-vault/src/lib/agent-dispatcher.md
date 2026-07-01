---
tags: [agent-module]
aliases: [agent-dispatcher]
---

# agent-dispatcher

Agent module: agent-dispatcher

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/agent-dispatcher.ts`
- **ID:** `agent:agent-dispatcher`

## Metadatos

```json
{
  "exports": [
    "createSyntheticParsedCommand",
    "processMessageWithIntent",
    "enrichQueryWithGroq",
    "processCompoundMessage",
    "enrichActionResponseWithGroq"
  ],
  "importCount": 3,
  "lineCount": 276,
  "intentCount": 0,
  "isTool": false,
  "isHandler": false,
  "isDispatcher": true,
  "isAutomation": false
}
```

## Relacionado

- [[architecture/agents|agent-module]] — Arquitectura de agent-modules

## Dependencias

- `@/lib/db`
- `./agent`
- `@/lib/logger`
