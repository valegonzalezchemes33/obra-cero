---
tags: [route]
aliases: [/api/materials/:id/movements]
---

# /api/materials/:id/movements

API POST /api/materials/:id/movements

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/materials/[id]/movements/route.ts`
- **ID:** `route:/api/materials/:id/movements`

## Metadatos

```json
{
  "methods": [
    "POST"
  ],
  "schemas": [
    "StockMovementCreateSchema"
  ],
  "hasAuth": true,
  "imports": [
    "next/server",
    "@/lib/db",
    "@/lib/api-utils",
    "@/lib/validation",
    "@/lib/logger"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[prisma/schema.prisma]]

## Dependencias

- `@/lib/db`
- `@/lib/api-utils`
- `@/lib/logger`
