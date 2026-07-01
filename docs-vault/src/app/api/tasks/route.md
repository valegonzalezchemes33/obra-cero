---
tags: [route]
aliases: [/api/tasks]
---

# /api/tasks

API GET/POST /api/tasks

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/tasks/route.ts`
- **ID:** `route:/api/tasks`

## Metadatos

```json
{
  "methods": [
    "GET",
    "POST"
  ],
  "schemas": [
    "TaskCreateSchema"
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
