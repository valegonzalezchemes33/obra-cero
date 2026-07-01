import { db } from "@/lib/db";
import { SupplierUpdateSchema } from "@/lib/validation";
import { createGet, createPatch, simpleDelete } from "@/lib/crud-factory";

export const GET = createGet("/api/suppliers/[id]", (id, organizationId) =>
  db.supplier.findFirst({ where: { id, organizationId } })
);

const updateData = (body: any) => ({
  ...(body.name !== undefined && { name: body.name }),
  ...(body.contact !== undefined && { contact: body.contact }),
  ...(body.phone !== undefined && { phone: body.phone }),
  ...(body.email !== undefined && { email: body.email }),
  ...(body.taxId !== undefined && { taxId: body.taxId }),
  ...(body.category !== undefined && { category: body.category }),
  ...(body.rating !== undefined && { rating: body.rating }),
  ...(body.notes !== undefined && { notes: body.notes }),
});

export const PATCH = createPatch(SupplierUpdateSchema, (body, id, organizationId) =>
  db.supplier.update({ where: { id, organizationId }, data: updateData(body) }),
  "/api/suppliers/[id]"
);

export const DELETE = simpleDelete("supplier");
