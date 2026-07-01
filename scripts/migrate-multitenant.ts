// ============================================================
// MIGRACIÓN MULTI-TENANT
// ============================================================
// Script único: crea una organización por defecto, un usuario
// admin (desde ADMIN_USER/ADMIN_PASSWORD) y migra todos los
// datos existentes a esa organización.
//
// Uso: npx tsx scripts/migrate-multitenant.ts
// ============================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function migrate() {
  console.log("🔧 Migración multi-tenant — ObraCero\n");

  // ─── 1. Verificar si ya hay organizaciones ───
  const existingOrgs = await db.organization.count();
  if (existingOrgs > 0) {
    console.log("✅ Ya existen organizaciones. Saltando migración inicial.\n");
    await printSummary();
    return;
  }

  console.log("📦 Creando organización por defecto...");

  const org = await db.organization.create({
    data: {
      name: "Mi Empresa",
      slug: "mi-empresa",
      plan: "free",
    },
  });
  console.log(`   ✅ Organización creada: ${org.name} (${org.slug})`);

  // ─── 2. Crear usuario admin desde env o default ───
  const adminUser = process.env.ADMIN_USER || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Verificar si ya existe un usuario con ese email
  const adminEmail = `${adminUser}@obracero.local`;
  let user = await db.user.findUnique({ where: { email: adminEmail } });

  if (!user) {
    user = await db.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: adminUser,
      },
    });
  }
  console.log(`   ✅ Usuario admin: ${user.email}`);

  // ─── 3. Crear membresía ───
  const existingMember = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
  });

  if (!existingMember) {
    await db.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "admin",
      },
    });
  }
  console.log("   ✅ Membresía admin creada");

  // ─── 4. Migrar datos existentes a la organización ───
  console.log("\n📦 Migrando datos existentes...");

  const tables = [
    { name: "Project", count: 0 },
    { name: "Transaction", count: 0 },
    { name: "Task", count: 0 },
    { name: "Supplier", count: 0 },
    { name: "Material", count: 0 },
    { name: "StockMovement", count: 0 },
    { name: "AutomationRule", count: 0 },
    { name: "Workflow", count: 0 },
    { name: "AgentSchedule", count: 0 },
    { name: "AgentAction", count: 0 },
    { name: "AgentMessage", count: 0 },
  ];

  for (const table of tables) {
    try {
      // Usamos raw query para actualizar en masa
      const result = await db.$executeRawUnsafe(
        `UPDATE "${table.name}" SET "organizationId" = $1 WHERE "organizationId" IS NULL OR "organizationId" = ''`,
        org.id
      );
      table.count = result;
      if (result > 0) {
        console.log(`   ✅ ${table.name}: ${result} registros migrados`);
      }
    } catch (e: any) {
      // Si la columna no existe (esquema no actualizado), ignorar
      if (e.message?.includes("column") && e.message?.includes("does not exist")) {
        console.log(`   ⏭️  ${table.name}: pendiente (schema no actualizado)`);
      } else {
        console.log(`   ⚠️  ${table.name}: error (${e.message})`);
      }
    }
  }

  console.log("\n✅ Migración completada exitosamente.\n");
  await printSummary();
}

async function printSummary() {
  const orgCount = await db.organization.count();
  const userCount = await db.user.count();
  const memberCount = await db.organizationMember.count();

  const projectCount = await db.project.count();
  const transactionCount = await db.transaction.count();
  const taskCount = await db.task.count();
  const supplierCount = await db.supplier.count();
  const materialCount = await db.material.count();

  console.log("📊 Resumen:");
  console.log(`   Organizaciones: ${orgCount}`);
  console.log(`   Usuarios: ${userCount}`);
  console.log(`   Membresías: ${memberCount}`);
  console.log(`   Proyectos: ${projectCount}`);
  console.log(`   Transacciones: ${transactionCount}`);
  console.log(`   Tareas: ${taskCount}`);
  console.log(`   Proveedores: ${supplierCount}`);
  console.log(`   Materiales: ${materialCount}`);

  if (orgCount === 0) {
    console.log("\n⚠️  Ejecutá de nuevo este script después de hacer `npx prisma db push`");
  }
}

migrate()
  .catch((e) => {
    console.error("❌ Migración fallida:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
