---
tags: [route]
aliases: [/api/projects]
---

# /api/projects

API GET/POST /api/projects

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/projects/route.ts`
- **ID:** `route:/api/projects`

## Metadatos

```json
{
  "methods": [
    "GET",
    "POST"
  ],
  "schemas": [
    "ProjectCreateSchema"
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
