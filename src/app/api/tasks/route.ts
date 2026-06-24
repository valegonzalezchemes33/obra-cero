import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const tasks = await db.task.findMany({
    include: { project: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });
  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
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
}
