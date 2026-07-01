---
tags: [agent-module]
aliases: [tools/registry-definitions]
---

# tools/registry-definitions

Agent module: tools/registry-definitions

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/tools/registry-definitions.ts`
- **ID:** `agent:tools/registry-definitions`

## Metadatos

```json
{
  "exports": [
    "getToolDefinition",
    "getAllToolDefinitions",
    "listToolDefinitions"
  ],
  "importCount": 9,
  "lineCount": 802,
  "intentCount": 0,
  "isTool": true,
  "isHandler": false,
  "isDispatcher": false,
  "isAutomation": false
}
```

## Relacionado

- [[architecture/agents|agent-module]] — Arquitectura de agent-modules
- [[src/lib/agent/audit]]
- [[src/lib/agent/capabilities/memory-tools]]
- [[src/lib/agent/capabilities/calendar]]
- [[src/lib/agent/capabilities/notifications]]
- [[src/lib/agent/capabilities/search-tools]]
- [[src/lib/agent/capabilities/documents]]

## Dependencias

- `@/lib/db`
- `../agent`
- `../tool-registry`
- `../agent-extended`
- `@/lib/agent/capabilities/memory-tools`
- `@/lib/agent/capabilities/calendar`
- `@/lib/agent/capabilities/notifications`
- `@/lib/agent/capabilities/search-tools`
- `@/lib/agent/capabilities/documents`
