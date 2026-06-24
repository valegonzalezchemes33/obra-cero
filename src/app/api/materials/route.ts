import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const materials = await db.material.findMany({
    include: { supplier: true, stockMovements: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(materials);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mat = await db.material.create({
    data: {
      sku: body.sku,
      name: body.name,
      category: body.category || "general",
      unit: body.unit || "unidad",
      unitCost: parseFloat(body.unitCost) || 0,
      unitPrice: parseFloat(body.unitPrice) || 0,
      stock: parseFloat(body.stock) || 0,
      minStock: parseFloat(body.minStock) || 0,
      maxStock: body.maxStock ? parseFloat(body.maxStock) : null,
      location: body.location,
      supplierId: body.supplierId || null,
    },
  });

  // Si hay stock inicial, registrar movimiento
  if (mat.stock > 0) {
    await db.stockMovement.create({
      data: {
        type: "incoming",
        quantity: mat.stock,
        unitCost: mat.unitCost,
        reason: "compra",
        note: "Stock inicial",
        materialId: mat.id,
        supplierId: body.supplierId || null,
      },
    });
  }

  return NextResponse.json(mat, { status: 201 });
}
