import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
    const body = await req.json();
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
    console.error("[API] POST /api/automations:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
