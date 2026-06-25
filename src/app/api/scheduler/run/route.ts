import { NextResponse } from "next/server";
import { runScheduler } from "@/lib/workflow-engine";

// POST /api/scheduler/run - Ejecutar el scheduler (llamado por cron externo o manualmente)
export async function POST() {
  try {
    const results = await runScheduler();
    return NextResponse.json({ triggered: results.length, results });
  } catch (error: any) {
    console.error("[API] POST /api/scheduler/run:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
