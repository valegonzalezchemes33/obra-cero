import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError, RateLimitError, rateLimitResponse } from "@/lib/api-utils";
import { apiLogger } from "@/lib/logger";
import { getCached } from "@/lib/cache";
import { parseBody, validateBody, SchedulerCreateSchema, SchedulerPatchSchema } from "@/lib/validation";

export async function GET() {
  try {
    const schedules = await getCached("scheduler:list", () =>
      db.agentSchedule.findMany({
        orderBy: { nextRun: "asc" },
        take: 200,
      }), 15000);
    return NextResponse.json(schedules);
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/scheduler" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseBody(req, SchedulerCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
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
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    apiLogger.error({ module: "API", path: "/api/scheduler" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSession();
    const raw = await req.json();
    const parsed = validateBody(SchedulerPatchSchema, raw);
    if (!parsed.ok) return parsed.response;
    const { id, ...data } = parsed.data;

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
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    apiLogger.error({ module: "API", path: "/api/scheduler" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
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
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    apiLogger.error({ module: "API", path: "/api/scheduler" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
