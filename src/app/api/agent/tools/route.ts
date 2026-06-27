import { NextResponse } from "next/server";
import {
  toolSchemas,
  toolToIntent,
  intentToTool,
  getRiskLevel,
  type ToolName,
} from "@/lib/tool-registry";
import { listAllRegisteredTools, listExecutableTools } from "@/lib/tool-execution";

// GET /api/agent/tools — Catálogo público de herramientas del agente
export async function GET() {
  // Lista con info de implementación y descripción detallada
  const definiciones = listExecutableTools();

  const tools = Object.keys(toolSchemas).map((name) => {
    const schema = toolSchemas[name];
    const def = definiciones.find((d) => d.name === name);
    return {
      name,
      intent: toolToIntent[name as ToolName],
      riskLevel: getRiskLevel(name as ToolName),
      description: def?.description || null,
      implemented: Boolean(def),
      inputSchema: schemaForDocs(schema),
    };
  });

  return NextResponse.json({
    count: tools.length,
    implemented: definiciones.length,
    tools,
    intentToTool,
    executables: definiciones,
  });
}

// Extrae una descripción liviana del schema Zod sin serializar el schema completo.
// Devuelve la lista de campos top-level y su tipo.
function schemaForDocs(schema: any): Record<string, string> {
  if (!schema || !schema._def || schema._def.typeName !== "ZodObject") {
    return {};
  }
  const shape = schema._def.shape();
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(shape || {})) {
    out[key] = describeType(value);
  }
  return out;
}

function describeType(zodNode: any): string {
  if (!zodNode || !zodNode._def) return "unknown";
  const typeName: string = zodNode._def.typeName || "";
  switch (typeName) {
    case "ZodString":
      return "string";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodEnum":
      return `enum(${zodNode._def.values.join("|")})`;
    case "ZodArray":
      return `array<${describeType(zodNode._def.type)}>`;
    case "ZodOptional":
      return `${describeType(zodNode._def.innerType)}?`;
    case "ZodUnion":
      return `union(${zodNode._def.options.map((o: any) => describeType(o)).join("|")})`;
    case "ZodRecord":
      return "record";
    case "ZodObject":
      return "object";
    default:
      return typeName.replace(/^Zod/, "").toLowerCase();
  }
}
