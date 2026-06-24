import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const rules = await db.automationRule.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
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
}
