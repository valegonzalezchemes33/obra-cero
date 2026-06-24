import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const mat = await db.material.findUnique({
    where: { id },
    include: { supplier: true, stockMovements: { include: { project: true, supplier: true }, orderBy: { date: "desc" }, take: 50 } },
  });
  if (!mat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mat);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.material.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
