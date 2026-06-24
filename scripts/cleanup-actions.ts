// Limpiar acciones duplicadas - dejar solo la más reciente por título
import { db } from "../src/lib/db";

async function main() {
  const actions = await db.agentAction.findMany({
    orderBy: { createdAt: "desc" },
  });
  const seen = new Set<string>();
  let deleted = 0;
  for (const a of actions) {
    if (seen.has(a.title)) {
      await db.agentAction.delete({ where: { id: a.id } });
      deleted++;
    } else {
      seen.add(a.title);
    }
  }
  console.log(`✅ ${deleted} acciones duplicadas eliminadas`);
  const remaining = await db.agentAction.count();
  console.log(`   Quedan ${remaining} acciones`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
