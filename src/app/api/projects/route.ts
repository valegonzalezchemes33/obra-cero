import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";
import { parseBody, ProjectCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const projects = await db.project.findMany({
      include: { transactions: true, tasks: true },
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
    const allProjects = await db.project.findMany({ select: { code: true } });
    let maxNum = 0;
    for (const p of allProjects) {
      const m = p.code?.match(/OB-(\d+)/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
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
