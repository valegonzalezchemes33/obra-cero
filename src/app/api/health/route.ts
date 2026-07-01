import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/health — healthcheck público (sin auth)
export async function GET() {
  let dbStatus = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = "error";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    service: "obracero",
    checks: {
      database: dbStatus,
    },
  });
}
