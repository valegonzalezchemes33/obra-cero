import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const mat = await db.material.findUnique({
      where: { id },
      include: { supplier: true, stockMovements: { include: { supplier: true }, orderBy: { date: "desc" }, take: 50 } },
    });
    if (!mat) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(mat);
  } catch (error: any) {
    console.error("[API] GET /api/materials/[id]:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Filtrar campos null/undefined para no pisar valores existentes con NaN
    const safeVal = (v: any) => (v !== undefined && v !== null && v !== '' && !isNaN(Number(v)) ? Number(v) : undefined);

    const updateData: any = {};
    for (const key of ['unitCost', 'unitPrice', 'stock', 'minStock']) {
      if (key in body) {
        const parsed = safeVal(body[key]);
        if (parsed !== undefined) updateData[key] = parsed;
      }
    }
    // maxStock permite null (para eliminar el valor máximo)
    if ('maxStock' in body) {
      updateData.maxStock = body.maxStock !== null && body.maxStock !== '' && !isNaN(Number(body.maxStock)) ? Number(body.maxStock) : null;
    }
    // supplierId: vacío → null
    if ('supplierId' in body) {
      updateData.supplierId = body.supplierId || null;
    }
    // Campos de texto
    for (const key of ['sku', 'name', 'category', 'unit', 'location']) {
      if (key in body && body[key] !== undefined && body[key] !== null) {
        updateData[key] = body[key];
      }
    }

    const mat = await db.material.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(mat);
  } catch (error: any) {
    console.error("[API] PATCH /api/materials/[id]:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.material.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[API] DELETE /api/materials/[id]:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
