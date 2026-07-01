# Cómo Extender el Agente — Guía Paso a Paso

Esta guía explica cómo agregar una nueva **tool** al agente de ObraCero.

Relacionado: [[architecture/agents]], [[agent-architecture]], [[agents/tools]]

## Tipos de extensiones posibles

| Tipo | Dificultad | Ejemplo |
|---|---|---|
| **Nueva capability** | Alta | Agregar gestión de calendar |
| **Nueva tool CRUD** | Media | Crear recurso nuevo (ej: contactos) |
| **Extender capability existente** | Baja | Nuevo tipo de documento |
| **Nuevo intent NLU** | Baja | Detectar nuevo patrón de mensaje |

---

## Pasos para agregar una nueva Tool

### Paso 1: Definir el Intent en `src/lib/agent.ts`

Agregar el intent al tipo `Intent` si no existe aún:

```typescript
// src/lib/agent.ts  — línea ~87
export type Intent =
  | "action_create_expense"
  // ... existentes ...
  | "capability_generate_document"  // ya existe
  // AGREGAR NUEVO:
  | "capability_mi_nueva_capacidad"     // ← nuevo intent
  | "unknown";
```

---

### Paso 2: Agregar el tool name en `src/lib/tool-registry.ts`

**2a.** Agregar al tipo `ToolName`:

```typescript
// src/lib/tool-registry.ts — línea ~19 (ToolName type)
export type ToolName =
  | "create_project"
  // ... existentes ...
  // AGREGAR NUEVO:
  | "mi_nueva_tool";
```

**2b.** Agregar el schema Zod (después de `exportDataSchema`):

```typescript
// src/lib/tool-registry.ts
const miNuevaToolSchema = z.object({
  param1: z.string().min(1).describe("Descripción del parámetro"),
  param2: z.number().optional().describe("Parámetro opcional"),
});
```

**2c.** Agregar al `toolSchemas`:

```typescript
export const toolSchemas: Record<ToolName, z.ZodTypeAny> = {
  // ... existentes ...
  mi_nueva_tool: miNuevaToolSchema,   // ← agregar
};
```

**2d.** Agregar al `toolToIntent`:

```typescript
export const toolToIntent: Record<ToolName, Intent> = {
  // ... existentes ...
  mi_nueva_tool: "capability_mi_nueva_capacidad",   // ← agregar
};
```

**2e.** Agregar al array `moderateTools` o `destructiveTools` según el riesgo:

```typescript
const moderateTools: ToolName[] = [
  // ... existentes ...
  "mi_nueva_tool",   // ← si es moderada (riesgo medio)
];
```

---

### Paso 3: Crear la función de ejecución en `src/lib/agent/capabilities/`

Crear un archivo nuevo en `src/lib/agent/capabilities/`:

```typescript
// src/lib/agent/capabilities/mi-capability.ts

import { z } from "zod";
import { db } from "@/lib/db";
import type { AgentResponse } from "../agent";

// Schema de los argumentos
const MiNuevaToolSchema = z.object({
  param1: z.string().min(1),
  param2: z.number().optional(),
});

// Función principal — retorna AgentResponse
export async function miNuevaTool(
  args: z.infer<typeof MiNuevaToolSchema>
): Promise<AgentResponse> {
  try {
    // Lógica de negocio — acceder DB SOLO a través de db (Prisma)
    // NUNCA acceder la DB directamente con SQL crudo

    const result = await db.miEntidad.create({
      data: {
        campo: args.param1,
      },
    });

    return {
      text: `✅ Acción completada: ${result.campo}`,
      intent: "capability_mi_nueva_capacidad",
      data: { id: result.id, campo: result.campo },
      suggestions: ["¿Qué más?", "Ver estado"],
    };
  } catch (err: any) {
    return {
      text: `❌ Error: ${err.message}`,
      intent: "capability_mi_nueva_capacidad",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

export const miToolSchemas = {
  mi_nueva_tool: MiNuevaToolSchema,
} as const;
```

---

### Paso 4: Registrar en `src/lib/tools/registry-definitions.ts`

**4a.** Importar la función:

```typescript
// src/lib/tools/registry-definitions.ts — imports
import { miNuevaTool } from "@/lib/agent/capabilities/mi-capability";
```

**4b.** Agregar al objeto `tools`:

```typescript
const tools: Record<ToolName, ExecutableTool> = {
  // ... herramientas existentes ...

  // ─── Mi nueva tool ───
  mi_nueva_tool: {
    name: "mi_nueva_tool",
    intent: "capability_mi_nueva_capacidad",
    description: "Descripción clara de qué hace la tool para el usuario",
    riskLevel: "moderate",         // safe | moderate | destructive
    inputSchema: null,
    execute: async (args) => miNuevaTool(args),
  },
};
```

---

### Paso 5: Agregar categoría al Context Manager (opcional)

Si querés que el Context Manager sepa la categoría de la tool para mostrarla en el catálogo:

```typescript
// src/lib/agent/context.ts — TOOL_CATEGORY_MAP
const TOOL_CATEGORY_MAP: Record<string, string> = {
  // ... existentes ...
  mi_nueva_tool: "mi_categoria",   // ← agregar
};
```

---

### Paso 6: Verificar

1. Ejecutar `pnpm build` para verificar tipos TypeScript
2. Hacer un query a `GET /api/agent/tools` para confirmar que aparece
3. Probar con el chat: "ejecuta mi_nueva_tool con param1=test"

---

## Agregar un intent NLU nuevo (patrón de lenguaje)

Si necesitás que el agente detecte un nuevo tipo de mensaje sin agregar una tool:

### Paso 1: Agregar el intent

```typescript
// src/lib/agent.ts
export type Intent =
  // ... existentes ...
  | "mi_nuevo_intent";
```

### Paso 2: Agregar el handler en `dispatchByIntent`

```typescript
// src/lib/agent.ts — buscar la función dispatchByIntent (~línea 2464)
// Agregar un case:

case "mi_nuevo_intent":
  return respondToMiNuevoIntent(parsed, rawText);
```

### Paso 3: Implementar el handler

```typescript
// En la misma sección de handlers de agent.ts (~línea 2500+)
async function respondToMiNuevoIntent(
  parsed: ParsedCommand,
  rawText: string
): Promise<AgentResponse> {
  // Logica del handler
  return {
    text: "Respuesta al nuevo intent",
    intent: "mi_nuevo_intent",
  };
}
```

### Paso 4: Agregar normalización en `agent-nlu.ts` (opcional)

```typescript
// src/lib/agent-nlu.ts — NORMALIZATION_RULES array (~línea 31)
{
  pattern: /^(?:palabra clave)\b/i,
  replacement: "texto que el NLU espera",
  priority: 80,
  description: "nueva normalización",
},
```

---

## Agregar capacidad al Groq (prompt enrichment)

Para mejorar las respuestas de Groq para una tool específica:

```typescript
// src/lib/groq.ts — agregar al systemPrompt en parseIntentWithGroq():
// O agregar en groq-integration.ts → tryGroqEnhancedResponse()
```

El sistema actual detecta intents y extrae entidades. Para modificar cómo Groq interpreta un mensaje específico, editar `groq.ts` → `parseIntentWithGroq()`.

---

## Testing

```bash
# Verificar que las tools se registran
curl http://localhost:3000/api/agent/tools

# Probar una tool específica
curl -X POST http://localhost:3000/api/agent/tools/execute \
  -H "Content-Type: application/json" \
  -d '{"name":"mi_nueva_tool","args":{"param1":"test"}}'

# Probar el endpoint unificado
curl -X POST http://localhost:3000/api/agent/message \
  -H "Content-Type: application/json" \
  -d '{"message":"ejecuta mi_nueva_tool con param1=test"}'
```

---

## Buenas Prácticas

1. **Nunca acceder la DB directamente** — usar siempre `db` (Prisma singleton)
2. **Siempre retornar `AgentResponse`** — no strings ni objetos crudos
3. **No hacer queries SQL directas** — usar Prisma para mantener seguridad de tipos
4. **Mantener las tools idempotentes** cuando sea posible
5. **Agregar `.catch(() => {})`** si hacés chamadas de auditoría en funciones de tool
6. **Los args ya vienen validados por Zod** gracias al `tool-registry.ts` — no volver a validar
7. **Usar tipos de Prisma** en las queries, no `any`

---

## Estructura de archivos resultante

```
src/lib/
├── agent/
│   ├── capabilities/
│   │   ├── calendar.ts          ← agregar aquí
│   │   ├── documents.ts
│   │   ├── memory-tools.ts
│   │   ├── notifications.ts
│   │   └── search-tools.ts
│   ├── types.ts                 ← re-export
│   ├── router.ts
│   ├── context.ts
│   └── audit.ts
├── tool-registry.ts             ← agregar nombre + schema + intent mapping
└── tools/
    └── registry-definitions.ts  ← agregar execute function
```