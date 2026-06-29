import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";
import { parseBody, SupplierCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const suppliers = await db.supplier.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json(suppliers);
  } catch (error: any) {
    console.error("[API] GET /api/suppliers:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseBody(req, SupplierCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const sup = await db.supplier.create({
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
    });
    return NextResponse.json(sup, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] POST /api/suppliers:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
