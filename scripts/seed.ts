// Script de seed con datos realistas de una constructora/inmobiliaria
import { db } from "../src/lib/db";

async function main() {
  console.log("🌱 Sembrando datos de demostración...");

  // Limpiar
  await db.stockMovement.deleteMany();
  await db.transaction.deleteMany();
  await db.task.deleteMany();
  await db.material.deleteMany();
  await db.supplier.deleteMany();
  await db.project.deleteMany();
  await db.agentMessage.deleteMany();
  await db.agentAction.deleteMany();
  await db.automationRule.deleteMany();

  // ---------- PROVEEDORES ----------
  const suppliers = await Promise.all([
    db.supplier.create({
      data: {
        name: "Cementos Avellaneda SA",
        contact: "Jorge Martínez",
        phone: "+54 11 4456-7890",
        email: "ventas@cementosavellaneda.com.ar",
        taxId: "30-12345678-9",
        category: "materiales",
        rating: 4.5,
        notes: "Entrega en 48hs, descuento por volumen",
      },
    }),
    db.supplier.create({
      data: {
        name: "Hierros del Centro",
        contact: "Marta González",
        phone: "+54 11 4321-5678",
        email: "info@hierroscentro.com.ar",
        taxId: "30-87654321-0",
        category: "materiales",
        rating: 4.0,
        notes: "Buena calidad de acero, precios competitivos",
      },
    }),
    db.supplier.create({
      data: {
        name: "Electricidad Moderna",
        contact: "Carlos Pereyra",
        phone: "+54 11 4899-2211",
        email: "ventas@electricidadmoderna.com.ar",
        taxId: "30-11223344-5",
        category: "materiales",
        rating: 4.2,
      },
    }),
    db.supplier.create({
      data: {
        name: "Maderera Don Bosco",
        contact: "Roberto Silva",
        phone: "+54 11 4567-1100",
        email: "ventas@madereradonbosco.com.ar",
        taxId: "30-55667788-1",
        category: "materiales",
        rating: 4.7,
      },
    }),
    db.supplier.create({
      data: {
        name: "Construcciones MG (Mano de obra)",
        contact: "Miguel Ángel Torres",
        phone: "+54 11 4222-3344",
        email: "mgconstrucciones@gmail.com",
        taxId: "20-33445566-7",
        category: "mano_obra",
        rating: 4.3,
      },
    }),
    db.supplier.create({
      data: {
        name: "Transportes Rápido SA",
        contact: "Luis Fernández",
        phone: "+54 11 4000-5555",
        category: "servicios",
        rating: 3.8,
      },
    }),
  ]);

  // ---------- PROYECTOS / OBRAS ----------
  const projects = await Promise.all([
    db.project.create({
      data: {
        code: "OB-001",
        name: "Edificio Torres del Sol",
        description: "Torre de 12 departamentos en zona norte",
        address: "Av. Libertador 4521, CABA",
        status: "in_progress",
        type: "obra",
        budget: 850000000,
        clientName: "Grupo Inversor Patagonia",
        clientPhone: "+54 11 5555-1010",
        clientEmail: "proyectos@patagonia.com.ar",
        startDate: new Date("2025-09-15"),
        endDate: new Date("2026-12-30"),
        progress: 65,
      },
    }),
    db.project.create({
      data: {
        code: "OB-002",
        name: "Barrio Los Alamos - Etapa 2",
        description: "20 viviendas individuales",
        address: "Ruta 8 km 45, Pilar",
        status: "in_progress",
        type: "loteo",
        budget: 420000000,
        clientName: "Familia Castro",
        clientPhone: "+54 11 4444-2020",
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-10-15"),
        progress: 35,
      },
    }),
    db.project.create({
      data: {
        code: "OB-003",
        name: "Remodelación Oficinas TechHub",
        description: "Refacción integral oficinas corporativas",
        address: "Av. Corrientes 1200, CABA",
        status: "in_progress",
        type: "remodelacion",
        budget: 95000000,
        clientName: "TechHub SA",
        clientPhone: "+54 11 4333-3030",
        clientEmail: "facilities@techhub.com",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-07-30"),
        progress: 80,
      },
    }),
    db.project.create({
      data: {
        code: "OB-004",
        name: "Local Comercial Av. Maipú",
        description: "Construcción de local comercial 200m2",
        address: "Av. Maipú 2200, Vicente López",
        status: "planning",
        type: "obra",
        budget: 65000000,
        clientName: "Inversiones Belgrano",
        startDate: new Date("2026-08-01"),
        progress: 5,
      },
    }),
  ]);

  // ---------- MATERIALES ----------
  const materials = await Promise.all([
    db.material.create({
      data: {
        sku: "CEM-50",
        name: "Cemento Portland 50kg",
        category: "cemento",
        unit: "bolsa",
        unitCost: 12500,
        stock: 320,
        minStock: 80,
        maxStock: 500,
        location: "Depósito A - Estante 1",
        supplierId: suppliers[0].id,
      },
    }),
    db.material.create({
      data: {
        sku: "HIE-8",
        name: "Hierro 8mm x 12m",
        category: "hierro",
        unit: "unidad",
        unitCost: 18900,
        stock: 45,
        minStock: 60,
        location: "Depósito A - Estante 4",
        supplierId: suppliers[1].id,
      },
    }),
    db.material.create({
      data: {
        sku: "HIE-10",
        name: "Hierro 10mm x 12m",
        category: "hierro",
        unit: "unidad",
        unitCost: 28500,
        stock: 12,
        minStock: 40,
        location: "Depósito A - Estante 5",
        supplierId: suppliers[1].id,
      },
    }),
    db.material.create({
      data: {
        sku: "LAD-COM",
        name: "Ladrillo común 18x25",
        category: "mamposteria",
        unit: "unidad",
        unitCost: 320,
        stock: 8500,
        minStock: 2000,
        location: "Patio exterior",
      },
    }),
    db.material.create({
      data: {
        sku: "ARE-LIM",
        name: "Arena limpia m3",
        category: "aglomerante",
        unit: "m3",
        unitCost: 45000,
        stock: 0,
        minStock: 15,
        location: "Patio exterior",
      },
    }),
    db.material.create({
      data: {
        sku: "PED-LIM",
        name: "Piedra partida m3",
        category: "aglomerante",
        unit: "m3",
        unitCost: 52000,
        stock: 8,
        minStock: 12,
        location: "Patio exterior",
      },
    }),
    db.material.create({
      data: {
        sku: "CBL-2.5",
        name: "Cable 2.5mm (rollo 100m)",
        category: "electrico",
        unit: "rollo",
        unitCost: 85000,
        stock: 18,
        minStock: 5,
        location: "Depósito B - Estante 2",
        supplierId: suppliers[2].id,
      },
    }),
    db.material.create({
      data: {
        sku: "TOM-COR",
        name: "Tomacorriente bicivo",
        category: "electrico",
        unit: "unidad",
        unitCost: 4800,
        stock: 120,
        minStock: 50,
        location: "Depósito B - Estante 3",
        supplierId: suppliers[2].id,
      },
    }),
    db.material.create({
      data: {
        sku: "TUB-PVC",
        name: 'Tubo PVC 4" x 6m',
        category: "plomeria",
        unit: "unidad",
        unitCost: 12500,
        stock: 0,
        minStock: 20,
        location: "Depósito B - Estante 5",
      },
    }),
    db.material.create({
      data: {
        sku: "MAD-PIN",
        name: "Madera Pino 2x4 x 3m",
        category: "madera",
        unit: "unidad",
        unitCost: 8500,
        stock: 75,
        minStock: 30,
        location: "Galpón C",
        supplierId: suppliers[3].id,
      },
    }),
    db.material.create({
      data: {
        sku: "PIS-CER",
        name: "Cerámico 60x60",
        category: "terminaciones",
        unit: "m2",
        unitCost: 18500,
        stock: 220,
        minStock: 100,
        location: "Depósito A - Estante 8",
      },
    }),
    db.material.create({
      data: {
        sku: "PIN-LTX",
        name: "Pintura látex blanca 20L",
        category: "terminaciones",
        unit: "lata",
        unitCost: 42000,
        stock: 35,
        minStock: 15,
        location: "Depósito B - Estante 1",
      },
    }),
  ]);

  // ---------- TRANSACCIONES ----------
  const now = new Date();
  const monthsAgo = (m: number, d = 15) => new Date(now.getFullYear(), now.getMonth() - m, d);

  // Ingresos (anticipos y ventas)
  const incomeData = [
    { amount: 250000000, category: "anticipo", description: "Anticipo OB-001", date: monthsAgo(9), projectId: projects[0].id },
    { amount: 180000000, category: "anticipo", description: "Anticipo OB-002", date: monthsAgo(5), projectId: projects[1].id },
    { amount: 95000000, category: "anticipo", description: "Anticipo OB-003", date: monthsAgo(2), projectId: projects[2].id },
    { amount: 95000000, category: "venta", description: "Cobro etapa OB-001", date: monthsAgo(4), projectId: projects[0].id },
    { amount: 120000000, category: "venta", description: "Cobro etapa OB-001", date: monthsAgo(2), projectId: projects[0].id },
    { amount: 75000000, category: "venta", description: "Cobro etapa OB-002", date: monthsAgo(2), projectId: projects[1].id },
    { amount: 45000000, category: "venta", description: "Cobro OB-003 hito 1", date: monthsAgo(1), projectId: projects[2].id },
    { amount: 30000000, category: "venta", description: "Cobro OB-003 hito 2", date: monthsAgo(0), projectId: projects[2].id },
    { amount: 60000000, category: "venta", description: "Cobro OB-002 viviendas", date: monthsAgo(0), projectId: projects[1].id },
  ];

  for (const t of incomeData) {
    await db.transaction.create({ data: { type: "income", ...t } });
  }

  // Gastos
  const expenseData = [
    { amount: 45000000, category: "materiales", description: "Cemento y hierros", date: monthsAgo(9), projectId: projects[0].id, supplierId: suppliers[0].id },
    { amount: 38000000, category: "materiales", description: "Ladrillos y áridos", date: monthsAgo(8), projectId: projects[0].id },
    { amount: 95000000, category: "mano_obra", description: "Mano de obra mes 1-2", date: monthsAgo(7), projectId: projects[0].id, supplierId: suppliers[4].id },
    { amount: 28000000, category: "materiales", description: "Electricidad y plomería", date: monthsAgo(6), projectId: projects[0].id, supplierId: suppliers[2].id },
    { amount: 65000000, category: "mano_obra", description: "Mano de obra mes 3-4", date: monthsAgo(5), projectId: projects[0].id, supplierId: suppliers[4].id },
    { amount: 35000000, category: "materiales", description: "Cerámicos y pintura", date: monthsAgo(4), projectId: projects[0].id },
    { amount: 55000000, category: "mano_obra", description: "Mano de obra mes 5-6", date: monthsAgo(3), projectId: projects[0].id, supplierId: suppliers[4].id },
    { amount: 22000000, category: "servicios", description: "Transporte y acarreo", date: monthsAgo(3), projectId: projects[0].id, supplierId: suppliers[5].id },
    { amount: 45000000, category: "mano_obra", description: "Mano de obra mes 7", date: monthsAgo(2), projectId: projects[0].id, supplierId: suppliers[4].id },
    { amount: 28000000, category: "materiales", description: "Terminaciones", date: monthsAgo(1), projectId: projects[0].id },
    { amount: 42000000, category: "mano_obra", description: "Mano de obra mes 8", date: monthsAgo(1), projectId: projects[0].id, supplierId: suppliers[4].id },
    { amount: 18000000, category: "equipos", description: "Alquiler grúa", date: monthsAgo(0), projectId: projects[0].id },
    { amount: 22000000, category: "materiales", description: "Materiales inicial", date: monthsAgo(5), projectId: projects[1].id },
    { amount: 55000000, category: "mano_obra", description: "Mano de obra inicial", date: monthsAgo(4), projectId: projects[1].id, supplierId: suppliers[4].id },
    { amount: 32000000, category: "materiales", description: "Materiales etapa 2", date: monthsAgo(3), projectId: projects[1].id },
    { amount: 48000000, category: "mano_obra", description: "Mano de obra mes 2", date: monthsAgo(2), projectId: projects[1].id, supplierId: suppliers[4].id },
    { amount: 18000000, category: "servicios", description: "Transporte", date: monthsAgo(1), projectId: projects[1].id, supplierId: suppliers[5].id },
    { amount: 25000000, category: "materiales", description: "Materiales viviendas", date: monthsAgo(0), projectId: projects[1].id },
    { amount: 18000000, category: "materiales", description: "Demolición y materiales", date: monthsAgo(2), projectId: projects[2].id },
    { amount: 25000000, category: "mano_obra", description: "Mano de obra remodelación", date: monthsAgo(2), projectId: projects[2].id, supplierId: suppliers[4].id },
    { amount: 12000000, category: "materiales", description: "Pintura y electricidad", date: monthsAgo(1), projectId: projects[2].id },
    { amount: 18000000, category: "mano_obra", description: "Mano de obra mes 2", date: monthsAgo(1), projectId: projects[2].id, supplierId: suppliers[4].id },
    { amount: 8000000, category: "materiales", description: "Terminaciones", date: monthsAgo(0), projectId: projects[2].id },
    { amount: 12000000, category: "mano_obra", description: "Mano de obra mes 3", date: monthsAgo(0), projectId: projects[2].id, supplierId: suppliers[4].id },
    { amount: 8500000, category: "impuestos", description: "Ingresos brutos mes", date: monthsAgo(1) },
    { amount: 12000000, category: "servicios", description: "Alquiler oficina", date: monthsAgo(0), recurring: "mensual" },
    { amount: 4500000, category: "servicios", description: "Internet y servicios", date: monthsAgo(0) },
    { amount: 9800000, category: "equipos", description: "Herramientas reposición", date: monthsAgo(0) },
  ];

  for (const t of expenseData) {
    await db.transaction.create({ data: { type: "expense", ...t } });
  }

  // ---------- STOCK MOVEMENTS ----------
  await db.stockMovement.create({
    data: {
      type: "incoming",
      quantity: 500,
      unitCost: 12000,
      reason: "compra",
      note: "Compra inicial cemento",
      date: monthsAgo(9),
      materialId: materials[0].id,
      supplierId: suppliers[0].id,
    },
  });
  await db.stockMovement.create({
    data: {
      type: "outgoing",
      quantity: 180,
      unitCost: 12500,
      reason: "consumo_obra",
      note: "Uso en OB-001",
      date: monthsAgo(3),
      materialId: materials[0].id,
      supplierId: null,
    },
  });
  await db.stockMovement.create({
    data: {
      type: "outgoing",
      quantity: 100,
      unitCost: 12500,
      reason: "consumo_obra",
      note: "Uso en OB-002",
      date: monthsAgo(1),
      materialId: materials[0].id,
      supplierId: null,
    },
  });

  // ---------- TAREAS ----------
  await db.task.createMany({
    data: [
      {
        title: "Reponer stock de hierro 8mm y 10mm",
        description: "Stock bajo en ambos, generar orden de compra a Hierros del Centro",
        status: "pending",
        priority: "high",
        assignee: "Compras",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        projectId: projects[0].id,
        createdBy: "agent",
      },
      {
        title: "Coordinar entrega de arena limpia",
        description: "Urgente: 0 m3 en stock",
        status: "pending",
        priority: "critical",
        assignee: "Logística",
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        createdBy: "agent",
      },
      {
        title: "Avance eléctrico OB-003",
        description: "Verificar certificación electricista matriculado",
        status: "in_progress",
        priority: "medium",
        assignee: "Jefe de obra",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        projectId: projects[2].id,
      },
      {
        title: "Cerrar presupuesto OB-004",
        description: "Falta confirmar precio de cerámicos",
        status: "in_progress",
        priority: "medium",
        assignee: "Estimaciones",
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        projectId: projects[3].id,
      },
      {
        title: "Cobro OB-001 etapa final",
        description: "Gestionar cobro del 25% pendiente",
        status: "pending",
        priority: "high",
        assignee: "Administración",
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        projectId: projects[0].id,
      },
    ],
  });

  // ---------- REGLAS DE AUTOMATIZACIÓN ----------
  await db.automationRule.createMany({
    data: [
      {
        name: "Alerta de stock bajo",
        description: "Dispara cuando cualquier material cae bajo el punto de pedido",
        trigger: "low_stock",
        action: "alert",
        enabled: true,
      },
      {
        name: "Desvío de presupuesto",
        description: "Alerta cuando una obra supera el 90% del presupuesto sin finalizar",
        trigger: "budget_overrun",
        action: "alert",
        enabled: true,
      },
      {
        name: "Pico de gastos semanal",
        description: "Alerta si los gastos de la semana superan $1.000.000",
        trigger: "expense_spike",
        action: "alert",
        enabled: true,
      },
      {
        name: "Tareas atrasadas",
        description: "Verifica diariamente tareas con vencimiento pasado",
        trigger: "late_task",
        action: "alert",
        enabled: true,
      },
    ],
  });

  console.log("✅ Seed completado!");
  console.log(`   - ${suppliers.length} proveedores`);
  console.log(`   - ${projects.length} obras`);
  console.log(`   - ${materials.length} materiales`);
  console.log(`   - ${incomeData.length} ingresos`);
  console.log(`   - ${expenseData.length} gastos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
