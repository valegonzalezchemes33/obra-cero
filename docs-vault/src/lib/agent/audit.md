---
tags: [agent-module]
aliases: [agent/audit]
---

# agent/audit

Agent module: agent/audit

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/agent/audit.ts`
- **ID:** `agent:agent/audit`

## Metadatos

```json
{
  "exports": [
    "checkRateLimit",
    "sanitizeForGroq",
    "auditLog",
    "auditToolExecution"
  ],
  "importCount": 5,
  "lineCount": 222,
  "intentCount": 0,
  "isTool": false,
  "isHandler": false,
  "isDispatcher": false,
  "isAutomation": false
}
```

## Relacionado

- [[architecture/agents|agent-module]] — Arquitectura de agent-modules
- [[src/lib/tool-registry]]
- [[src/lib/agent/types]]
- [[src/lib/tools/registry-definitions]]
- [[src/lib/tool-execution]]

## Dependencias

- `@/lib/db`
- `@/lib/tool-registry`
- `@/lib/agent/types`
- `@/lib/rate-limit`
- `@/lib/tools/registry-definitions`
