---
tags: [route]
aliases: [/api/materials/:id]
---

# /api/materials/:id

API GET/PATCH/DELETE /api/materials/:id

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/materials/[id]/route.ts`
- **ID:** `route:/api/materials/:id`

## Metadatos

```json
{
  "methods": [
    "GET",
    "PATCH",
    "DELETE"
  ],
  "schemas": [
    "MaterialUpdateSchema"
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
