import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const tasks = await db.task.findMany({
      include: { project: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error("[API] GET /api/tasks:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const task = await db.task.create({
      data: {
        title: body.title,
        description: body.description,
        status: body.status || "pending",
        priority: body.priority || "medium",
        assignee: body.assignee,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        projectId: body.projectId || null,
        createdBy: body.createdBy || "user",
      },
    });
    return NextResponse.json(task, { status: 201 });
  } catch (error: any) {
    console.error("[API] POST /api/tasks:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
