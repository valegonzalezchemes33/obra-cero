import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError, RateLimitError, rateLimitResponse } from "@/lib/api-utils";
import { parseBody, StockMovementCreateSchema } from "@/lib/validation";
import { apiLogger } from "@/lib/logger";
import { getTenant, orgScope } from "@/lib/tenant";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const tenant = await getTenant();
    const { id } = await params;
    const parsed = await parseBody(req, StockMovementCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const mat = await tx.material.findFirst({ where: { id, organizationId: tenant.organizationId } });
      if (!mat) throw new Error("Material not found");

      const qty = body.quantity;
      const unitCost = body.unitCost ?? mat.unitCost;

      const movement = await tx.stockMovement.create({
        data: orgScope(tenant, {
          type: body.type,
          quantity: qty,
          unitCost,
          reason: body.reason || (body.type === "incoming" ? "compra" : "consumo_obra"),
          note: body.note,
          materialId: id,
          supplierId: body.supplierId || null,
          date: body.date ? new Date(body.date) : new Date(),
        }),
      });

      const stockDelta = body.type === "incoming" ? qty : body.type === "outgoing" ? -qty : 0;
      const isAdjustment = body.type === "adjustment";

      let newUnitCost = mat.unitCost;
      if (body.type === "incoming" && unitCost > 0) {
        const totalValue = mat.stock * mat.unitCost + qty * unitCost;
        const totalQty = mat.stock + qty;
        newUnitCost = totalQty > 0 ? totalValue / totalQty : unitCost;
      }

      const updated = await tx.material.update({
        where: { id },
        data: isAdjustment
          ? { stock: qty, unitCost: newUnitCost }
          : { stock: { increment: stockDelta }, unitCost: newUnitCost },
      });

      if (body.type === "incoming" && body.supplierId) {
        await tx.transaction.create({
          data: orgScope(tenant, {
            type: "expense",
            category: "materiales",
            description: `Compra: ${mat.name} x${qty} ${mat.unit}`,
            amount: qty * unitCost,
            projectId: body.projectId || null,
            supplierId: body.supplierId,
            date: new Date(),
          }),
        });
      }

      return { movement, material: updated };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    if ((error as Error).message === "Material not found") {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }
    apiLogger.error({ module: "API", path: "/api/materials/[id]/movements" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
