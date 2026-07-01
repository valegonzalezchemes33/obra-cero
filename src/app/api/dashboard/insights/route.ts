import { NextResponse } from "next/server";
import { dispatchByIntent, parseIntent } from "@/lib/agent";
import { apiLogger } from "@/lib/logger";

export async function GET() {
  try {
    // Usamos dispatchByIntent directamente (sin processAgentMessage)
    // para evitar guardar mensajes fantasma en agentMessage
    const recParsed = parseIntent("recomendaciones");
    const recommendations = await dispatchByIntent(recParsed);

    const alertParsed = parseIntent("alertas");
    const alerts = await dispatchByIntent(alertParsed);

    const sumParsed = parseIntent("resumen");
    const summary = await dispatchByIntent(sumParsed);

    return NextResponse.json({
      recommendations: {
        text: recommendations.text,
        actions: recommendations.actions || [],
        suggestions: recommendations.suggestions || [],
        data: recommendations.data || null,
      },
      alerts: {
        text: alerts.text,
        actions: alerts.actions || [],
        suggestions: alerts.suggestions || [],
        data: alerts.data || null,
      },
      summary: {
        text: summary.text,
        data: summary.data || null,
        suggestions: summary.suggestions || [],
      },
    });
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/dashboard/insights" }, error.message);
    return NextResponse.json(
      {
        recommendations: null,
        alerts: null,
        summary: null,
        error: "Error al generar insights",
      },
      { status: 200 } // Always return 200 so dashboard doesn't break
    );
  }
}
