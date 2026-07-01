---
tags: [module]
aliases: [api-utils]
---

# api-utils

Library module: api-utils

## Información

- **Tipo:** `module`
- **Ruta:** `src/lib/api-utils.ts`
- **ID:** `module:api-utils`

## Metadatos

```json
{
  "exports": [
    "withErrorHandler",
    "getSession",
    "requireSession",
    "authRequiredResponse",
    "rateLimitResponse",
    "requireAgentApiKey",
    "agentApiKeyRequiredResponse"
  ],
  "importCount": 8,
  "lineCount": 119
}
```

## Relacionado

- [[architecture/backend|module]] — Arquitectura de modules

## Dependencias

- `@/lib/auth`
- `@/lib/api-audit`
- `@/lib/logger`
- `@/lib/rate-limit`
