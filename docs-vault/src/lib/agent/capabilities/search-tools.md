---
tags: [agent-module]
aliases: [agent/capabilities/search-tools]
---

# agent/capabilities/search-tools

Agent module: agent/capabilities/search-tools

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/agent/capabilities/search-tools.ts`
- **ID:** `agent:agent/capabilities/search-tools`

## Metadatos

```json
{
  "exports": [
    "searchProjects",
    "searchClients",
    "searchBudgets",
    "listBudgetRanges",
    "searchToolSchemas"
  ],
  "importCount": 3,
  "lineCount": 228,
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
