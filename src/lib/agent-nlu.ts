// ============================================================
// NORMALIZADOR DE MENSAJES — Traduce lenguaje natural
// variado al formato canónico que el NLU entiende
// ============================================================
//
// El NLU actual usa patrones regex fijos. Este módulo
// traduce frases como "dame ganancias", "controla el stock",
// a formatos que los patrones existentes reconocen.
//
// IMPORTANTE: Cada regla debe PRESERVAR las entidades
// (nombres de obras, materiales, montos) que vienen después
// de la frase. Nunca reemplazar con un string fijo que
// ignore el resto del mensaje.

export interface NormalizationResult {
  normalized: string;
  wasNormalized: boolean;
  extraEntities: Record<string, any>;
  confidence: number;
}

type ReplacementFn = (match: RegExpMatchArray, fullText: string) => string;

interface NormalizationRule {
  pattern: RegExp;
  replacement: string | ReplacementFn;
  priority: number;
  description: string;
}

const NORMALIZATION_RULES: NormalizationRule[] = [
  // ─── Conjugación verbal: imperativo → infinitivo ───
  { pattern: /^registra\b/i, replacement: "registrar", priority: 90, description: "registra→registrar" },
  { pattern: /^carga\b/i, replacement: "cargar", priority: 90, description: "carga→cargar" },
  { pattern: /^anota\b/i, replacement: "anotar", priority: 90, description: "anota→anotar" },
  { pattern: /^agrega\b/i, replacement: "agregar", priority: 90, description: "agrega→agregar" },
  { pattern: /^suma\b/i, replacement: "sumar", priority: 90, description: "suma→sumar" },
  { pattern: /^crea\b/i, replacement: "crear", priority: 90, description: "crea→crear" },
  { pattern: /^pone\b/i, replacement: "poner", priority: 90, description: "pone→poner" },
  { pattern: /^actualiza\b/i, replacement: "actualizar", priority: 90, description: "actualiza→actualizar" },
  { pattern: /^consum[ií]\b/i, replacement: "consumir", priority: 90, description: "consume→consumir" },
  { pattern: /^lista\b/i, replacement: "listar", priority: 90, description: "lista→listar" },
  { pattern: /^mostr[áa]\b/i, replacement: "mostrar", priority: 90, description: "mostra→mostrar" },

  // ─── "Dame/Pasame/Decime/Contame/Listame/Quiero/Necesito" + entidad → consulta ───
  { pattern: /^(?:dame|pasame|mostrame|decime|contame|listame|quiero|necesito|puedes darme)\s+(las\s+)?(ganancias?|utilidades?|beneficios?)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:ganancias?|utilidades?|beneficios?)\b(.*)$/i)?.[1] || "").trim();
      if (/\b(obra|proyecto|OB)/i.test(r)) return `margen por obra ${r}`;
      return `ganancias${r ? ` ${r}` : ""}`;
    }, priority: 80, description: "dame/pasame ganancias" },

  { pattern: /^(?:dame|pasame|mostrame|decime|contame|listame|quiero|necesito)\s+(los\s+)?(gastos?|egresos?)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:gastos?|egresos?)\b(.*)$/i)?.[1] || "").trim();
      return `gastos${r ? ` ${r}` : ""}`;
    }, priority: 80, description: "dame/pasame gastos" },

  { pattern: /^(?:dame|pasame|mostrame|decime|contame|listame|quiero|necesito)\s+(los\s+)?(ingresos?|ventas?)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:ingresos?|ventas?)\b(.*)$/i)?.[1] || "").trim();
      return `ingresos${r ? ` ${r}` : ""}`;
    }, priority: 80, description: "dame/pasame ingresos" },

  { pattern: /^(?:dame|pasame|mostrame|decime|contame|listame|quiero|necesito)\s+(el\s+)?(stock|inventario|deposito|depósito)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:stock|inventario|deposito|depósito)\b(.*)$/i)?.[1] || "").trim();
      return `stock${r ? ` ${r}` : ""}`;
    }, priority: 80, description: "dame/pasame stock" },

  { pattern: /^(?:dame|pasame|mostrame|decime|contame|listame|quiero|necesito)\s+(las\s+)?(obras?|proyectos?)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:obras?|proyectos?)\b(.*)$/i)?.[1] || "").trim();
      if (r && /(OB|detalle|estado)/i.test(r)) return `detalle de obra ${r}`;
      return "estado de las obras";
    }, priority: 80, description: "dame/pasame obras" },

  { pattern: /^(?:dame|pasame|mostrame|decime|contame|listame|quiero|necesito)\s+(los\s+)?(proveedores?)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:proveedores?)\b(.*)$/i)?.[1] || "").trim();
      return `proveedores${r ? ` ${r}` : ""}`;
    }, priority: 80, description: "dame/pasame proveedores" },

  { pattern: /^(?:dame|pasame|mostrame|decime|contame|listame|quiero|necesito)\s+(las\s+)?(tareas?|pendientes?)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:tareas?|pendientes?)\b(.*)$/i)?.[1] || "").trim();
      if (/(atrasadas?|vencidas?)/i.test(r)) return "tareas atrasadas";
      return `tareas${r ? ` ${r}` : ""}`;
    }, priority: 80, description: "dame/pasame tareas" },

  { pattern: /^(?:dame|pasame|mostrame|decime|contame|listame|quiero|necesito)\s+(las\s+)?(alertas?|novedades?)\b(.*)$/i,
    replacement: "alertas", priority: 80, description: "dame/pasame alertas" },

  { pattern: /^(?:dame|pasame|mostrame|decime|contame|listame|quiero|necesito)\s+(el\s+)?(detalle|resumen|informe|reporte|panorama|situacion|situación)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:detalle|resumen|informe|reporte|panorama|situacion|situación)\b(.*)$/i)?.[1] || "").trim();
      if (/(obra|proyecto|OB)/i.test(r)) return `detalle de obra${r}`;
      return `resumen${r ? ` ${r}` : ""}`;
    }, priority: 80, description: "dame/pasame detalle/resumen" },

  // ─── "Dame/Pasame" + entidad + preposición + obra ───
  { pattern: /^(?:dame|pasame|mostrame|decime)\s+(el\s+)?(detalle|estado|info)\s+(de|sobre)\s+(la\s+)?(obra|proyecto)\s+(.+)$/i,
    replacement: (m: RegExpMatchArray) => `detalle de obra ${m[6] || ""}`,
    priority: 82, description: "dame detalle de obra X" },

  // ─── "Ver/Mirá" + entidad ───
  { pattern: /^(?:ver|veo|mira|mirá)\s+(los\s+)?(gastos?|egresos?)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:gastos?|egresos?)\b(.*)$/i)?.[1] || "").trim();
      return `gastos${r ? ` ${r}` : ""}`;
    }, priority: 75, description: "ver gastos" },

  { pattern: /^(?:ver|veo|mira|mirá)\s+(las\s+)?(ganancias?|utilidades?)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:ganancias?|utilidades?)\b(.*)$/i)?.[1] || "").trim();
      return `ganancias${r ? ` ${r}` : ""}`;
    }, priority: 75, description: "ver ganancias" },

  { pattern: /^(?:ver|veo|mira|mirá)\s+(el\s+)?(stock|inventario)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:stock|inventario)\b(.*)$/i)?.[1] || "").trim();
      return `stock${r ? ` ${r}` : ""}`;
    }, priority: 75, description: "ver stock" },

  { pattern: /^(?:ver|veo|mira|mirá)\s+(las\s+)?(obras?|proyectos?)\b(.*)$/i,
    replacement: "estado de las obras", priority: 75, description: "ver obras" },

  { pattern: /^(?:ver|veo|mira|mirá)\s+(los\s+)?(proveedores?)\b(.*)$/i,
    replacement: "proveedores", priority: 75, description: "ver proveedores" },

  { pattern: /^(?:ver|veo|mira|mirá)\s+(las\s+)?(tareas?)\b(.*)$/i,
    replacement: "tareas pendientes", priority: 75, description: "ver tareas" },

  { pattern: /^(?:ver|veo|mira|mirá)\s+(las\s+)?(alertas?|novedades?)\b(.*)$/i,
    replacement: "alertas", priority: 75, description: "ver alertas" },

  { pattern: /^(?:ver|veo|mira|mirá)\s+(el\s+)?(detalle|resumen)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:detalle|resumen)\b(.*)$/i)?.[1] || "").trim();
      if (/(obra|proyecto|OB)/i.test(r)) return `detalle de obra${r}`;
      return `resumen${r ? ` ${r}` : ""}`;
    }, priority: 75, description: "ver detalle/resumen" },

  // ─── "Controlá/Revisá/Verificá" + entidad ───
  { pattern: /^control[áa]\s+(el\s+)?(stock|inventario)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:stock|inventario)\b(.*)$/i)?.[1] || "").trim();
      return `stock${r ? ` ${r}` : ""}`;
    }, priority: 75, description: "controla stock" },

  { pattern: /^revis[áa]\s+(el\s+)?(stock|inventario)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:stock|inventario)\b(.*)$/i)?.[1] || "").trim();
      return `stock${r ? ` ${r}` : ""}`;
    }, priority: 75, description: "revisa stock" },

  { pattern: /^control[áa]\s+(las\s+)?(obras?|proyectos?)\b(.*)$/i,
    replacement: "estado de las obras", priority: 75, description: "controla obras" },

  // ─── "Quiero/Necesito" + acción ───
  { pattern: /^quiero\s+(?:registrar|cargar|crear|hacer)\s+(un\s+)?(gasto)\b(.*)$/i,
    replacement: "registrar gasto$3", priority: 75, description: "quiero registrar gasto" },

  { pattern: /^quiero\s+(?:registrar|cargar|crear|hacer)\s+(un\s+)?(?:ingreso|venta|cobro)\b(.*)$/i,
    replacement: "registrar ingreso$3", priority: 75, description: "quiero registrar ingreso" },

  { pattern: /^quiero\s+(?:saber\s+)?(?:como|como)\s+(vamos|estamos|va)\b(.*)$/i,
    replacement: "como vamos$3", priority: 75, description: "quiero saber como vamos" },

  { pattern: /^necesito\s+(?:comprar|pedir|reponer)\b(.*)$/i,
    replacement: "generar pedido de compra", priority: 75, description: "necesito comprar" },

  { pattern: /^necesito\s+(?:saber\s+)?(?:que\s+)?(?:materiales?\s+)?(faltan?|hay|tengo)\b(.*)$/i,
    replacement: "stock bajo", priority: 75, description: "necesito saber faltantes" },

  // ─── "Cómo vamos de X" ───
  { pattern: /como\s+(?:vamos|estamos|va)\s+(?:de|en|con)\s+(las\s+)?(obras?|proyectos?)\b(.*)$/i,
    replacement: "estado de las obras$4", priority: 70, description: "como vamos de obras" },

  { pattern: /como\s+(?:vamos|estamos|va)\s+(?:de|en|con)\s+(los\s+)?(materiales?|el\s+stock)\b(.*)$/i,
    replacement: "stock$3", priority: 70, description: "como vamos de stock" },

  { pattern: /como\s+(?:vamos|estamos|va)\s+(?:de|en|con)\s+(las\s+)?(finanzas?|plata|presupuesto)\b(.*)$/i,
    replacement: "como vamos$3", priority: 70, description: "como vamos de finanzas" },

  { pattern: /como\s+(?:vamos|estamos|va)\s+(?:de|en|con)\s+(las\s+)?(ganancias?)\b(.*)$/i,
    replacement: "ganancias$3", priority: 70, description: "como vamos de ganancias" },

  // ─── "Qué hay/tenés" + entidad ───
  { pattern: /que\s+(?:hay|tenes|tenés)\s+(?:en\s+)?(?:el\s+)?(?:stock|inventario|deposito|depósito)\b(.*)$/i,
    replacement: "stock$4", priority: 70, description: "que hay en stock" },

  { pattern: /que\s+(?:hay|tenes|tenés)\s+(?:de\s+)?(obras?|proyectos?)\b(.*)$/i,
    replacement: (_m: RegExpMatchArray, t: string) => {
      const r = (t.match(/(?:obras?|proyectos?)\b(.*)$/i)?.[1] || "").trim();
      if (r && /(OB|detalle)/i.test(r)) return `detalle de obra${r}`;
      return "estado de las obras";
    }, priority: 70, description: "que hay de obras" },

  // ─── "Qué falta" ───
  { pattern: /que\s+(falta|necesito|hace falta|preciso)\s+(?:comprar|reponer|pedir)?\b(.*)$/i,
    replacement: "stock bajo", priority: 70, description: "que falta" },

  // ─── "Cuánto gané/gasté/ingresé" ───
  { pattern: /cuanto\s+(gane|gané|ganamos|estoy ganando)\b(.*)$/i,
    replacement: "ganancias$2", priority: 70, description: "cuanto gane" },

  { pattern: /cuanto\s+(gaste|gasté|gastamos|estoy gastando)\b(.*)$/i,
    replacement: "gastos$2", priority: 70, description: "cuanto gaste" },

  { pattern: /cuanto\s+(ingrese|ingresé|ingresamos|cobre|cobré|cobramos|vendi|vendí)\b(.*)$/i,
    replacement: "ingresos$2", priority: 70, description: "cuanto ingrese" },

  { pattern: /cual\s+es\s+(mi|nuestra)\s+(ganancia|utilidad|beneficio)\b(.*)$/i,
    replacement: "ganancias$4", priority: 70, description: "cual es mi ganancia" },

  { pattern: /cual\s+es\s+(mi|nuestro)\s+(gasto|egreso)\b(.*)$/i,
    replacement: "gastos$4", priority: 70, description: "cual es mi gasto" },

  // ─── "Estoy/Estamos en positivo/rojo" ───
  { pattern: /estoy\s+(?:en\s+)?(positivo|negativo|rojo|azul|numeros|números)\b(.*)$/i,
    replacement: "como vamos", priority: 70, description: "estoy en positivo" },
  { pattern: /estamos\s+(ganando|perdiendo|en rojo|en azul)\b(.*)$/i,
    replacement: "ganancias$2", priority: 70, description: "estamos ganando" },

  // ─── "Rentabilidad/Margen" ───
  { pattern: /(?:rendimiento|reditos|réditos|rentabilidad)\s+(?:de|por)\s+(las\s+)?(obras?|proyectos?)\b(.*)$/i,
    replacement: "margen por obra", priority: 70, description: "rendimiento obras" },

  { pattern: /que\s+(obra|proyecto)\s+(?:es\s+)?(?:mas|más)\s+(rentable|redituable|gana\s+mas|gana\s+más)\b(.*)$/i,
    replacement: "margen por obra", priority: 70, description: "obra mas rentable" },

  // ─── "Mejor/Peor proveedor" ───
  { pattern: /(?:cual|quién|quien)\s+(?:es\s+)?(?:el|la)\s+(mejor|peor)\s+(proveedor|vendedor)\b(.*)$/i,
    replacement: "mejor proveedor", priority: 70, description: "mejor proveedor" },

  { pattern: /(?:donde|dónde|con quien|con quién)\s+compro\s+(?:mas|más\s+)?(barato|economico|económico)\b(.*)$/i,
    replacement: "mejor proveedor", priority: 70, description: "donde comprar mas barato" },

  // ─── Crear obra con nombre y presupuesto ───
  { pattern: /crear\s+(?:una\s+)?(?:obra|proyecto)\s+(?:nueva?\s+)?(?:llamada?\s+|con\s+el\s+nombre\s+)?["']?(.+?)["']?(?:\s*,?\s*con\s+presupuesto\s+(?:de\s+)?\$?\s*([\d.,]+))?(?:\s*,?\s*(?:cliente|para)\s+(.+))?$/i,
    replacement: (m: RegExpMatchArray) => {
      let result = `crear obra "${(m[1] || "").trim()}"`;
      if (m[2]) result += `, presupuesto $${m[2].replace(/[.,]/g, "")}`;
      if (m[3]) result += `, cliente ${(m[3] || "").trim()}`;
      return result;
    }, priority: 68, description: "crear obra con nombre" },

  // ─── Asignar/Añadir materiales a obra ───
  { pattern: /(?:asignar|poner|meter|mandar|agregar|añadir|incorporar)\s+(.+?)\s+(?:a|en|para|a la|en la|para la)\s+(?:obra|proyecto)\s+["']?(.+?)["']?(?:\s*$|[\.;,])/i,
    replacement: (m: RegExpMatchArray) => {
      return `en la obra ${(m[2] || "").trim()}, crea materiales: ${(m[1] || "").trim()}`;
    }, priority: 68, description: "asignar materiales a obra" },

  // ─── Consumir/Usar materiales de obra ───
  { pattern: /(?:consumir|usar|gastar|sacar|retirar)\s+(.+?)\s+(?:de|en)\s+(?:la\s+)?(?:obra|proyecto)\s+["']?(.+?)["']?(?:\s*$|[\.;,])/i,
    replacement: (m: RegExpMatchArray) => {
      return `salida de ${(m[1] || "").trim()} de la obra ${(m[2] || "").trim()}`;
    }, priority: 68, description: "consumir materiales de obra" },

  // ─── "Cuándo termina obra X" ───
  { pattern: /cuando\s+(termina|finaliza|se termina)\s+(la\s+)?(?:obra|proyecto)\s+["']?(.+?)["']?(?:\s*$|[\.\?])/i,
    replacement: (m: RegExpMatchArray) => `cuando termina la obra ${(m[3] || "").trim()}`,
    priority: 68, description: "cuando termina obra" },

  // ─── Actualizar avance ───
  { pattern: /(?:actualizar|poner|cambiar)\s+(?:el\s+)?(?:avance|progreso)\s+(?:de\s+)?(?:la\s+)?(?:obra|proyecto)\s+["']?(.+?)["']?\s+(?:a|al)\s+(\d+)\s*(?:%|por\s+ciento)?/i,
    replacement: (m: RegExpMatchArray) => `actualizar avance de ${(m[1] || "").trim()} al ${m[2] || "0"}%`,
    priority: 68, description: "actualizar avance" },

  // ─── Cambiar estado de obra ───
  { pattern: /(?:cambiar|poner|actualizar)\s+(?:el\s+)?(?:estado)\s+(?:de\s+)?(?:la\s+)?(?:obra|proyecto)\s+["']?(.+?)["']?\s+(?:a|como)\s+(activa?|pausada?|terminada?|finalizada?|en planificacion|en planificación)/i,
    replacement: (m: RegExpMatchArray) => `poner obra ${(m[1] || "").trim()} como ${m[2] || "activa"}`,
    priority: 68, description: "cambiar estado obra" },

  // ─── "Registrar compra de X para obra Y" ───
  { pattern: /(?:registrar|cargar|comprar|ingresar)\s+(.+?)\s+(?:para|en|de)\s+(?:la\s+)?(?:obra|proyecto)\s+["']?(.+?)["']?(?:\s*$|[\.;,])/i,
    replacement: (m: RegExpMatchArray) => {
      return `en la obra ${(m[2] || "").trim()}, crea materiales: ${(m[1] || "").trim()}`;
    }, priority: 67, description: "registrar compra para obra" },

  // ─── "Cerrar obra X" ───
  { pattern: /(?:cerrar|finalizar|terminar)\s+(?:la\s+)?(?:obra|proyecto)\s+["']?(.+?)["']?(?:\s*$|[\.;,])/i,
    replacement: (m: RegExpMatchArray) => `cerrar obra ${(m[1] || "").trim()}`,
    priority: 68, description: "cerrar obra con nombre" },
];

// ─── Normalizador principal ───

export function normalizeMessage(message: string): NormalizationResult {
  let normalized = message.trim();
  let wasNormalized = false;
  let confidence = 1.0;

  if (!normalized) {
    return { normalized: "", wasNormalized: false, extraEntities: {}, confidence: 0 };
  }

  const sortedRules = [...NORMALIZATION_RULES].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (typeof rule.replacement === "function") {
      const fn = rule.replacement as ReplacementFn;
      const oldText = normalized;
      normalized = normalized.replace(rule.pattern, (...args: any[]) => {
        const match = args[0] as RegExpMatchArray;
        // String.replace callback: (match, ...captures, offset, string)
        const fullText = args[args.length - 1] as string || oldText;
        return fn(match, fullText);
      });
      if (normalized !== oldText) {
        wasNormalized = true;
        confidence = Math.min(confidence, 0.85);
      }
    } else {
      const oldText = normalized;
      normalized = normalized.replace(rule.pattern, rule.replacement as string);
      if (normalized !== oldText) {
        wasNormalized = true;
        confidence = Math.min(confidence, 0.85);
      }
    }
  }

  normalized = normalized.replace(/\s+/g, " ").trim();

  return {
    normalized,
    wasNormalized,
    extraEntities: {},
    confidence,
  };
}
