import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";
import { parseBody, StockMovementCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const parsed = await parseBody(req, StockMovementCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const mat = await db.material.findUnique({ where: { id } });
    if (!mat) return NextResponse.json({ error: "Material not found" }, { status: 404 });

    const qty = body.quantity;
    const unitCost = body.unitCost ?? mat.unitCost;

    const movement = await db.stockMovement.create({
      data: {
        type: body.type,
        quantity: qty,
        unitCost,
        reason: body.reason || (body.type === "incoming" ? "compra" : "consumo_obra"),
        note: body.note,
        materialId: id,
        supplierId: body.supplierId || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });

    const delta = body.type === "incoming" ? qty : body.type === "outgoing" ? -qty : (qty - mat.stock);
    const newStock = body.type === "adjustment" ? qty : mat.stock + delta;

    let newUnitCost = mat.unitCost;
    if (body.type === "incoming" && unitCost > 0) {
      const totalValue = mat.stock * mat.unitCost + qty * unitCost;
      const totalQty = mat.stock + qty;
      newUnitCost = totalQty > 0 ? totalValue / totalQty : unitCost;
    }

    const updated = await db.material.update({
      where: { id },
      data: { stock: newStock, unitCost: newUnitCost },
    });

    if (body.type === "incoming" && body.supplierId) {
      await db.transaction.create({
        data: {
          type: "expense",
          category: "materiales",
          description: `Compra: ${mat.name} x${qty} ${mat.unit}`,
          amount: qty * unitCost,
          projectId: body.projectId || null,
          supplierId: body.supplierId,
          date: new Date(),
        },
      });
    }

    return NextResponse.json({ movement, material: updated }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] POST /api/materials/[id]/movements:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
