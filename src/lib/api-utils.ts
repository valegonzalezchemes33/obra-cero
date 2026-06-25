import { NextResponse } from "next/server";

type Handler = (req: Request, context: any) => Promise<NextResponse>;

export function withErrorHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (error: any) {
      console.error(`[API] ${req.method} ${new URL(req.url).pathname}:`, error.message);
      return NextResponse.json(
        { error: error.message || "Error interno del servidor" },
        { status: 500 }
      );
    }
  };
}