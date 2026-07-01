---
tags: [route]
aliases: [/api/suppliers/:id]
---

# /api/suppliers/:id

API GET/PATCH/DELETE /api/suppliers/:id

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/suppliers/[id]/route.ts`
- **ID:** `route:/api/suppliers/:id`

## Metadatos

```json
{
  "methods": [
    "GET",
    "PATCH",
    "DELETE"
  ],
  "schemas": [
    "SupplierUpdateSchema"
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
