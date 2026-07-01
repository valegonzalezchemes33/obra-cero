import { NextRequest, NextResponse } from "next/server";
import { apiLogger } from "@/lib/logger";

async function analyzePdf(buffer: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const { PDFParse } = await import("pdf-parse");
  const pdf = new PDFParse({ data: buffer });
  const textResult = await pdf.getText();
  return { text: textResult.text || "", pages: textResult.total || 1 };
}

export async function POST(req: NextRequest) {
  try {
    const { data, fileName } = await req.json();
    if (!data || !fileName) {
      return NextResponse.json({ error: "Faltan datos (data, fileName)" }, { status: 400 });
    }

    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    const isText = /\.(txt|csv|md|json|xml|csv)$/i.test(fileName);

    let extractedText: string;
    let pages = 1;

    if (isPdf) {
      const raw = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const result = await analyzePdf(raw.buffer);
      extractedText = result.text;
      pages = result.pages;
    } else if (isText) {
      extractedText = atob(data);
    } else {
      return NextResponse.json({ error: `Tipo de archivo no soportado: ${fileName}` }, { status: 400 });
    }

    if (!extractedText.trim()) {
      return NextResponse.json({ error: "No se pudo extraer contenido del archivo" }, { status: 422 });
    }

    const lines = extractedText.split("\n").filter((l: string) => l.trim());
    const summary = lines[0]?.slice(0, 120) || `Archivo analizado: ${fileName}`;

    return NextResponse.json({
      text: extractedText.slice(0, 8000),
      summary,
      pages,
      fileName,
    });
  } catch (error: any) {
    apiLogger.error({ module: "API", path: "/api/agent/analyze-file" }, error.message);
    return NextResponse.json({ error: "Error al analizar archivo" }, { status: 500 });
  }
}
