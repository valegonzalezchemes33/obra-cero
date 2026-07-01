import { db } from "@/lib/db";
import { TransactionUpdateSchema } from "@/lib/validation";
import { createGet, createPatch, simpleDelete } from "@/lib/crud-factory";

export const GET = createGet("/api/transactions/[id]", (id, organizationId) =>
  db.transaction.findFirst({ where: { id, organizationId } })
);

export const PATCH = createPatch(TransactionUpdateSchema, (body, id, organizationId) =>
  db.transaction.update({ where: { id, organizationId }, data: body }),
  "/api/transactions/[id]"
);

export const DELETE = simpleDelete("transaction");
