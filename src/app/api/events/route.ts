import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/events — SSE endpoint for real-time notifications
export async function GET() {
  let lastCount = 0;
  const stream = new ReadableStream({
    async start(controller) {
      // Send initial connection event
      controller.enqueue(`event: connected\ndata: {"status":"ok"}\n\n`);

      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(`: heartbeat\n\n`);
        } catch {
          clearInterval(heartbeatInterval);
          clearInterval(dataInterval);
        }
      }, 30000);

      const dataInterval = setInterval(async () => {
        try {
          const actions = await db.agentAction.findMany({
            where: { status: "active" },
            orderBy: { createdAt: "desc" },
            take: 20,
          });

          const count = actions.length;

          if (count !== lastCount) {
            lastCount = count;
            const payload = JSON.stringify({ count, actions });
            controller.enqueue(`event: notifications\ndata: ${payload}\n\n`);
          }
        } catch {
          // Ignore errors during polling
        }
      }, 5000);

      // Store for cleanup
      (stream as any)._cleanup = () => {
        clearInterval(heartbeatInterval);
        clearInterval(dataInterval);
      };
    },
    cancel() {
      const cleanup = (stream as any)._cleanup;
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
