import { db } from "@/lib/db";
import { TaskCreateSchema } from "@/lib/validation";
import { cachedGet, createPost } from "@/lib/crud-factory";

export const GET = cachedGet("tasks:list", () =>
  db.task.findMany({
    include: { project: { select: { id: true, name: true, code: true } } },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    take: 200,
  })
);

export const POST = createPost(TaskCreateSchema, (body) =>
  db.task.create({
    data: {
      title: body.title,
      description: body.description,
      status: body.status || "pending",
      priority: body.priority || "medium",
      assignee: body.assignee,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      projectId: body.projectId || null,
      createdBy: "user",
    },
  }),
  "/api/tasks"
);
