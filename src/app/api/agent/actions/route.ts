import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - listar acciones del agente
export async function GET() {
  const actions = await db.agentAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(actions);
}

// PATCH - marcar acción como resuelta o descartada
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status } = body;
  const action = await db.agentAction.update({
    where: { id },
    data: { status },
  });
  return NextResponse.json(action);
}
