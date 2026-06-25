import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// POST /api/materials/[id]/movements - Registrar movimiento de stock
// Body: { type: "incoming" | "outgoing" | "adjustment", quantity, unitCost?, reason, note?, projectId?, supplierId? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const mat = await db.material.findUnique({ where: { id } });
    if (!mat) return NextResponse.json({ error: "Material not found" }, { status: 404 });

    const qty = parseFloat(body.quantity);
    const unitCost = body.unitCost ? parseFloat(body.unitCost) : mat.unitCost;

    // Crear movimiento
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

    // Actualizar stock
    const delta = body.type === "incoming" ? qty : body.type === "outgoing" ? -qty : (qty - mat.stock);
    const newStock = body.type === "adjustment" ? qty : mat.stock + delta;

    // Actualizar unit cost si es incoming (promedio ponderado simple)
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

    // Si es incoming y tiene supplier, también registrar transacción de gasto
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
    console.error("[API] POST /api/materials/[id]/movements:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
