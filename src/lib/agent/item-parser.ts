export interface ParsedItem {
  qty: number;
  unit: string;
  name: string;
  rawText: string;
}

export function parseItemList(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const segments = text.split(/,\s*|\s+y\s+|\s+e\s+/i);
  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(\d+(?:[.,]\d+)?)\s*([a-záéíóúüñ]+)?\s+(?:de\s+)?(.+)$/i);
    if (m) {
      items.push({
        qty: parseFloat(m[1].replace(',', '.')),
        unit: m[2] || 'unidad',
        name: m[3].trim(),
        rawText: trimmed,
      });
    } else {
      const m2 = trimmed.match(/^(.+)$/);
      if (m2) items.push({ qty: 1, unit: 'unidad', name: m2[1].trim(), rawText: trimmed });
    }
  }
  return items;
}
