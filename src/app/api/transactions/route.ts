import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { TransactionCreateSchema } from "@/lib/validation";
import { cachedGet, createPost, handleError } from "@/lib/crud-factory";
import { getTenant } from "@/lib/tenant";

async function listTransactions(req: NextRequest, organizationId: string) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const projectId = searchParams.get("projectId");
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "100") || 100), 1000);

  const where: { type?: string; projectId?: string; organizationId: string } = { organizationId };
  if (type && ["income", "expense"].includes(type)) where.type = type;
  if (projectId) where.projectId = projectId;

  return db.transaction.findMany({
    where,
    include: { project: { select: { id: true, name: true, code: true } }, supplier: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function GET(req: NextRequest) {
  try {
    const tenant = await getTenant();
    const data = await listTransactions(req, tenant.organizationId);
    return NextResponse.json(data);
  } catch (error: any) {
    return handleError(error, "/api/transactions");
  }
}

export const POST = createPost(TransactionCreateSchema, (body) =>
  db.transaction.create({
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
      organizationId: body.organizationId,
    },
  }),
  "/api/transactions"
);
