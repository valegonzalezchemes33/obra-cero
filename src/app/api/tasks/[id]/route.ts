import { db } from "@/lib/db";
import { TaskUpdateSchema } from "@/lib/validation";
import { createGet, createPatch, simpleDelete } from "@/lib/crud-factory";

export const GET = createGet("/api/tasks/[id]", (id, organizationId) =>
  db.task.findFirst({ where: { id, organizationId } })
);

export const PATCH = createPatch(TaskUpdateSchema, (body, id, organizationId) =>
  db.task.update({
    where: { id, organizationId },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.assignee !== undefined && { assignee: body.assignee }),
      ...(body.projectId !== undefined && { projectId: body.projectId }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
    },
  }),
  "/api/tasks/[id]"
);

export const DELETE = simpleDelete("task");
