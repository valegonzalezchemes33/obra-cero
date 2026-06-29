import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";
import { parseBody, MaterialCreateSchema } from "@/lib/validation";

export async function GET() {
  try {
    const materials = await db.material.findMany({
      include: { supplier: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(materials);
  } catch (error: any) {
    console.error("[API] GET /api/materials:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseBody(req, MaterialCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const mat = await db.material.create({
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
      },
    });

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
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] POST /api/materials:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
