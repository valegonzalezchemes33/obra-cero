import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireSession, authRequiredResponse, AuthRequiredError, RateLimitError, rateLimitResponse } from "@/lib/api-utils";
import { apiLogger } from "@/lib/logger";
import { validateBody } from "@/lib/validation";
import { z } from "zod";

export async function GET() {
  try {
    const actions = await db.agentAction.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json(actions);
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/agent/actions" }, error.message);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireSession();
    const parsed = validateBody(
      z.object({
        id: z.string().optional(),
        ids: z.array(z.string()).optional(),
        status: z.enum(["active", "resolved", "dismissed"]).optional(),
      }).refine((d) => d.id || d.ids, { message: "Se requiere id o ids" }),
      await req.json()
    );
    if (!parsed.ok) return parsed.response;
    const { id, ids, status } = parsed.data;

    const targetIds = ids || (id ? [id] : []);
    const result = await db.agentAction.updateMany({
      where: { id: { in: targetIds } },
      data: { status: status || "resolved" },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error: any) {
    if (error instanceof RateLimitError) return rateLimitResponse();
    if (error instanceof AuthRequiredError) return authRequiredResponse();
    apiLogger.error({ module: "API", path: "/api/agent/actions" }, error.message)
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
