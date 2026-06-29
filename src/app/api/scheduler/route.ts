import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";

export async function GET() {
  try {
    const schedules = await db.agentSchedule.findMany({
      orderBy: { nextRun: "asc" },
    });
    return NextResponse.json(schedules);
  } catch (error: any) {
    console.error("[API] GET /api/scheduler:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const schedule = await db.agentSchedule.create({
      data: {
        name: body.name,
        type: body.type,
        config: JSON.stringify(body.config || {}),
        cron: body.cron,
        enabled: body.enabled ?? true,
        nextRun: body.nextRun ? new Date(body.nextRun) : new Date(),
      },
    });
    return NextResponse.json(schedule, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] POST /api/scheduler:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSession();
    const body = await req.json();
    const { id, ...data } = body;

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.type) updateData.type = data.type;
    if (data.config) updateData.config = JSON.stringify(data.config);
    if (data.cron) updateData.cron = data.cron;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;
    if (data.nextRun) updateData.nextRun = new Date(data.nextRun);

    const schedule = await db.agentSchedule.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(schedule);
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] PATCH /api/scheduler:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    await db.agentSchedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] DELETE /api/scheduler:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
