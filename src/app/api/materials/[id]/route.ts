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
    const mat = await db.material.update({
      where: { id },
      data: {
        ...body,
        unitCost: body.unitCost !== undefined ? parseFloat(body.unitCost) : undefined,
        unitPrice: body.unitPrice !== undefined ? parseFloat(body.unitPrice) : undefined,
        stock: body.stock !== undefined ? parseFloat(body.stock) : undefined,
        minStock: body.minStock !== undefined ? parseFloat(body.minStock) : undefined,
        maxStock: body.maxStock !== undefined ? (body.maxStock ? parseFloat(body.maxStock) : null) : undefined,
      },
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
