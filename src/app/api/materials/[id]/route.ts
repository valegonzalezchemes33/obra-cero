import { db } from "@/lib/db";
import { MaterialUpdateSchema } from "@/lib/validation";
import { createGet, createPatch, simpleDelete } from "@/lib/crud-factory";

export const GET = createGet("/api/materials/[id]", (id, organizationId) =>
  db.material.findFirst({
    where: { id, organizationId },
    include: { supplier: { select: { id: true, name: true } }, stockMovements: { include: { supplier: { select: { id: true, name: true } } }, orderBy: { date: "desc" }, take: 50 } },
  })
);

export const PATCH = createPatch(MaterialUpdateSchema, (body, id, organizationId) =>
  db.material.update({ where: { id, organizationId }, data: body }),
  "/api/materials/[id]"
);

export const DELETE = simpleDelete("material");
