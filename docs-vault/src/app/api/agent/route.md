---
tags: [route]
aliases: [/api/agent]
---

# /api/agent

API POST/GET /api/agent

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/agent/route.ts`
- **ID:** `route:/api/agent`

## Metadatos

```json
{
  "methods": [
    "POST",
    "GET"
  ],
  "schemas": [],
  "hasAuth": false,
  "imports": [
    "next/server",
    "@/lib/agent",
    "@/lib/agent",
    "@/lib/agent-extended",
    "@/lib/agent-memory",
    "@/lib/agent-nlu",
    "@/lib/groq-integration",
    "@/lib/agent-action-prompts",
    "@/lib/tool-registry",
    "@/lib/api-utils",
    "@/lib/logger"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[Agent]]

## Dependencias

- `@/lib/agent`
- `@/lib/agent`
- `@/lib/agent-extended`
- `@/lib/agent-memory`
- `@/lib/agent-nlu`
- `@/lib/groq-integration`
- `@/lib/agent-action-prompts`
- `@/lib/tool-registry`
- `@/lib/api-utils`
- `@/lib/logger`
