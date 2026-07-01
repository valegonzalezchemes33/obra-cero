import { NextRequest, NextResponse } from "next/server";
import { apiLogger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType, fileName } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "No hay datos de imagen" }, { status: 400 });
    }

    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY no configurada" }, { status: 500 });
    }

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analizá esta imagen en detalle. Extraé toda la información relevante: texto visible, números, fechas, nombres, cantidades, precios, unidades. Describí qué contiene exactamente. Respondé en español argentino.

Si la imagen contiene:
- Una factura o recibo: extraé proveedor, fecha, items (cantidad, descripción, precio unitario, total), subtotal, IVA, total general
- Una lista de materiales: extraé cada item con cantidad, unidad, descripción y precio
- Un presupuesto: extraé cliente, obra, items, montos
- Notas manuscritas: transcribí TODO el texto legible
- Un plano o dibujo técnico: describí las dimensiones y anotaciones visibles

FORMATO DE RESPUESTA:
Primero un RESUMEN de 1-2 líneas.
Luego los DETALLES completos extraídos.`,
              },
              { type: "image_url", image_url: { url: `data:${mimeType || "image/jpeg"};base64,${image}` } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: "Error al procesar imagen con Groq" }, { status: 502 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({
      text,
      summary: text.split("\n").filter(Boolean)[0] || "Imagen analizada",
      fileName,
    });
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/agent/vision" }, error.message);
    return NextResponse.json({ error: "Error al analizar imagen" }, { status: 500 });
  }
}
