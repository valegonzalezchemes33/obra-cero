import { NextRequest, NextResponse } from "next/server";
import {
  executeToolCall,
  executeToolFromIntent,
  listExecutableTools,
} from "@/lib/tool-execution";
import type { ToolName, ToolCall } from "@/lib/tool-registry";

// POST /api/agent/tools/execute — Ejecuta una tool registrada.
//
// Pensado para clientes externos (MCP bridge, workflows, la UI admin).
// El endpoint recibe { tool, args } o { intent, entities } y devuelve la
// respuesta uniforme con riskLevel / requiresConfirmation.
//
// EJEMPLO:
//   POST /api/agent/tools/execute
//   { "tool": "create_expense", "args": { "amount": 50000, "category": "materiales" } }
//
//   POST /api/agent/tools/execute
//   { "intent": "action_create_expense", "entities": { ... } }
//
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Dos modos: tool explícito o intent Groq resuelto
    if (body?.tool) {
      const call: ToolCall = {
        tool: body.tool as ToolName,
        args: body.args || {},
        rawText: body.rawText,
      };

      const result = await executeToolCall(call, {
        rawText: body.rawText,
        conversationContext: body.conversationContext,
      });

      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    if (body?.intent) {
      const result = await executeToolFromIntent(
        body.intent,
        body.entities || {},
        body.rawText || ""
      );
      if (!result) {
        return NextResponse.json(
          {
            ok: false,
            error: `Intent "${body.intent}" no es una tool registrada.`,
            available: listExecutableTools().map((t) => t.name),
          },
          { status: 404 }
        );
      }
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Campo 'tool' o 'intent' requerido",
        example: {
          mode: "tool",
          body: {
            tool: "create_expense",
            args: { amount: 50000, category: "materiales" },
          },
        },
      },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Error interno" },
      { status: 500 }
    );
  }
}
