---
tags: [agent-module]
aliases: [agent/context]
---

# agent/context

Agent module: agent/context

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/agent/context.ts`
- **ID:** `agent:agent/context`

## Metadatos

```json
{
  "exports": [
    "getPreference",
    "setPreference",
    "deletePreference",
    "listPreferences",
    "setScratchpad",
    "getScratchpad",
    "clearScratchpad",
    "buildContext",
    "recordTurn",
    "invalidarSesion",
    "noteResourceLoaded",
    "clearContextCache"
  ],
  "importCount": 7,
  "lineCount": 529,
  "intentCount": 0,
  "isTool": false,
  "isHandler": false,
  "isDispatcher": false,
  "isAutomation": false
}
```

## Relacionado

- [[architecture/agents|agent-module]] — Arquitectura de agent-modules

## Dependencias

- `../db`
- `../cache`
- `../agent-memory`
- `../tool-execution`
- `../tool-registry`
- `../groq-integration`
- `./types`
