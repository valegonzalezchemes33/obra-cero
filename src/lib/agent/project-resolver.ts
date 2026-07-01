import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalize } from "@/lib/agent/normalize";

type ProjectWithRelations = Prisma.ProjectGetPayload<{ include: { transactions: true; tasks: true } }>;

export async function resolveProject(ref?: string): Promise<ProjectWithRelations | null> {
  if (!ref) return null;
  const norm = normalize(ref);
  if (/^\d+$/.test(norm)) {
    const padded = norm.padStart(3, "0");
    return await db.project.findFirst({ where: { OR: [{ code: `OB-${padded}` }, { code: { contains: norm } }] }, include: { transactions: true, tasks: true } });
  }
  if (/^ob[-\s]?\d+$/i.test(norm)) {
    return await db.project.findFirst({ where: { code: { contains: norm.replace(/\s/, '-').toUpperCase() } }, include: { transactions: true, tasks: true } });
  }
  // Fuzzy name matching: first load only lightweight data to find the match
  const candidates = await db.project.findMany({ select: { id: true, name: true, code: true, status: true } });
  let found = candidates.find(p => normalize(p.name) === norm);
  if (found) return await db.project.findFirst({ where: { id: found.id }, include: { transactions: true, tasks: true } });
  found = candidates.find(p => normalize(p.name).includes(norm) || norm.includes(normalize(p.name)));
  if (found) return await db.project.findFirst({ where: { id: found.id }, include: { transactions: true, tasks: true } });
  const words = norm.split(' ').filter(w => w.length > 2);
  if (words.length > 0) {
    let bestId: string | null = null;
    let bestScore = 0;
    for (const p of candidates) {
      const pn = normalize(p.name);
      const score = words.filter(w => pn.includes(w)).length;
      if (score > bestScore) { bestScore = score; bestId = p.id; }
    }
    if (bestScore > 0) return await db.project.findFirst({ where: { id: bestId! }, include: { transactions: true, tasks: true } });
  }
  return null;
}
