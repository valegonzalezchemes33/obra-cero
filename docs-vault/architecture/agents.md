# Agent Architecture

## Internal Agent
- **Engine:** Groq LLM
- **Total modules:** 26
- **Capabilities:** Intent detection, tool dispatch, context management

### Module Categories
- **agent-dispatcher** — Agent module: agent-dispatcher
- **agent-extended** — Agent module: agent-extended
- **agent-intents** — Agent module: agent-intents
- **agent-memory** — Agent module: agent-memory
- **agent** — Agent module: agent
- **agent/audit.test** — Agent module: agent/audit.test
- **agent/audit** — Agent module: agent/audit
- **agent/automation-engine** — Agent module: agent/automation-engine
- **agent/capabilities/calendar** — Agent module: agent/capabilities/calendar
- **agent/capabilities/documents** — Agent module: agent/capabilities/documents
- **agent/capabilities/memory-tools** — Agent module: agent/capabilities/memory-tools
- **agent/capabilities/notifications** — Agent module: agent/capabilities/notifications
- **agent/capabilities/search-tools** — Agent module: agent/capabilities/search-tools
- **agent/context** — Agent module: agent/context
- **agent/dispatcher** — Agent module: agent/dispatcher
- **agent/handlers** — Agent module: agent/handlers
- **agent/item-parser** — Agent module: agent/item-parser
- **agent/normalize** — Agent module: agent/normalize
- **agent/project-resolver** — Agent module: agent/project-resolver
- **agent/queries** — Agent module: agent/queries
- **agent/router** — Agent module: agent/router
- **agent/sku** — Agent module: agent/sku
- **agent/types** — Agent module: agent/types
- **tool-execution** — Agent module: tool-execution
- **tool-registry** — Agent module: tool-registry
- **tools/registry-definitions** — Agent module: tools/registry-definitions

## MCP Bridge
- **Total integrations:** 3
- mcp-bridge/package.json: MCP integration: mcp-bridge/package.json
- mcp-bridge/src/index.ts: MCP integration: mcp-bridge/src/index.ts
- mcp-bridge/tsconfig.json: MCP integration: mcp-bridge/tsconfig.json

## Automations
- **Total workflows:** 14
- src/app/api/automations/route: Automation module: src/app/api/automations/route
- src/app/api/automations/run/route: Automation module: src/app/api/automations/run/route
- src/app/api/scheduler/route: Automation module: src/app/api/scheduler/route
- src/app/api/scheduler/run/route: Automation module: src/app/api/scheduler/run/route
- src/app/api/workflows/execute/route: Automation module: src/app/api/workflows/execute/route
- src/app/api/workflows/executions/route: Automation module: src/app/api/workflows/executions/route
- src/app/api/workflows/route: Automation module: src/app/api/workflows/route
- src/app/api/workflows/webhook/route: Automation module: src/app/api/workflows/webhook/route
- src/components/views/automationsx: Automation module: src/components/views/automationsx
- src/components/workflow-builderx: Automation module: src/components/workflow-builderx
- agent/automation-engine: Automation module: agent/automation-engine
- workflow-engine: Automation module: workflow-engine
- workflow-from-text: Automation module: workflow-from-text
- workflow-types: Automation module: workflow-types

## Flow
```
User Input → Intent Detection → Handler Dispatch → Tool Execution → Response
                                    │
                                    ▼
                           Database (Prisma)
```
