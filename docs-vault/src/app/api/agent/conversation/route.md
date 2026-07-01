---
tags: [route]
aliases: [/api/agent/conversation]
---

# /api/agent/conversation

API GET/DELETE /api/agent/conversation

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/agent/conversation/route.ts`
- **ID:** `route:/api/agent/conversation`

## Metadatos

```json
{
  "methods": [
    "GET",
    "DELETE"
  ],
  "schemas": [],
  "hasAuth": true,
  "imports": [
    "next/server",
    "@/lib/db",
    "@/lib/api-utils"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[Agent]]

## Dependencias

- `@/lib/db`
- `@/lib/api-utils`
