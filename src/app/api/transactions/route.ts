import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // income | expense
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
    const body = await req.json();
    const tx = await db.transaction.create({
      data: {
        type: body.type,
        category: body.category,
        description: body.description,
        amount: parseFloat(body.amount),
        projectId: body.projectId || null,
        supplierId: body.supplierId || null,
        method: body.method || "transferencia",
        recurring: body.recurring || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });
    return NextResponse.json(tx, { status: 201 });
  } catch (error: any) {
    console.error("[API] POST /api/transactions:", error.message);
    return NextResponse.json({ error: error.message || "Error interno" }, { status: 500 });
  }
}
