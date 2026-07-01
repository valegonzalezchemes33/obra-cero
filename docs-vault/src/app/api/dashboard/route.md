---
tags: [route]
aliases: [/api/dashboard]
---

# /api/dashboard

API GET /api/dashboard

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/dashboard/route.ts`
- **ID:** `route:/api/dashboard`

## Metadatos

```json
{
  "methods": [
    "GET"
  ],
  "schemas": [],
  "hasAuth": false,
  "imports": [
    "next/server",
    "@/lib/db",
    "@/lib/cache",
    "@/lib/logger"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[Dashboard]]

## Dependencias

- `@/lib/db`
- `@/lib/cache`
- `@/lib/logger`
