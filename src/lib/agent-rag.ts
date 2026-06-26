// ============================================================
// SISTEMA RAG (Retrieval Augmented Generation) LOCAL
// Búsqueda semántica sin APIs externas usando TF-IDF
// ============================================================
// Permite que el agente "recuerde" respuestas de conversaciones
// anteriores y las reutilice cuando encuentra preguntas similares.
// ============================================================

import { db } from "@/lib/db";
import { normalize } from "./agent";
import type { AgentResponse } from "./agent";

// ─── Tokenizer ───

function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-záéíóúñ0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

// ─── Calcular TF (Term Frequency) ───

function computeTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) || 0) + 1);
  }
  const len = tokens.length;
  for (const [k, v] of tf) {
    tf.set(k, v / len);
  }
  return tf;
}

// ─── Calcular IDF (Inverse Document Frequency) ───

function computeIDF(documents: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const N = documents.length;

  for (const doc of documents) {
    const seen = new Set(doc);
    for (const term of seen) {
      idf.set(term, (idf.get(term) || 0) + 1);
    }
  }

  for (const [term, count] of idf) {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1);
  }

  return idf;
}

// ─── TF-IDF vector ───

function computeTFIDF(
  tf: Map<string, number>,
  idf: Map<string, number>
): Map<string, number> {
  const vec = new Map<string, number>();
  for (const [term, tfVal] of tf) {
    vec.set(term, tfVal * (idf.get(term) || 1));
  }
  return vec;
}

// ─── Cosine similarity ───

function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const val of a.values()) normA += val * val;
  for (const val of b.values()) normB += val * val;

  if (normA === 0 || normB === 0) return 0;

  // Solo iterar sobre el más chico
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [term, val] of small) {
    dotProduct += val * (large.get(term) || 0);
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Interfaz de resultado ───

export interface RAGResult {
  found: boolean;
  confidence: number;
  query: string;
  matchedQuestion?: string;
  matchedAnswer?: string;
  response?: AgentResponse;
}

// ─── Cache de TF-IDF ───

interface RAGCacheEntry {
  pairs: { question: string; answer: string }[];
  idf: Map<string, number>;
  documents: string[][];
  timestamp: number;
  messageCount: number;
}

let ragCache: RAGCacheEntry | null = null;
const RAG_CACHE_TTL = 60000; // 1 minuto

async function getOrBuildCorpus(): Promise<{
  pairs: { question: string; answer: string }[];
  idf: Map<string, number>;
  documents: string[][];
} | null> {
  // Verificar cache
  const now = Date.now();
  if (ragCache && now - ragCache.timestamp < RAG_CACHE_TTL) {
    // Verificar que la cantidad de mensajes no haya cambiado
    const currentCount = await db.agentMessage.count();
    if (currentCount === ragCache.messageCount) {
      return { pairs: ragCache.pairs, idf: ragCache.idf, documents: ragCache.documents };
    }
  }

  // Obtener historial reciente (últimos 100 mensajes)
  const messages = await db.agentMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Armar pares (user → agent)
  const pairs: { question: string; answer: string }[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && i + 1 < messages.length && messages[i + 1].role === "agent") {
      pairs.push({
        question: messages[i].content,
        answer: messages[i + 1].content,
      });
    }
  }

  if (pairs.length === 0) return null;

  // Preparar corpus
  const documents = pairs.map((p) => tokenize(p.question));
  const idf = computeIDF(documents);

  // Actualizar cache
  ragCache = {
    pairs,
    idf,
    documents,
    timestamp: now,
    messageCount: messages.length,
  };

  return { pairs, idf, documents };
}

// ─── Buscar respuesta similar en el historial ───

export async function queryRAG(userMessage: string): Promise<RAGResult> {
  const queryTokens = tokenize(userMessage);
  if (queryTokens.length < 2) {
    return { found: false, confidence: 0, query: userMessage };
  }

  const corpus = await getOrBuildCorpus();
  if (!corpus) {
    return { found: false, confidence: 0, query: userMessage };
  }

  const { pairs, idf, documents } = corpus;
  const queryTF = computeTF(queryTokens);
  const queryVector = computeTFIDF(queryTF, idf);

  // Encontrar el más similar
  let bestScore = 0;
  let bestPair: (typeof pairs)[0] | null = null;

  for (let i = 0; i < pairs.length; i++) {
    const docTokens = documents[i];
    if (docTokens.length === 0) continue;

    const docTF = computeTF(docTokens);
    const docVector = computeTFIDF(docTF, idf);
    const sim = cosineSimilarity(queryVector, docVector);

    // Bonus por similitud de longitud (penalizar diferencias grandes)
    const lenRatio = Math.min(queryTokens.length, docTokens.length) / Math.max(queryTokens.length, docTokens.length);
    const adjustedScore = sim * lenRatio;

    if (adjustedScore > bestScore) {
      bestScore = adjustedScore;
      bestPair = pairs[i];
    }
  }

  // Umbral: 0.45 es un buen balance
  if (bestPair && bestScore >= 0.45) {
    return {
      found: true,
      confidence: Math.round(bestScore * 100),
      query: userMessage,
      matchedQuestion: bestPair.question,
      matchedAnswer: bestPair.answer,
      response: {
        text: `📚 *Basado en una conversación anterior similar:*\n\n${bestPair.answer}\n\n---\n*Coincidencia: ${Math.round(bestScore * 100)}%*`,
        intent: "unknown",
        suggestions: ["¿Cómo vamos?", "Recomendaciones", "Ayuda"],
      },
    };
  }

  return { found: false, confidence: 0, query: userMessage };
}

// ─── Obtener historial resumido para el agente predictivo ───

export async function getConversationHistory(limit = 50) {
  const messages = await db.agentMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return messages.reverse();
}

// ─── Detectar temas frecuentes en el historial ───

export interface FrequentTopic {
  keywords: string[];
  count: number;
  lastMentioned: Date;
  sampleQuestion: string;
}

export async function detectFrequentTopics(): Promise<FrequentTopic[]> {
  const messages = await db.agentMessage.findMany({
    where: { role: "user" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Agrupar por palabras clave principales
  const topicGroups = new Map<string, { count: number; lastDate: Date; samples: string[] }>();

  for (const msg of messages) {
    const tokens = tokenize(msg.content);
    // Tomar los 3 tokens más significativos como "tema"
    const keywords = [...new Set(tokens)].slice(0, 3).sort().join(" ");
    if (!keywords || keywords.length < 3) continue;

    const existing = topicGroups.get(keywords) || { count: 0, lastDate: msg.createdAt, samples: [] };
    existing.count++;
    if (msg.createdAt > existing.lastDate) existing.lastDate = msg.createdAt;
    if (existing.samples.length < 3) existing.samples.push(msg.content);
    topicGroups.set(keywords, existing);
  }

  // Devolver los temas más frecuentes (más de 2 ocurrencias)
  return [...topicGroups.entries()]
    .filter(([, v]) => v.count >= 3)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 5)
    .map(([keywords, v]) => ({
      keywords: keywords.split(" "),
      count: v.count,
      lastMentioned: v.lastDate,
      sampleQuestion: v.samples[0] || "",
    }));
}
