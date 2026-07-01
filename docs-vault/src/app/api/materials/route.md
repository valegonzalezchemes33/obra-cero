---
tags: [route]
aliases: [/api/materials]
---

# /api/materials

API GET/POST /api/materials

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/materials/route.ts`
- **ID:** `route:/api/materials`

## Metadatos

```json
{
  "methods": [
    "GET",
    "POST"
  ],
  "schemas": [
    "MaterialCreateSchema"
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
