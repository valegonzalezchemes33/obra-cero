import { db } from "@/lib/db";
import { MaterialCreateSchema } from "@/lib/validation";
import { cachedGet, createPost } from "@/lib/crud-factory";

export const GET = cachedGet("materials:list", (organizationId) =>
  db.material.findMany({
    where: { organizationId },
    include: { supplier: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
    take: 200,
  })
);



export const POST = createPost(MaterialCreateSchema, async (body) => {
  const result = await db.$transaction(async (tx) => {
    const mat = await tx.material.create({
      data: {
        sku: body.sku || "",
        name: body.name,
        category: body.category || "general",
        unit: body.unit || "unidad",
        unitCost: body.unitCost || 0,
        unitPrice: body.unitPrice || 0,
        stock: body.stock || 0,
        minStock: body.minStock || 0,
        maxStock: body.maxStock ?? null,
        location: body.location,
        supplierId: body.supplierId || null,
        organizationId: body.organizationId,
      },
    });

    if (mat.stock > 0) {
      await tx.stockMovement.create({
        data: {
          type: "incoming",
          quantity: mat.stock,
          unitCost: mat.unitCost,
          reason: "compra",
          note: "Stock inicial",
          materialId: mat.id,
          supplierId: body.supplierId || null,
          organizationId: body.organizationId,
        },
      });
    }

    return mat;
  });

  return result;
}, "/api/materials");
