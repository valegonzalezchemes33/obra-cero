---
tags: [route]
aliases: [/api/agent/tools]
---

# /api/agent/tools

API GET /api/agent/tools

## Información

- **Tipo:** `route`
- **Ruta:** `src/app/api/agent/tools/route.ts`
- **ID:** `route:/api/agent/tools`

## Metadatos

```json
{
  "methods": [
    "GET"
  ],
  "schemas": [
    "toolSchema",
    "inputSchema"
  ],
  "hasAuth": false,
  "imports": [
    "next/server",
    "@/lib/tool-registry",
    "@/lib/tool-execution"
  ]
}
```

## Relacionado

- [[architecture/backend|route]] — Arquitectura de routes
- [[Agent]]

## Dependencias

- `@/lib/tool-registry`
- `@/lib/tool-execution`
