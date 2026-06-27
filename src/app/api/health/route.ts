import { NextResponse } from "next/server";

// GET /api/health — healthcheck público (sin auth)
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "obracero",
  });
}
