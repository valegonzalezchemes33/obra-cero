---
tags: [route]
aliases: [/api/tasks/:id]
---

# /api/tasks/:id

API GET/PATCH/DELETE /api/tasks/:id

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/tasks/[id]/route.ts`
- **ID:** `route:/api/tasks/:id`

## Metadatos

```json
{
  "methods": [
    "GET",
    "PATCH",
    "DELETE"
  ],
  "schemas": [
    "TaskUpdateSchema"
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
