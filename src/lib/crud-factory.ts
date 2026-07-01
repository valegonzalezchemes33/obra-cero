import { NextRequest, NextResponse } from "next/server";
import { requireSession, authRequiredResponse, AuthRequiredError, RateLimitError, rateLimitResponse, getSessionOrganization } from "@/lib/api-utils";
import { parseBody } from "@/lib/validation";
import { apiLogger } from "@/lib/logger";
import { getCached } from "@/lib/cache";
import { getTenant, orgScope } from "@/lib/tenant";

type Params = { params: Promise<{ id: string }> };

export function handleError(error: any, path: string): NextResponse {
  if (error instanceof RateLimitError) return rateLimitResponse();
  if (error instanceof AuthRequiredError) return authRequiredResponse();
  if (error?.code === "P2025") return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  apiLogger.error({ module: "API", path }, error.message)
  return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
}

/** Wraps a collection-GET handler with caching, error handling, and logging */
export function cachedGet(cacheKey: string, query: () => Promise<any[]>, ttl = 15000) {
  return async function GET() {
    try {
      const data = await getCached(cacheKey, query, ttl);
      return NextResponse.json(data);
    } catch (error: any) {
      return handleError(error, `/api/${cacheKey.split(":")[0]}`);
    }
  };
}

/** Wraps a POST handler with requireSession, body parsing, error handling, and orgId injection */
export function createPost(schema: any, handler: (body: any) => Promise<any>, path: string) {
  return async function POST(req: NextRequest) {
    try {
      await requireSession();
      const tenant = await getTenant();
      const parsed = await parseBody(req, schema);
      if (!parsed.ok) return parsed.response;
      // Inyectar organizationId automáticamente
      const result = await handler(orgScope(tenant, parsed.data));
      return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
      return handleError(error, path);
    }
  };
}

/** Wraps a single-resource GET handler with params parsing, 404 check, error handling, and org scoping */
export function createGet(path: string, handler: (id: string, organizationId: string) => Promise<any>) {
  return async function GET(_req: NextRequest, { params }: Params) {
    try {
      const { id } = await params;
      const tenant = await getTenant();
      const record = await handler(id, tenant.organizationId);
      if (!record) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
      return NextResponse.json(record);
    } catch (error: any) {
      return handleError(error, path);
    }
  };
}

/** Wraps a PATCH handler with requireSession, params parsing, body parsing, error handling, and org scoping */
export function createPatch(schema: any, handler: (body: any, id: string, organizationId: string) => Promise<any>, path: string) {
  return async function PATCH(req: NextRequest, { params }: Params) {
    try {
      await requireSession();
      const tenant = await getTenant();
      const { id } = await params;
      const parsed = await parseBody(req, schema);
      if (!parsed.ok) return parsed.response;
      const result = await handler(parsed.data, id, tenant.organizationId);
      return NextResponse.json(result);
    } catch (error: any) {
      return handleError(error, path);
    }
  };
}

/** Wraps a DELETE handler with requireSession, params parsing, error handling, and org scoping */
export function createDelete(path: string, handler?: (id: string, organizationId: string) => Promise<void>) {
  return async function DELETE(_req: NextRequest, { params }: Params) {
    try {
      await requireSession();
      const tenant = await getTenant();
      const { id } = await params;
      if (handler) await handler(id, tenant.organizationId);
      return NextResponse.json({ ok: true });
    } catch (error: any) {
      return handleError(error, path);
    }
  };
}

/** Creates standard DELETE handler that deletes by id + orgId for tenant isolation */
export function simpleDelete(model: string) {
  return createDelete(`/api/${model}/[id]`, async (id, organizationId) => {
    const { db } = await import("@/lib/db");
    await (db as any)[model].delete({ where: { id, organizationId } });
  });
}
