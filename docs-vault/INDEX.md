---
type: index
tags: [index, project, hub]
title: "ObraCero — Índice del Proyecto"
module: core
status: active
---

# ObraCero — Índice del Proyecto

Sistema CRM interno con Agente IA para la construcción.

---

Bienvenido al vault de documentación. Este archivo es el hub central del grafo de conocimiento.

## Arquitectura

| Nota | Descripción |
|------|-------------|
| [[architecture/overview]] | Visión general del stack y patrón de capas |
| [[architecture/backend]] | API Routes (36), autenticación, patrones CRUD |
| [[architecture/frontend]] | Next.js App Router, Tailwind, shadcn/ui |
| [[architecture/database]] | Modelos Prisma (13), relaciones, convenciones |
| [[architecture/agents]] | Sistema de agente IA, módulos, automatizaciones |

## Memoria del Proyecto

| Nota | Descripción |
|------|-------------|
| [[memory/roadmap]] | Features completadas, en progreso y planificadas |
| [[memory/decisions]] | Decisiones de diseño registradas |
| [[memory/patterns]] | Patrones de código (CRUD Factory, Caching, Agent Dispatch) |
| [[memory/lessons]] | Lecciones aprendidas durante el desarrollo |
| [[memory/ideas]] | Ideas para mejoras futuras |
| [[memory/known-bugs]] | Bugs conocidos y su estado |

## Agente IA

| Nota | Descripción |
|------|-------------|
| [[agent-architecture]] | Arquitectura completa del agente conversacional |
| [[agents/extending]] | Guía para extender el agente con nuevas capacidades |
| [[agents/tools]] | Catálogo de herramientas del agente |

## Base de Datos

Modelos definidos en [[prisma/schema.prisma]]:

| Modelo | Uso |
|--------|-----|
| Project | Proyectos de construcción |
| Transaction | Transacciones financieras |
| Task | Tareas operativas |
| Supplier | Proveedores registrados |
| Material | Materiales con control de stock |
| StockMovement | Movimientos de inventario |
| AutomationRule | Reglas de automatización |
| Workflow / WorkflowStep / WorkflowExecution | Flujos de trabajo |
| AgentSchedule / AgentAction / AgentMessage | Sistema de agente IA |

## Vistas Dinámicas (Dataview)

### 📋 Últimas decisiones registradas

```dataview
TABLE date, status, area, author
FROM "memory"
WHERE type = "decision" AND status != "deprecated"
SORT date DESC
LIMIT 5
```

### 📌 Tareas activas del vault

```dataview
TASK
FROM "memory" OR "architecture"
WHERE !completed AND status != "completed"
SORT due ASC
LIMIT 10
```

### 🏷️ Todos los módulos por tipo

```dataview
TABLE type AS "Tipo", module AS "Módulo", status AS "Estado"
FROM "src" OR "scripts" OR "mcp-bridge"
WHERE type
SORT type ASC, module ASC
```

---

## Todos los Módulos

### Prisma

- [[prisma/schema.prisma]] — Prisma model: Project
- [[prisma/schema.prisma]] — Prisma model: Transaction
- [[prisma/schema.prisma]] — Prisma model: Task
- [[prisma/schema.prisma]] — Prisma model: Supplier
- [[prisma/schema.prisma]] — Prisma model: Material
- [[prisma/schema.prisma]] — Prisma model: StockMovement
- [[prisma/schema.prisma]] — Prisma model: AutomationRule
- [[prisma/schema.prisma]] — Prisma model: Workflow
- [[prisma/schema.prisma]] — Prisma model: WorkflowStep
- [[prisma/schema.prisma]] — Prisma model: WorkflowExecution
- [[prisma/schema.prisma]] — Prisma model: AgentSchedule
- [[prisma/schema.prisma]] — Prisma model: AgentAction
- [[prisma/schema.prisma]] — Prisma model: AgentMessage

### Pages

- [[src/app/layout]] — Layout for /
- [[src/app/loading]] — Loading for /
- [[src/app/login/page]] — Page for /login
- [[src/app/page]] — Page for /

### Routes

- [[src/app/api/agent/actions/route]] — API GET/PATCH /api/agent/actions
- [[src/app/api/agent/analyze-file/route]] — API POST /api/agent/analyze-file
- [[src/app/api/agent/conversation/route]] — API GET/DELETE /api/agent/conversation
- [[src/app/api/agent/message/route]] — API POST/GET /api/agent/message
- [[src/app/api/agent/route]] — API POST/GET /api/agent
- [[src/app/api/agent/stream/route]] — API POST /api/agent/stream
- [[src/app/api/agent/tools/execute/route]] — API POST /api/agent/tools/execute
- [[src/app/api/agent/tools/route]] — API GET /api/agent/tools
- [[src/app/api/agent/upload/route]] — API POST/GET /api/agent/upload
- [[src/app/api/agent/vision/route]] — API POST /api/agent/vision
- [[src/app/api/auth/[...nextauth]/route]] — API  /api/auth/[...nextauth]
- [[src/app/api/automations/route]] — API GET/POST /api/automations
- [[src/app/api/automations/run/route]] — API POST /api/automations/run
- [[src/app/api/dashboard/insights/route]] — API GET /api/dashboard/insights
- [[src/app/api/dashboard/route]] — API GET /api/dashboard
- [[src/app/api/events/route]] — API GET /api/events
- [[src/app/api/health/route]] — API GET /api/health
- [[src/app/api/materials/[id]/movements/route]] — API POST /api/materials/:id/movements
- [[src/app/api/materials/[id]/route]] — API GET/PATCH/DELETE /api/materials/:id
- [[src/app/api/materials/route]] — API GET/POST /api/materials
- [[src/app/api/projects/[id]/route]] — API GET/PATCH/DELETE /api/projects/:id
- [[src/app/api/projects/route]] — API GET/POST /api/projects
- [[src/app/api/route]] — API GET /api
- [[src/app/api/scheduler/route]] — API GET/POST/PATCH/DELETE /api/scheduler
- [[src/app/api/scheduler/run/route]] — API POST /api/scheduler/run
- [[src/app/api/seed/route]] — API POST /api/seed
- [[src/app/api/suppliers/[id]/route]] — API GET/PATCH/DELETE /api/suppliers/:id
- [[src/app/api/suppliers/route]] — API GET/POST /api/suppliers
- [[src/app/api/tasks/[id]/route]] — API GET/PATCH/DELETE /api/tasks/:id
- [[src/app/api/tasks/route]] — API GET/POST /api/tasks
- [[src/app/api/transactions/[id]/route]] — API GET/PATCH/DELETE /api/transactions/:id
- [[src/app/api/transactions/route]] — API GET/POST /api/transactions
- [[src/app/api/workflows/execute/route]] — API POST /api/workflows/execute
- [[src/app/api/workflows/executions/route]] — API GET /api/workflows/executions
- [[src/app/api/workflows/route]] — API GET/POST/PATCH/DELETE /api/workflows
- [[src/app/api/workflows/webhook/route]] — API POST /api/workflows/webhook

### Agent

- [[src/lib/agent-dispatcher]] — Agent module: agent-dispatcher
- [[src/lib/agent-extended]] — Agent module: agent-extended
- [[src/lib/agent-intents]] — Agent module: agent-intents
- [[src/lib/agent-memory]] — Agent module: agent-memory
- [[src/lib/agent]] — Agent module: agent
- [[src/lib/agent/audit.test]] — Agent module: agent/audit.test
- [[src/lib/agent/audit]] — Agent module: agent/audit
- [[src/lib/agent/automation-engine]] — Agent module: agent/automation-engine
- [[src/lib/agent/capabilities/calendar]] — Agent module: agent/capabilities/calendar
- [[src/lib/agent/capabilities/documents]] — Agent module: agent/capabilities/documents
- [[src/lib/agent/capabilities/memory-tools]] — Agent module: agent/capabilities/memory-tools
- [[src/lib/agent/capabilities/notifications]] — Agent module: agent/capabilities/notifications
- [[src/lib/agent/capabilities/search-tools]] — Agent module: agent/capabilities/search-tools
- [[src/lib/agent/context]] — Agent module: agent/context
- [[src/lib/agent/dispatcher]] — Agent module: agent/dispatcher
- [[src/lib/agent/handlers]] — Agent module: agent/handlers
- [[src/lib/agent/item-parser]] — Agent module: agent/item-parser
- [[src/lib/agent/normalize]] — Agent module: agent/normalize
- [[src/lib/agent/project-resolver]] — Agent module: agent/project-resolver
- [[src/lib/agent/queries]] — Agent module: agent/queries
- [[src/lib/agent/router]] — Agent module: agent/router
- [[src/lib/agent/sku]] — Agent module: agent/sku
- [[src/lib/agent/types]] — Agent module: agent/types
- [[src/lib/tool-execution]] — Agent module: tool-execution
- [[src/lib/tool-registry]] — Agent module: tool-registry
- [[src/lib/tools/registry-definitions]] — Agent module: tools/registry-definitions

### Modules

- [[src/lib/api-audit]] — Library module: api-audit
- [[src/lib/api-utils]] — Library module: api-utils
- [[src/lib/auth]] — Library module: auth
- [[src/lib/cache]] — Library module: cache
- [[src/lib/crud-factory]] — Library module: crud-factory
- [[src/lib/db]] — Library module: db
- [[src/lib/env]] — Library module: env
- [[src/lib/file-processor]] — Library module: file-processor
- [[src/lib/format]] — Library module: format
- [[src/lib/groq-integration]] — Library module: groq-integration
- [[src/lib/groq]] — Library module: groq
- [[src/lib/llm-provider]] — Library module: llm-provider
- [[src/lib/logger]] — Library module: logger
- [[src/lib/rate-limit]] — Library module: rate-limit
- [[src/lib/tool-execution]] — Library module: tool-execution
- [[src/lib/tool-registry]] — Library module: tool-registry
- [[src/lib/utils]] — Library module: utils
- [[src/lib/validation]] — Library module: validation
- [[src/lib/workflow-engine]] — Library module: workflow-engine
- [[src/lib/workflow-from-text]] — Library module: workflow-from-text
- [[src/lib/workflow-types]] — Library module: workflow-types

### Config

- [[package.json]] — Project package.json
- [[tsconfig.json]] — Configuration file: tsconfig.json
- [[next.config]] — Configuration file: next.config.ts
- [[vercel.json]] — Configuration file: vercel.json
- [[Caddyfile]] — Configuration file: Caddyfile
- [[.env.example]] — Configuration file: .env.example
- [[components.json]] — Configuration file: components.json

### Mcp

- [[mcp-bridge/package.json]] — MCP integration: mcp-bridge/package.json
- [[mcp-bridge/src/index]] — MCP integration: mcp-bridge/src/index.ts
- [[mcp-bridge/tsconfig.json]] — MCP integration: mcp-bridge/tsconfig.json

### Automations

- [[src/app/api/automations/route]] — Automation module: src/app/api/automations/route
- [[src/app/api/automations/run/route]] — Automation module: src/app/api/automations/run/route
- [[src/app/api/scheduler/route]] — Automation module: src/app/api/scheduler/route
- [[src/app/api/scheduler/run/route]] — Automation module: src/app/api/scheduler/run/route
- [[src/app/api/workflows/execute/route]] — Automation module: src/app/api/workflows/execute/route
- [[src/app/api/workflows/executions/route]] — Automation module: src/app/api/workflows/executions/route
- [[src/app/api/workflows/route]] — Automation module: src/app/api/workflows/route
- [[src/app/api/workflows/webhook/route]] — Automation module: src/app/api/workflows/webhook/route
- [[src/components/views/automations]] — Automation module: src/components/views/automationsx
- [[src/components/workflow-builder]] — Automation module: src/components/workflow-builderx
- [[src/lib/agent/automation-engine]] — Automation module: agent/automation-engine
- [[src/lib/workflow-engine]] — Automation module: workflow-engine
- [[src/lib/workflow-from-text]] — Automation module: workflow-from-text
- [[src/lib/workflow-types]] — Automation module: workflow-types

## Relaciones entre módulos

Total: **86** relaciones detectadas.

- **operates_on**: 35
- **imports**: 34
- **belongs_to**: 15
- **rendered_by**: 2

## Estadísticas

- **route**: 36
- **agent-module**: 26
- **module**: 21
- **automation**: 14
- **model**: 13
- **config**: 7
- **mcp**: 3
- **page**: 2
- **layout**: 1
- **loading**: 1
- **Total**: 124
