---
tags: [agent-module]
aliases: [agent/handlers]
---

# agent/handlers

Agent module: agent/handlers

## Información

- **Tipo:** `agent-module`
- **Ruta:** `src/lib/agent/handlers.ts`
- **ID:** `agent:agent/handlers`

## Metadatos

```json
{
  "exports": [
    "respondGreeting",
    "respondQueryProfit",
    "respondQueryExpenses",
    "respondQueryIncome",
    "respondQueryCashflow",
    "respondQueryKpis",
    "respondQueryTopExpense",
    "respondQueryMarginByProject",
    "respondQueryComparePeriod",
    "respondQueryAnomalies",
    "respondQueryLowStock",
    "respondQueryStock",
    "respondQueryStockValue",
    "respondQueryDeadStock",
    "respondQueryMaterialHistory",
    "respondQueryProjectStatus",
    "respondQueryProjectDetail",
    "respondQueryProjectProfitability",
    "respondPredictBudget",
    "respondPredictProjectEta",
    "respondQuerySupplier",
    "respondQueryTopSupplier",
    "respondQueryBestSupplier",
    "respondQueryTasks",
    "respondQueryOverdueTasks",
    "respondAlertCheck",
    "respondRecommend",
    "respondSummarize",
    "respondActionCreateExpense",
    "respondActionCreateIncome",
    "respondActionCreateProject",
    "respondActionCreateTask",
    "respondActionReorder",
    "respondActionUpdateStock",
    "respondActionAddMaterials",
    "respondActionAddStockMovement",
    "respondActionUpdateProjectProgress",
    "respondActionUpdateProjectStatus",
    "respondActionCreateProjectDirect",
    "respondActionCreateSupplier",
    "respondActionListProjectTasks",
    "respondActionCompleteTask",
    "respondActionCloseProject",
    "respondConfigListAutomations",
    "respondHelp"
  ],
  "importCount": 9,
  "lineCount": 1600,
  "intentCount": 0,
  "isTool": false,
  "isHandler": true,
  "isDispatcher": false,
  "isAutomation": false
}
```

## Relacionado

- [[architecture/agents|agent-module]] — Arquitectura de agent-modules
- [[src/lib/agent/dispatcher]]
- [[src/lib/agent/normalize]]
- [[src/lib/agent/queries]]
- [[src/lib/agent/project-resolver]]
- [[src/lib/agent]]
- [[src/lib/agent/item-parser]]
- [[src/lib/agent/item-parser]]
- [[src/lib/agent/sku]]

## Dependencias

- `@/lib/db`
- `@/lib/format`
- `@/lib/agent/normalize`
- `@/lib/agent/queries`
- `@/lib/agent/project-resolver`
- `@/lib/agent`
- `@/lib/agent/item-parser`
- `@/lib/agent/item-parser`
- `@/lib/agent/sku`
