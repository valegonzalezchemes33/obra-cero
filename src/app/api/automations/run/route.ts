import { NextRequest, NextResponse } from "next/server";
import { runAutomations } from "@/lib/agent";

// POST /api/automations/run - ejecutar todas las reglas activas
export async function POST() {
  const triggered = await runAutomations();
  return NextResponse.json({ triggered, count: triggered.length });
}
