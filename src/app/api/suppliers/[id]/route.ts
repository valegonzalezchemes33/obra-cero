import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";
import { parseBody, SupplierUpdateSchema } from "@/lib/validation";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    const parsed = await parseBody(req, SupplierUpdateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const sup = await db.supplier.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.contact !== undefined && { contact: body.contact }),
        ...(body.phone !== undefined && { phone: body.phone }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.taxId !== undefined && { taxId: body.taxId }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.rating !== undefined && { rating: body.rating }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
    return NextResponse.json(sup);
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    if (error?.code === "P2025") return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    console.error("[API] PATCH /api/suppliers/[id]:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
    const { id } = await params;
    await db.supplier.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    if (error?.code === "P2025") return NextResponse.json({ error: "Proveedor no encontrado" }, { status: 404 });
    console.error("[API] DELETE /api/suppliers/[id]:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
