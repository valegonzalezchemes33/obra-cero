import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError } from "@/lib/api-utils";
import { parseBody, TransactionCreateSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const projectId = searchParams.get("projectId");
    const limit = parseInt(searchParams.get("limit") || "100");

    const where: any = {};
    if (type) where.type = type;
    if (projectId) where.projectId = projectId;

    const transactions = await db.transaction.findMany({
      where,
      include: { project: true, supplier: true },
      orderBy: { date: "desc" },
      take: limit,
    });
    return NextResponse.json(transactions);
  } catch (error: any) {
    console.error("[API] GET /api/transactions:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const parsed = await parseBody(req, TransactionCreateSchema);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const tx = await db.transaction.create({
      data: {
        type: body.type,
        category: body.category,
        description: body.description || "",
        amount: body.amount,
        projectId: body.projectId || null,
        supplierId: body.supplierId || null,
        method: body.method || "transferencia",
        recurring: body.recurring || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });
    return NextResponse.json(tx, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    console.error("[API] POST /api/transactions:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
