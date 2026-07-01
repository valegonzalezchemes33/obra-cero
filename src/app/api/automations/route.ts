import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError, RateLimitError, rateLimitResponse } from "@/lib/api-utils";
import { parseBody, AutomationCreateSchema } from "@/lib/validation";
import { apiLogger } from "@/lib/logger";
import { getCached } from "@/lib/cache";

export async function GET() {
  try {
    const rules = await getCached("automations:list", () =>
      db.automationRule.findMany({ orderBy: { createdAt: "asc" }, take: 200 }), 15000);
    return NextResponse.json(rules);
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/automations" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseBody(req, AutomationCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const rule = await db.automationRule.create({
      data: {
        name: body.name,
        description: body.description,
        trigger: body.trigger,
        condition: body.condition || null,
        action: body.action || "alert",
        enabled: body.enabled ?? true,
      },
    });
    return NextResponse.json(rule, { status: 201 });
  } catch (error: any) {
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    apiLogger.error({ module: "API", path: "/api/automations" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
