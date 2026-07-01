# Backend Architecture

## API Routes (36 total)

Each route follows the Next.js App Router pattern with `route.ts` files.

| Route | Methods |
|-------|---------|
| `src/app/api/agent` |  |
|   actions | ? |
|   analyze-file | ? |
|   conversation | ? |
|   message | ? |
|   agent | ? |
|   stream | ? |
|   execute | ? |
|   tools | ? |
|   upload | ? |
|   vision | ? |
| `src/app/api/auth` |  |
|   [...nextauth] | ? |
| `src/app/api/automations` |  |
|   automations | ? |
|   run | ? |
| `src/app/api/dashboard` |  |
|   insights | ? |
|   dashboard | ? |
| `src/app/api/events` |  |
|   events | ? |
| `src/app/api/health` |  |
|   health | ? |
| `src/app/api/materials` |  |
|   movements | ? |
|   :id | ? |
|   materials | ? |
| `src/app/api/projects` |  |
|   :id | ? |
|   projects | ? |
| `src/app/api/route.ts` |  |
|   api | ? |
| `src/app/api/scheduler` |  |
|   scheduler | ? |
|   run | ? |
| `src/app/api/seed` |  |
|   seed | ? |
| `src/app/api/suppliers` |  |
|   :id | ? |
|   suppliers | ? |
| `src/app/api/tasks` |  |
|   :id | ? |
|   tasks | ? |
| `src/app/api/transactions` |  |
|   :id | ? |
|   transactions | ? |
| `src/app/api/workflows` |  |
|   execute | ? |
|   executions | ? |
|   workflows | ? |
|   webhook | ? |

## Auth
All routes require authentication by default (via middleware).
Exceptions are marked as (public).

## Patterns
- All CRUD routes use `src/lib/crud-factory.ts` helpers
- Custom logic routes live alongside their CRUD counterparts
- Route handlers receive `PrismaClient` via singleton
