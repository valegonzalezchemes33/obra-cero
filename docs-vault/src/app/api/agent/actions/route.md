---
tags: [route]
aliases: [/api/agent/actions]
---

# /api/agent/actions

API GET/PATCH /api/agent/actions

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/agent/actions/route.ts`
- **ID:** `route:/api/agent/actions`

## Metadatos

```json
{
  "methods": [
    "GET",
    "PATCH"
  ],
  "schemas": [],
  "hasAuth": true,
  "imports": [
    "next/server",
    "@/lib/db",
    "@/lib/api-utils",
    "@/lib/logger",
    "@/lib/validation",
    "zod"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[Agent]]

## Dependencias

- `@/lib/db`
- `@/lib/api-utils`
- `@/lib/logger`
