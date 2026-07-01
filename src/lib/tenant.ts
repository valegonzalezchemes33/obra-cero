// ============================================================
// TENANT — Contexto de organización (multi-tenant)
// ============================================================
// Proporciona funciones para obtener la organización activa
// desde la sesión y agregar filtros de tenant a las queries.
//
// Todas las API routes deben usar estos helpers para asegurar
// que cada organización vea solo sus propios datos.
// ============================================================

import { db } from "@/lib/db";
import { getSession } from "@/lib/api-utils";
import { getSessionOrganization } from "@/lib/auth";
import type { Session } from "next-auth";

export interface TenantContext {
  organizationId: string;
  role: string;
  name: string;
}

/**
 * Obtiene el contexto de tenant desde la sesión actual.
 * - Usuarios DB: usa su organización del session token.
 * - Usuarios legacy (ADMIN_USER): busca la primera organización real en la DB,
 *   o crea una si no existe (fresh install sin migración).
 * Lanza error si no hay sesión.
 */
export async function getTenant(): Promise<TenantContext> {
  const session = await getSession();
  const org = getSessionOrganization(session);
  
  if (!org) {
    throw new TenantNotFoundError("No se pudo determinar la organización activa");
  }

  // Resolver placeholder para legacy users: buscar la primera org real en DB
  if (org.organizationId === "__find_first_org__") {
    const firstOrg = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
    if (firstOrg) {
      return {
        organizationId: firstOrg.id,
        role: "admin",
        name: firstOrg.name,
      };
    }
    // No hay organizaciones todavía (fresh install). Usar placeholder sintético.
    return {
      organizationId: "default",
      role: "admin",
      name: "Default",
    };
  }

  return org;
}

/**
 * Igual que getTenant pero en lugar de lanzar error, retorna null.
 */
export async function getTenantSafe(): Promise<TenantContext | null> {
  try {
    return await getTenant();
  } catch {
    return null;
  }
}

/**
 * Verifica que el usuario tenga un rol específico en su organización.
 */
export function requireRole(
  tenant: TenantContext,
  roles: string | string[]
): void {
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (!allowed.includes(tenant.role)) {
    throw new TenantForbiddenError(
      `Se requiere rol ${allowed.join(" o ")} para esta acción`
    );
  }
}

// ─── Helpers para queries scoped por organización ────────────

/**
 * Crea un where genérico para filtrar por organización.
 * Uso: db.project.findMany({ where: orgWhere(tenant) })
 */
export function orgWhere(tenant: TenantContext | null): { organizationId: string } {
  if (!tenant) throw new TenantNotFoundError("Tenant context required");
  return { organizationId: tenant.organizationId };
}

/**
 * Agrega organizationId a un create data.
 * Uso: db.project.create({ data: orgScope(tenant, { name: "..." }) })
 */
export function orgScope<T extends Record<string, any>>(
  tenant: TenantContext | null,
  data: T
): T & { organizationId: string } {
  if (!tenant) throw new TenantNotFoundError("Tenant context required");
  return { ...data, organizationId: tenant.organizationId };
}

/**
 * Para updates donde necesitamos verificar que el recurso pertenece a la org.
 * Uso: db.project.update({ where: { id_organizationId: orgIdClause(tenant, id) } })
 * Nota: requiere @@unique([id, organizationId]) o similar en el schema.
 */
export function orgIdClause(tenant: TenantContext, id: string): { id: string; organizationId: string } {
  return { id, organizationId: tenant.organizationId };
}

// ─── Obtener organización por slug (para login/switch) ───────

export async function getOrganizationBySlug(slug: string) {
  return db.organization.findUnique({ where: { slug } });
}

// ─── Errores ─────────────────────────────────────────────────

export class TenantNotFoundError extends Error {
  constructor(message?: string) {
    super(message || "Organización no encontrada");
    this.name = "TenantNotFoundError";
  }
}

export class TenantForbiddenError extends Error {
  constructor(message?: string) {
    super(message || "No autorizado para esta organización");
    this.name = "TenantForbiddenError";
  }
}
