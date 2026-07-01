import { db } from "@/lib/db";
import { SupplierCreateSchema } from "@/lib/validation";
import { cachedGet, createPost } from "@/lib/crud-factory";

export const GET = cachedGet("suppliers:list", () =>
  db.supplier.findMany({ orderBy: { name: "asc" }, take: 200 })
);

export const POST = createPost(SupplierCreateSchema, (body) =>
  db.supplier.create({
    data: {
      name: body.name,
      contact: body.contact,
      phone: body.phone,
      email: body.email,
      taxId: body.taxId,
      category: body.category,
      rating: body.rating || 3,
      notes: body.notes,
    },
  }),
  "/api/suppliers"
);
