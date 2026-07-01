# Database Architecture

## Models (13 total)

| Model | Fields | Relations |
|-------|--------|-----------|
| Project | 13 | 0 |
| Transaction | 11 | 0 |
| Task | 9 | 0 |
| Supplier | 11 | 0 |
| Material | 13 | 0 |
| StockMovement | 8 | 0 |
| AutomationRule | 8 | 0 |
| Workflow | 9 | 0 |
| WorkflowStep | 7 | 0 |
| WorkflowExecution | 4 | 0 |
| AgentSchedule | 8 | 0 |
| AgentAction | 7 | 0 |
| AgentMessage | 5 | 0 |

## Key Relationships
```
Project ──hasMany──> Task
Project ──hasMany──> Transaction
Project ──hasMany──> PurchaseOrder
Supplier ──hasMany──> PurchaseOrder
Material ──hasMany──> StockMovement
PurchaseOrder ──belongsTo──> Supplier
PurchaseOrder ──belongsTo──> Project
```

## Conventions
- All models have `id` (UUID), `createdAt`, `updatedAt`
- Soft delete via `deletedAt` where applicable
- Relations use implicit Prisma conventions
