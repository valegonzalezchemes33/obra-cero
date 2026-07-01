import { db } from "@/lib/db";
import { ProjectUpdateSchema } from "@/lib/validation";
import { createGet, createPatch, simpleDelete } from "@/lib/crud-factory";

export const GET = createGet("/api/projects/[id]", (id, organizationId) =>
  db.project.findFirst({
    where: { id, organizationId },
    include: { transactions: { select: { id: true, type: true, category: true, amount: true, date: true } }, tasks: { select: { id: true, title: true, status: true, priority: true, dueDate: true } } },
  })
);

export const PATCH = createPatch(ProjectUpdateSchema, (body, id, organizationId) =>
  db.project.update({
    where: { id, organizationId },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.type !== undefined && { type: body.type }),
      ...(body.clientName !== undefined && { clientName: body.clientName }),
      ...(body.clientPhone !== undefined && { clientPhone: body.clientPhone }),
      ...(body.clientEmail !== undefined && { clientEmail: body.clientEmail || null }),
      ...(body.budget !== undefined && { budget: body.budget }),
      ...(body.progress !== undefined && { progress: body.progress }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
    },
  }),
  "/api/projects/[id]"
);

export const DELETE = simpleDelete("project");
