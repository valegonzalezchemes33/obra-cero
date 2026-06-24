import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const projects = await db.project.findMany({
    include: { transactions: true, tasks: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Buscar todos los códigos y encontrar el máximo número
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
      budget: parseFloat(body.budget) || 0,
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      clientEmail: body.clientEmail,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      progress: parseFloat(body.progress) || 0,
    },
  });
  return NextResponse.json(project, { status: 201 });
}
