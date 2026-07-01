---
tags: [route]
aliases: [/api/agent/tools/execute]
---

# /api/agent/tools/execute

API POST /api/agent/tools/execute

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/agent/tools/execute/route.ts`
- **ID:** `route:/api/agent/tools/execute`

## Metadatos

```json
{
  "methods": [
    "POST"
  ],
  "schemas": [],
  "hasAuth": false,
  "imports": [
    "next/server",
    "@/lib/tool-execution",
    "@/lib/tool-registry",
    "@/lib/api-utils"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[Agent]]

## Dependencias

- `@/lib/tool-execution`
- `@/lib/tool-registry`
- `@/lib/api-utils`
