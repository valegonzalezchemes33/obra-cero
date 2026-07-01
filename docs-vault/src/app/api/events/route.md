---
tags: [route]
aliases: [/api/events]
---

# /api/events

API GET /api/events

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/events/route.ts`
- **ID:** `route:/api/events`

## Metadatos

```json
{
  "methods": [
    "GET"
  ],
  "schemas": [],
  "hasAuth": false,
  "imports": [
    "@/lib/db",
    "@/lib/logger",
    "@/lib/cache"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[Event]]

## Dependencias

- `@/lib/db`
- `@/lib/logger`
- `@/lib/cache`
