import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const suppliers = await db.supplier.findMany({
    include: { transactions: true, materials: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(suppliers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const sup = await db.supplier.create({
    data: {
      name: body.name,
      contact: body.contact,
      phone: body.phone,
      email: body.email,
      taxId: body.taxId,
      category: body.category,
      rating: parseFloat(body.rating) || 3,
      notes: body.notes,
    },
  });
  return NextResponse.json(sup, { status: 201 });
}
