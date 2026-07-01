---
tags: [route]
aliases: [/api/projects/:id]
---

# /api/projects/:id

API GET/PATCH/DELETE /api/projects/:id

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/projects/[id]/route.ts`
- **ID:** `route:/api/projects/:id`

## Metadatos

```json
{
  "methods": [
    "GET",
    "PATCH",
    "DELETE"
  ],
  "schemas": [
    "ProjectUpdateSchema"
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
