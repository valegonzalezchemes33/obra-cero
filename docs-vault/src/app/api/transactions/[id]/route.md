---
tags: [route]
aliases: [/api/transactions/:id]
---

# /api/transactions/:id

API GET/PATCH/DELETE /api/transactions/:id

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/transactions/[id]/route.ts`
- **ID:** `route:/api/transactions/:id`

## Metadatos

```json
{
  "methods": [
    "GET",
    "PATCH",
    "DELETE"
  ],
  "schemas": [
    "TransactionUpdateSchema"
  ],
  "hasAuth": false,
  "imports": [
    "@/lib/db",
    "@/lib/validation",
    "@/lib/crud-factory"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[prisma/schema.prisma]]

## Dependencias

- `@/lib/db`
- `@/lib/crud-factory`
