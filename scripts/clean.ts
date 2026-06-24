// Limpiar todos los datos de demostración. Deja el sistema vacío listo para comercializar.
import { db } from "../src/lib/db";

async function main() {
  console.log("🧹 Limpiando todos los datos...");

  const counts = {
    stockMovements: await db.stockMovement.count(),
    transactions: await db.transaction.count(),
    tasks: await db.task.count(),
    materials: await db.material.count(),
    suppliers: await db.supplier.count(),
    projects: await db.project.count(),
    agentMessages: await db.agentMessage.count(),
    agentActions: await db.agentAction.count(),
    automationRules: await db.automationRule.count(),
  };

  console.log("Datos a eliminar:", counts);

  // Borrar en orden de dependencias
  await db.stockMovement.deleteMany();
  await db.transaction.deleteMany();
  await db.task.deleteMany();
  await db.material.deleteMany();
  await db.agentAction.deleteMany();
  await db.agentMessage.deleteMany();
  await db.supplier.deleteMany();
  await db.project.deleteMany();
  await db.automationRule.deleteMany();

  console.log("✅ Todos los datos fueron eliminados");

  // Crear las reglas de automatización por defecto (esenciales para el sistema)
  console.log("⚙️  Creando reglas de automatización por defecto...");
  await db.automationRule.createMany({
    data: [
      {
        name: "Alerta de stock bajo",
        description: "Avisa cuando un material cae bajo el punto de pedido",
        trigger: "low_stock",
        action: "alert",
        enabled: true,
      },
      {
        name: "Desvío de presupuesto",
        description: "Avisa cuando una obra supera el 90% del presupuesto sin finalizar",
        trigger: "budget_overrun",
        action: "alert",
        enabled: true,
      },
      {
        name: "Pico de gastos semanal",
        description: "Avisa si los gastos de la semana superan $1.000.000",
        trigger: "expense_spike",
        action: "alert",
        enabled: true,
      },
      {
        name: "Tareas atrasadas",
        description: "Avisa sobre tareas con vencimiento pasado",
        trigger: "late_task",
        action: "alert",
        enabled: true,
      },
    ],
  });

  console.log("✅ Reglas de automatización creadas");
  console.log("🚀 Sistema listo para comercializar");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
