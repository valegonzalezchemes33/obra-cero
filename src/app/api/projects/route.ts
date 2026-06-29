import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";
import { parseBody, ProjectCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(projects);
  } catch (error: any) {
    console.error("[API] GET /api/projects:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseBody(req, ProjectCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const maxResult = await db.$queryRaw<[{ maxNum: number | null }]>`
      SELECT MAX(CAST(SUBSTRING(code, 4) AS INTEGER)) as "maxNum" FROM "Project"
    `;
    const maxNum = maxResult[0]?.maxNum ?? 0;
    const code = `OB-${String(maxNum + 1).padStart(3, "0")}`;
    const project = await db.project.create({
      data: {
        code,
        name: body.name,
        description: body.description,
        address: body.address,
        status: body.status || "planning",
        type: body.type || "obra",
        budget: body.budget || 0,
        clientName: body.clientName,
        clientPhone: body.clientPhone,
        clientEmail: body.clientEmail || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        progress: body.progress || 0,
      },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] POST /api/projects:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
