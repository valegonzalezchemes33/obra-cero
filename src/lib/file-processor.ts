// Procesamiento de archivos subidos: imágenes, PDFs, texto plano
// Usa Groq Vision para imágenes, pdf-parse para PDFs, y lectura directa para texto

import { sanitizeForGroq } from "@/lib/agent/audit";

const VISION_MODEL = "llama-3.2-11b-vision-preview";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "text/plain", "text/csv",
];

export interface FileAnalysisResult {
  success: boolean;
  type: "image" | "pdf" | "text" | "unsupported";
  fileName: string;
  content: string;
  summary: string;
  error?: string;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return `El archivo excede el límite de 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  if (!ALLOWED_TYPES.includes(file.type)) {
    if (file.name.endsWith(".pdf") && file.type === "") return null;
    return `Tipo de archivo no soportado: ${file.type || "desconocido"}. Permitidos: imágenes, PDFs, textos`;
  }
  return null;
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function analyzeImage(file: File): Promise<FileAnalysisResult> {
  const base64 = await fileToBase64(file);
  const mimeType = file.type || "image/jpeg";

  const groqApiKey = process.env.GROQ_API_KEY;
  if (!groqApiKey) {
    return { success: false, type: "image", fileName: file.name, content: "", summary: "", error: "GROQ_API_KEY no configurada" };
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
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
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, type: "image", fileName: file.name, content: "", summary: "", error: `Groq Vision error: ${err.slice(0, 300)}` };
    }

    const data = await response.json();
    const fullContent = data.choices?.[0]?.message?.content || "";

    const lines = fullContent.split("\n").filter((l: string) => l.trim());
    const summary = lines[0] || "Imagen analizada";
    const content = sanitizeForGroq(fullContent);

    return { success: true, type: "image", fileName: file.name, content, summary };
  } catch (error: any) {
    return { success: false, type: "image", fileName: file.name, content: "", summary: "", error: `Error al analizar imagen: ${error.message}` };
  }
}

export async function analyzePdf(file: File): Promise<FileAnalysisResult> {
  try {
    const buffer = await file.arrayBuffer();
    const { PDFParse } = await import("pdf-parse");
    const pdf = new PDFParse({ data: buffer });
    const textResult = await pdf.getText();
    const text = textResult.text || "";
    const pages = textResult.total || 1;

    if (!text.trim()) {
      return { success: false, type: "pdf", fileName: file.name, content: "", summary: "", error: "No se pudo extraer texto del PDF" };
    }

    const lines = text.split("\n").filter((l: string) => l.trim());
    const summary = lines[0]?.slice(0, 120) || `PDF analizado (${pages} páginas)`;
    const content = `[PDF: ${file.name} - ${pages} página(s)]\n\n${text}`;

    return { success: true, type: "pdf", fileName: file.name, content: sanitizeForGroq(content), summary };
  } catch (error: any) {
    return { success: false, type: "pdf", fileName: file.name, content: "", summary: "", error: `Error al leer PDF: ${error.message}` };
  }
}

export async function analyzeTextFile(file: File): Promise<FileAnalysisResult> {
  try {
    const text = await file.text();
    const trimmed = text.trim();

    if (!trimmed) {
      return { success: false, type: "text", fileName: file.name, content: "", summary: "", error: "El archivo está vacío" };
    }

    const lines = trimmed.split("\n").filter((l: string) => l.trim());
    const summary = lines[0]?.slice(0, 120) || `Archivo de texto: ${file.name}`;
    const content = `[Archivo: ${file.name}]\n\n${trimmed}`;

    return { success: true, type: "text", fileName: file.name, content: sanitizeForGroq(content), summary };
  } catch (error: any) {
    return { success: false, type: "text", fileName: file.name, content: "", summary: "", error: `Error al leer archivo: ${error.message}` };
  }
}

export async function analyzeFile(file: File): Promise<FileAnalysisResult> {
  const type = file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "text/plain");

  if (type.startsWith("image/")) return analyzeImage(file);
  if (type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return analyzePdf(file);
  if (type.startsWith("text/") || file.name.endsWith(".csv") || file.name.endsWith(".txt") || file.name.endsWith(".md")) return analyzeTextFile(file);

  return { success: false, type: "unsupported", fileName: file.name, content: "", summary: "", error: "Tipo de archivo no soportado" };
}
