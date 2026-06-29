import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";
import { parseBody, AutomationCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const rules = await db.automationRule.findMany({ orderBy: { createdAt: "asc" } });
    return NextResponse.json(rules);
  } catch (error: any) {
    console.error("[API] GET /api/automations:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
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
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] POST /api/automations:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
