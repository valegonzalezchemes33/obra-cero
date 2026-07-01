---
tags: [route]
aliases: [/api/suppliers]
---

# /api/suppliers

API GET/POST /api/suppliers

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/suppliers/route.ts`
- **ID:** `route:/api/suppliers`

## Metadatos

```json
{
  "methods": [
    "GET",
    "POST"
  ],
  "schemas": [
    "SupplierCreateSchema"
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
