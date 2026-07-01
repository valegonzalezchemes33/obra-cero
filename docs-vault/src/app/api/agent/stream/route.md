---
tags: [route]
aliases: [/api/agent/stream]
---

# /api/agent/stream

API POST /api/agent/stream

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/agent/stream/route.ts`
- **ID:** `route:/api/agent/stream`

## Metadatos

```json
{
  "methods": [
    "POST"
  ],
  "schemas": [],
  "hasAuth": false,
  "imports": [
    "next/server",
    "@/lib/groq-integration",
    "@/lib/llm-provider",
    "@/lib/agent-memory",
    "@/lib/api-utils"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[Agent]]

## Dependencias

- `@/lib/groq-integration`
- `@/lib/llm-provider`
- `@/lib/agent-memory`
- `@/lib/api-utils`
