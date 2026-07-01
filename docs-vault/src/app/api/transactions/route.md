---
tags: [route]
aliases: [/api/transactions]
---

# /api/transactions

API GET/POST /api/transactions

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/transactions/route.ts`
- **ID:** `route:/api/transactions`

## Metadatos

```json
{
  "methods": [
    "GET",
    "POST"
  ],
  "schemas": [
    "TransactionCreateSchema"
  ],
  "hasAuth": false,
  "imports": [
    "next/server",
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
