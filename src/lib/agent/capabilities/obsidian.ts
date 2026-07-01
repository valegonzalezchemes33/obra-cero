// ============================================================
// CAPABILITY: Obsidian Vault
// ============================================================
// Tools para leer, escribir y buscar notas en el vault de
// Obsidian usando el plugin Obsidian Local REST API.
//
// Requiere:
//   - Plugin "Local REST API" instalado en Obsidian
//   - OBSIDIAN_API_KEY configurada en .env
//   - OBSIDIAN_VAULT_PATH configurada en .env (opcional)
//
// El plugin expone su API en https://127.0.0.1:27124/ (por defecto)
// ============================================================

import { z } from "zod";
import type { AgentResponse } from "@/lib/agent";
import { agentLogger } from "@/lib/logger";

// ─── Config ──────────────────────────────────────────────────

const OBSIDIAN_BASE_URL = process.env.OBSIDIAN_BASE_URL || "https://127.0.0.1:27124";
const OBSIDIAN_API_KEY = process.env.OBSIDIAN_API_KEY || "";

function isConfigured(): boolean {
  return OBSIDIAN_API_KEY.length > 0;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Codifica una ruta de vault respetando los separadores / */
function encodeVaultPath(filePath: string): string {
  return filePath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/** Envía contenido raw (text/markdown) al vault vía PUT o POST */
async function obsidianUpload(
  method: "PUT" | "POST",
  filePath: string,
  content: string
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const url = `${OBSIDIAN_BASE_URL}/vault/${encodeVaultPath(filePath)}`;
  try {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
        "Content-Type": "text/markdown",
      },
      body: content,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true, status: res.status };
  } catch (err: any) {
    const hint = method === "PUT"
      ? " (probando POST como fallback...)"
      : ". ¿Obsidian está corriendo con el plugin Local REST API activo?";
    return { ok: false, status: 0, error: `Conexión rechazada${hint}: ${err.message}` };
  }
}

// ─── HTTP Client (para GET y JSON requests) ──────────────────

async function obsidianFetch(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const url = `${OBSIDIAN_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${OBSIDIAN_API_KEY}`,
  };

  if (body !== undefined && typeof body === "object" && !(body instanceof String)) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 300)}` };
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return { ok: true, status: res.status, data: await res.json() };
    }

    return { ok: true, status: res.status, data: await res.text() };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: `Conexión rechazada a Obsidian (${OBSIDIAN_BASE_URL}). ¿El plugin Local REST API está activo? Detalle: ${err.message}`,
    };
  }
}

// ─── Schemas ─────────────────────────────────────────────────

const ReadNoteSchema = z.object({
  path: z.string().min(1).describe("Ruta de la nota dentro del vault (ej: 'architecture/overview.md' o 'INDEX.md')"),
});

const WriteNoteSchema = z.object({
  path: z.string().min(1).describe("Ruta donde crear/sobrescribir la nota"),
  content: z.string().min(1).describe("Contenido markdown de la nota"),
  append: z.boolean().optional().default(false).describe("Si es true, agrega al final en vez de sobrescribir"),
});

const SearchNotesSchema = z.object({
  query: z.string().min(1).describe("Texto a buscar en el vault"),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

const ListVaultSchema = z.object({
  path: z.string().optional().default("/").describe("Ruta del directorio a listar"),
  pattern: z.string().optional().describe("Filtro glob (ej: '*.md', 'architecture/*.md')"),
});

const AppendToNoteSchema = z.object({
  path: z.string().min(1).describe("Ruta de la nota existente"),
  content: z.string().min(1).describe("Contenido a agregar al final"),
  section: z.string().optional().describe("Si se especifica, agrega bajo un heading específico (ej: '## Related')"),
});

const ListTagsSchema = z.object({});

const ObsidianCommandSchema = z.object({
  commandId: z.string().min(1).describe("ID del comando Obsidian a ejecutar"),
});

// ──────────────────────────────────────────────────────────────
// read_note · Leer una nota del vault
// ──────────────────────────────────────────────────────────────

export async function readNote(args: z.infer<typeof ReadNoteSchema>): Promise<AgentResponse> {
  if (!isConfigured()) {
    return {
      text: `⚠️ **Obsidian no configurado.** Para conectar el vault, configurá:

\`\`\`env
OBSIDIAN_API_KEY=tu_api_key_del_plugin_local_rest_api
\`\`\`

1. Instalá el plugin **Local REST API** desde Community Plugins en Obsidian
2. Copiá la API Key desde Configuración → Local REST API
3. Agregala al archivo \`.env\`
4. Opcional: \`OBSIDIAN_BASE_URL\` (default: https://127.0.0.1:27124)`,
      intent: "obsidian_read_note",
      suggestions: ["¿Qué es el vault de documentación?", "Ayuda"],
    };
  }

  const result = await obsidianFetch("GET", `/vault/${encodeVaultPath(args.path)}`);
  if (!result.ok) {
    return {
      text: `❌ No pude leer la nota **${args.path}**: ${result.error}`,
      intent: "obsidian_read_note",
      suggestions: ["Listar vault", "Ayuda con Obsidian"],
    };
  }

  const content = typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2);
  const maxLen = 3000;
  const truncated = content.length > maxLen ? content.slice(0, maxLen) + `\n\n_... (${content.length - maxLen} caracteres más)_` : content;

  return {
    text: `📖 **${args.path}**\n\n\`\`\`markdown\n${truncated}\n\`\`\``,
    intent: "obsidian_read_note",
    data: { path: args.path, content, fullLength: content.length },
    suggestions: ["Listar vault", "Buscar en vault", "Escribir nota"],
  };
}

// ──────────────────────────────────────────────────────────────
// write_note · Crear o sobrescribir una nota
// ──────────────────────────────────────────────────────────────

export async function writeNote(args: z.infer<typeof WriteNoteSchema>): Promise<AgentResponse> {
  if (!isConfigured()) {
    return {
      text: "⚠️ Obsidian no configurado. Seguí los pasos indicados en *leer nota* primero.",
      intent: "obsidian_write_note",
      suggestions: ["¿Cómo configurar Obsidian?", "Ayuda"],
    };
  }

  if (args.append) {
    const readResult = await obsidianFetch("GET", `/vault/${encodeVaultPath(args.path)}`);
    if (!readResult.ok) {
      return {
        text: `❌ No pude leer la nota existente **${args.path}** para hacer append. ¿Existe?`,
        intent: "obsidian_write_note",
      };
    }
    const existingContent = typeof readResult.data === "string" ? readResult.data : "";
    const newContent = existingContent + "\n\n" + args.content;
    const result = await obsidianUpload("PUT", args.path, newContent);
    if (!result.ok) {
      return {
        text: `❌ Error al actualizar la nota: ${result.error}`,
        intent: "obsidian_write_note",
      };
    }
    return {
      text: `✅ **Nota actualizada:** ${args.path}\n\nSe agregó contenido al final.`,
      intent: "obsidian_write_note",
      data: { path: args.path, appended: true, contentLength: args.content.length },
      suggestions: ["Leer nota", "Buscar en vault", "Escribir otra nota"],
    };
  }

  // Sin append: intentar PUT primero, si falla probar POST (crea directorios intermedios)
  let result = await obsidianUpload("PUT", args.path, args.content);
  if (!result.ok) {
    result = await obsidianUpload("POST", args.path, args.content);
    if (!result.ok) {
      return {
        text: `❌ No pude crear la nota **${args.path}**: ${result.error}`,
        intent: "obsidian_write_note",
      };
    }
    return {
      text: `✅ **Nota creada:** ${args.path}\n\n${args.content.slice(0, 500)}${args.content.length > 500 ? "..." : ""}`,
      intent: "obsidian_write_note",
      data: { path: args.path, contentLength: args.content.length },
      suggestions: ["Leer nota", "Buscar en vault", "Crear otra nota"],
    };
  }

  return {
    text: `✅ **Nota creada/actualizada:** ${args.path}\n\n${args.content.slice(0, 500)}${args.content.length > 500 ? "..." : ""}`,
    intent: "obsidian_write_note",
    data: { path: args.path, contentLength: args.content.length },
    suggestions: ["Leer nota", "Buscar en vault", "Crear otra nota"],
  };
}

// ──────────────────────────────────────────────────────────────
// search_notes · Buscar en el vault
// ──────────────────────────────────────────────────────────────

export async function searchNotes(args: z.infer<typeof SearchNotesSchema>): Promise<AgentResponse> {
  if (!isConfigured()) {
    return {
      text: "⚠️ Obsidian no configurado.",
      intent: "obsidian_search_notes",
      suggestions: ["¿Cómo configurar Obsidian?"],
    };
  }

  const result = await obsidianFetch("POST", "/search/simple/", { query: args.query, limit: args.limit });
  if (!result.ok) {
    return {
      text: `❌ Error al buscar: ${result.error}`,
      intent: "obsidian_search_notes",
    };
  }

  const results = Array.isArray(result.data) ? result.data : [];
  if (results.length === 0) {
    return {
      text: `🔍 No encontré nada para **"${args.query}"** en el vault.`,
      intent: "obsidian_search_notes",
      suggestions: ["Buscar con otro término", "Listar vault"],
    };
  }

  const lines = results.slice(0, args.limit).map((r: any, i: number) => {
    const filename = r.filename || r.path || r.basename || `Resultado ${i + 1}`;
    const score = r.score !== undefined ? ` (${Math.round(r.score * 100)}%)` : "";
    return `${i + 1}. **${filename}**${score}`;
  });

  return {
    text: `🔍 **Resultados para "${args.query}"** (${results.length})\n\n${lines.join("\n")}`,
    intent: "obsidian_search_notes",
    data: { query: args.query, count: results.length, results: results.slice(0, args.limit) },
    suggestions: [
      "Buscar con otro término",
      `Leer ${results[0]?.filename || "resultado"}`,
      "Listar vault",
    ],
  };
}

// ──────────────────────────────────────────────────────────────
// list_vault · Listar archivos del vault
// ──────────────────────────────────────────────────────────────

export async function listVault(args: z.infer<typeof ListVaultSchema>): Promise<AgentResponse> {
  if (!isConfigured()) {
    return {
      text: "⚠️ Obsidian no configurado.",
      intent: "obsidian_list_vault",
    };
  }

  const targetPath = args.path === "/" ? "" : args.path;
  const encoded = targetPath ? encodeVaultPath(targetPath) : "";
  const result = await obsidianFetch("GET", `/vault/${encoded}`);
  if (!result.ok) {
    return {
      text: `❌ Error al listar: ${result.error}`,
      intent: "obsidian_list_vault",
    };
  }

  // La respuesta puede ser un array de archivos/dirs o un objeto
  let files: any[] = [];
  if (Array.isArray(result.data)) {
    files = result.data;
  } else if (typeof result.data === "object") {
    files = result.data.files || result.data.children || result.data.contents || [];
  }

  if (files.length === 0) {
    return {
      text: `📂 **${targetPath || "/"}** está vacío.`,
      intent: "obsidian_list_vault",
      suggestions: ["Subir a carpeta superior", "Buscar en vault"],
    };
  }

  const dirs = files.filter((f: any) => f.type === "directory" || f.type === "folder");
  const noteFiles = files.filter((f: any) => f.type !== "directory" && f.type !== "folder");

  let text = `📂 **Vault: ${targetPath || "/"}** (${files.length} items)\n\n`;

  if (dirs.length > 0) {
    text += `**Directorios:**\n${dirs.map((d: any) => `  📁 ${d.name || d.path || "?"}`).join("\n")}\n\n`;
  }

  if (noteFiles.length > 0) {
    text += `**Archivos:**\n${noteFiles.slice(0, 30).map((f: any) => `  📄 ${f.name || f.path || "?"}`).join("\n")}`;
    if (noteFiles.length > 30) text += `\n  ... y ${noteFiles.length - 30} más`;
  }

  return {
    text,
    intent: "obsidian_list_vault",
    data: { path: targetPath, files: files.slice(0, 50) },
    suggestions: [
      dirs.length > 0 ? `Listar ${dirs[0]?.name || "subdirectorio"}` : "",
      "Buscar en vault",
      "Crear nota",
    ].filter(Boolean),
  };
}

// ──────────────────────────────────────────────────────────────
// append_to_note · Agregar contenido bajo un heading específico
// ──────────────────────────────────────────────────────────────

export async function appendToNote(args: z.infer<typeof AppendToNoteSchema>): Promise<AgentResponse> {
  if (!isConfigured()) {
    return { text: "⚠️ Obsidian no configurado.", intent: "obsidian_append_note" };
  }

  // Primero leer la nota existente
  const readResult = await obsidianFetch("GET", `/vault/${encodeVaultPath(args.path)}`);
  if (!readResult.ok) {
    return {
      text: `❌ No encontré la nota **${args.path}**: ${readResult.error}`,
      intent: "obsidian_append_note",
    };
  }

  let content = typeof readResult.data === "string" ? readResult.data : "";

  if (args.section) {
    // Buscar el heading y agregar después
    const headingRegex = new RegExp(`(^${escapeRegex(args.section)}\\s*$)`, "m");
    if (headingRegex.test(content)) {
      content = content.replace(headingRegex, `$1\n\n${args.content}`);
    } else {
      // Si no existe el heading, agregarlo al final
      content += `\n\n${args.section}\n\n${args.content}`;
    }
  } else {
    content += `\n\n${args.content}`;
  }

  const result = await obsidianUpload("PUT", args.path, content);
  if (!result.ok) {
    return {
      text: `❌ Error al actualizar: ${result.error}`,
      intent: "obsidian_append_note",
    };
  }

  const sectionText = args.section ? ` bajo **${args.section}**` : "";
  return {
    text: `✅ Contenido agregado a **${args.path}**${sectionText}.`,
    intent: "obsidian_append_note",
    data: { path: args.path, section: args.section, contentLength: args.content.length },
    suggestions: ["Leer nota", "Buscar en vault"],
  };
}

// ──────────────────────────────────────────────────────────────
// list_tags · Listar tags del vault
// ──────────────────────────────────────────────────────────────

export async function listTags(): Promise<AgentResponse> {
  if (!isConfigured()) {
    return { text: "⚠️ Obsidian no configurado.", intent: "obsidian_list_tags" };
  }

  const result = await obsidianFetch("GET", "/tags/");
  if (!result.ok) {
    return {
      text: `❌ Error al obtener tags: ${result.error}`,
      intent: "obsidian_list_tags",
    };
  }

  const tags = Array.isArray(result.data)
    ? result.data
    : typeof result.data === "object"
      ? Object.entries(result.data).map(([k, v]) => ({ tag: k, count: v }))
      : [];

  if (tags.length === 0) {
    return {
      text: "No hay tags en el vault.",
      intent: "obsidian_list_tags",
    };
  }

  const lines = tags.slice(0, 30).map((t: any) => `• #${t.tag || t.name || "?"} ${t.count !== undefined ? `(${t.count})` : ""}`);

  return {
    text: `🏷️ **Tags en el vault** (${tags.length})\n\n${lines.join("\n")}`,
    intent: "obsidian_list_tags",
    data: { tags: tags.slice(0, 50) },
    suggestions: ["Buscar por tag", "Listar vault", "Leer nota"],
  };
}

// ──────────────────────────────────────────────────────────────
// execute_obsidian_command · Ejecutar un comando de Obsidian
// ──────────────────────────────────────────────────────────────

export async function executeObsidianCommand(args: z.infer<typeof ObsidianCommandSchema>): Promise<AgentResponse> {
  if (!isConfigured()) {
    return { text: "⚠️ Obsidian no configurado.", intent: "obsidian_execute_command" };
  }

  const result = await obsidianFetch("POST", `/commands/${encodeURIComponent(args.commandId)}/`, {});
  if (!result.ok) {
    return {
      text: `❌ Error al ejecutar comando: ${result.error}`,
      intent: "obsidian_execute_command",
    };
  }

  return {
    text: `✅ Comando **${args.commandId}** ejecutado en Obsidian.`,
    intent: "obsidian_execute_command",
    data: { commandId: args.commandId },
    suggestions: ["Listar comandos", "Leer nota", "Buscar en vault"],
  };
}

// ──────────────────────────────────────────────────────────────
// Helper: escapar regex
// ──────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Schema mapping ───────────────────────────────────────────

export const obsidianToolSchemas = {
  obsidian_read_note: ReadNoteSchema,
  obsidian_write_note: WriteNoteSchema,
  obsidian_search_notes: SearchNotesSchema,
  obsidian_list_vault: ListVaultSchema,
  obsidian_append_note: AppendToNoteSchema,
  obsidian_list_tags: ListTagsSchema,
  obsidian_execute_command: ObsidianCommandSchema,
} as const;
