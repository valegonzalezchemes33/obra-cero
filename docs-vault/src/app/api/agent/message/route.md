---
tags: [route]
aliases: [/api/agent/message]
---

# /api/agent/message

API POST/GET /api/agent/message

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/agent/message/route.ts`
- **ID:** `route:/api/agent/message`

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
    "@/lib/agent/router",
    "@/lib/agent/router",
    "@/lib/tool-execution",
    "@/lib/agent/context",
    "@/lib/agent-dispatcher",
    "@/lib/agent",
    "@/lib/agent/types",
    "uuid",
    "@/lib/agent/audit",
    "@/lib/api-utils",
    "@/lib/db"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[Agent]]

## Dependencias

- `@/lib/agent/router`
- `@/lib/agent/router`
- `@/lib/tool-execution`
- `@/lib/agent/context`
- `@/lib/agent-dispatcher`
- `@/lib/agent`
- `@/lib/agent/types`
- `@/lib/agent/audit`
- `@/lib/api-utils`
- `@/lib/db`
