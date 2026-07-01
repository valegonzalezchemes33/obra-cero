import { db } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { getCached } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Controller = ReadableStreamDefaultController & { _cleanup?: () => void };

let sharedInterval: ReturnType<typeof setInterval> | null = null;
let cachedPayload: string | null = null;
let lastCount = 0;
const listeners = new Set<Controller>();

async function pollAndNotify() {
  try {
    const actions = await getCached(
      "events:notifications",
      () =>
        db.agentAction.findMany({
          where: { status: "active" },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      4000
    );

    const count = actions.length;
    if (count !== lastCount) {
      lastCount = count;
      cachedPayload = JSON.stringify({ count, actions });
    }

    if (cachedPayload) {
      const msg = `event: notifications\ndata: ${cachedPayload}\n\n`;
      for (const ctrl of listeners) {
        try {
          ctrl.enqueue(msg);
        } catch {
          listeners.delete(ctrl);
        }
      }
    }
  } catch (error) {
    apiLogger.warn({ module: "SSE" }, "catch swallowed: polling agent actions");
  }
}

function ensureSharedPolling() {
  if (!sharedInterval) {
    sharedInterval = setInterval(pollAndNotify, 5000);
    pollAndNotify();
  }
}

// GET /api/events — SSE endpoint for real-time notifications
export async function GET() {
  const stream = new ReadableStream({
    async start(controller: Controller) {
      ensureSharedPolling();
      listeners.add(controller);

      controller.enqueue(`event: connected\ndata: {"status":"ok"}\n\n`);
      if (cachedPayload) {
        controller.enqueue(`event: notifications\ndata: ${cachedPayload}\n\n`);
      }

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(`: heartbeat\n\n`);
        } catch {
          clearInterval(heartbeat);
          listeners.delete(controller);
        }
      }, 30000);
      controller._cleanup = () => clearInterval(heartbeat);
    },
    cancel(controller: Controller) {
      listeners.delete(controller);
      if (controller._cleanup) controller._cleanup();
      if (listeners.size === 0 && sharedInterval) {
        clearInterval(sharedInterval);
        sharedInterval = null;
      }
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
