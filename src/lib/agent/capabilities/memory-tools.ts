// ============================================================
// CAPABILITY: Memory Tools
// ============================================================
// Tools para que el agente recuerde, olvide y recupere
// preferencias del usuario (persistent storage en AgentMessage).
//
// No accede a la DB directamente: usa PreferencesStore
// del context manager.
// ============================================================

import { z } from "zod";
import { getPreference, setPreference, deletePreference, listPreferences } from "../context";
import type { AgentResponse } from "@/lib/agent";

// ─── Schemas ──────────────────────────────────────────────────

const RememberSchema = z.object({
  key: z.string().min(1).max(60),
  value: z.any(),
  category: z.enum(["communication", "finance", "project", "ui", "general"]).default("general"),
});

const RecallSchema = z.object({
  key: z.string().min(1),
});

const ForgetSchema = z.object({
  key: z.string().min(1),
});

// ──────────────────────────────────────────────────────────────
// remember_preference · Guardar una preferencia
// ──────────────────────────────────────────────────────────────

export async function rememberPreference(
  args: z.infer<typeof RememberSchema>
): Promise<AgentResponse> {
  try {
    const pref = await setPreference({
      key: args.key,
      value: args.value,
      category: args.category,
    });

    return {
      text: `✅ Guardado: **${args.key}** = \`${JSON.stringify(args.value)}\` (${args.category})`,
      intent: "remember_preference",
      data: { key: pref.key, value: pref.value, category: pref.category },
      suggestions: [`¿Qué valor tiene ${args.key}?`, "Olvida esta preferencia", "Lista mis preferencias"],
    };
  } catch (err: any) {
    return {
      text: `❌ No pude guardar la preferencia: ${err.message}`,
      intent: "remember_preference",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ──────────────────────────────────────────────────────────────
// recall_preference · Recuperar una preferencia
// ──────────────────────────────────────────────────────────────

export async function recallPreference(
  args: z.infer<typeof RecallSchema>
): Promise<AgentResponse> {
  try {
    const pref = await getPreference(args.key);

    if (!pref) {
      return {
        text: `No tengo ninguna preferencia guardada para **"${args.key}"**.`,
        intent: "recall_preference",
        suggestions: [`Remember ${args.key} = ...`, "Lista mis preferencias"],
      };
    }

    return {
      text: `📌 **${args.key}** = \`${JSON.stringify(pref.value)}\` (guardado el ${new Date(pref.savedAt).toLocaleDateString("es-AR")})`,
      intent: "recall_preference",
      data: { key: pref.key, value: pref.value, category: pref.category },
      suggestions: [`Cambia ${args.key}`, `Olvida ${args.key}`, "Lista mis preferencias"],
    };
  } catch (err: any) {
    return {
      text: `❌ Error al recuperar: ${err.message}`,
      intent: "recall_preference",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ──────────────────────────────────────────────────────────────
// forget_preference · Eliminar una preferencia
// ──────────────────────────────────────────────────────────────

export async function forgetPreference(
  args: z.infer<typeof ForgetSchema>
): Promise<AgentResponse> {
  try {
    const deleted = await deletePreference(args.key);

    if (!deleted) {
      return {
        text: `No existía ninguna preferencia para **"${args.key}"**.`,
        intent: "forget_preference",
        suggestions: ["Lista mis preferencias"],
      };
    }

    return {
      text: `🗑️ Olvidado: **${args.key}** fue eliminada de la memoria.`,
      intent: "forget_preference",
      data: { key: args.key },
      suggestions: ["Lista mis preferencias", "Remember mi_nueva_preferencia = ..."],
    };
  } catch (err: any) {
    return {
      text: `❌ Error al olvidar: ${err.message}`,
      intent: "forget_preference",
      suggestions: ["Intentar de nuevo"],
    };
  }
}

// ──────────────────────────────────────────────────────────────
// list_preferences · Listar todas las preferencias
// ──────────────────────────────────────────────────────────────

export async function listAllPreferences(): Promise<AgentResponse> {
  try {
    const prefs = await listPreferences();

    if (prefs.length === 0) {
      return {
        text: "No tenés preferencias guardadas todavía.",
        intent: "list_preferences",
        suggestions: ["Remember formato = json", "Remember moneda = usd"],
      };
    }

    const lines = prefs.map(p =>
      `• **${p.key}** = \`${JSON.stringify(p.value)}\` [${p.category}]`
    );

    return {
      text: `📋 Preferencias guardadas:\n\n${lines.join("\n")}`,
      intent: "list_preferences",
      data: { preferences: prefs, count: prefs.length },
      suggestions: ["Forget mi_preferencia", "Remember nueva = ..."],
    };
  } catch (err: any) {
    return {
      text: `❌ Error: ${err.message}`,
      intent: "list_preferences",
      suggestions: [],
    };
  }
}

// ─── Schema mapping para el registry ────────────────────────

export const memoryToolSchemas = {
  remember_preference: RememberSchema,
  recall_preference: RecallSchema,
  forget_preference: ForgetSchema,
} as const;