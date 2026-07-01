---
tags: [agent-module]
aliases: [agent-extended]
---

# agent-extended

Agent module: agent-extended

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/agent-extended.ts`
- **ID:** `agent:agent-extended`

## Metadatos

```json
{
  "exports": [
    "findClosestIntent",
    "parseMultiIntent",
    "generateSmartUnknownResponse",
    "handleEditProject",
    "handleEditTask",
    "handleEditMaterial",
    "handleDeleteTask",
    "handleDeleteMaterial",
    "handleDeleteTransaction",
    "handleTriggerWorkflow",
    "handleSupplierCompare",
    "handlePurchasePlan",
    "handleExpenseTrend",
    "handleExportData",
    "handleListWorkflows",
    "generateMultiIntentResponse",
    "processExtendedMessage"
  ],
  "importCount": 8,
  "lineCount": 1305,
  "intentCount": 0,
  "isTool": false,
  "isHandler": false,
  "isDispatcher": false,
  "isAutomation": false
}
```

## Relacionado

- [[architecture/agents|agent-module]] — Arquitectura de agent-modules

## Dependencias

- `@/lib/db`
- `./agent`
- `@/lib/logger`
- `./workflow-engine`
- `./workflow-from-text`
- `./agent-rag`
- `./agent-predictive`
- `./agent-memory`
