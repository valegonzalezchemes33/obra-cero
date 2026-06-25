import { NextRequest, NextResponse } from "next/server";
import { runAutomations } from "@/lib/agent";

// POST /api/automations/run - ejecutar todas las reglas activas
export async function POST() {
  try {
    const triggered = await runAutomations();
    return NextResponse.json({ triggered, count: triggered.length });
  } catch (error: any) {
    console.error("[API] POST /api/automations/run:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
