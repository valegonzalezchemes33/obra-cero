// ============================================================
// AUTH SERVICE — Multi-tenant user management
// ============================================================
// Maneja registro, login, invitaciones y membresías de
// organizaciones. Soporta bcrypt para hash de contraseñas.
// ============================================================

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const SALT_ROUNDS = 12;

// ─── Password hashing ─────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── User registration ───────────────────────────────────────

export type RegisterResult = {
  ok: true;
  user: { id: string; email: string; name: string | null };
  organization: { id: string; name: string; slug: string };
  membership: { id: string; role: string };
} | {
  ok: false;
  error: string;
};

/**
 * Registra un nuevo usuario y crea su organización automáticamente.
 * El usuario creado es admin de su organización.
 */
export async function registerUser(
  email: string,
  password: string,
  orgName: string,
  name?: string
): Promise<RegisterResult> {
  // Validar email
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    return { ok: false, error: "Email inválido" };
  }
  if (password.length < 6) {
    return { ok: false, error: "La contraseña debe tener al menos 6 caracteres" };
  }
  if (!orgName.trim()) {
    return { ok: false, error: "El nombre de la organización es requerido" };
  }

  // Verificar email no duplicado
  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return { ok: false, error: "Ya existe un usuario con este email" };
  }

  // Generar slug único para la organización
  const slug = await generateUniqueSlug(orgName);

  const passwordHash = await hashPassword(password);

  // Crear usuario + organización + membresía en transacción
  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: name || null,
      },
    });

    const org = await tx.organization.create({
      data: {
        name: orgName.trim(),
        slug,
        plan: "free",
      },
    });

    const membership = await tx.organizationMember.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        role: "admin",
      },
    });

    return { user, organization: org, membership };
  });

  return {
    ok: true,
    user: { id: result.user.id, email: result.user.email, name: result.user.name },
    organization: { id: result.organization.id, name: result.organization.name, slug: result.organization.slug },
    membership: { id: result.membership.id, role: result.membership.role },
  };
}

// ─── Login ────────────────────────────────────────────────────

export type LoginResult = {
  ok: true;
  user: { id: string; email: string; name: string | null };
  organizations: { id: string; name: string; slug: string; role: string }[];
} | {
  ok: false;
  error: string;
};

/**
 * Autentica un usuario por email + password.
 * Devuelve datos del usuario y lista de organizaciones a las que pertenece.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<LoginResult> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail || !password) {
    return { ok: false, error: "Email y contraseña requeridos" };
  }

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      memberships: {
        include: { organization: true },
      },
    },
  });

  if (!user) {
    return { ok: false, error: "Email o contraseña incorrectos" };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { ok: false, error: "Email o contraseña incorrectos" };
  }

  return {
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
    organizations: user.memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      role: m.role,
    })),
  };
}

// ─── Organization members ─────────────────────────────────────

/**
 * Obtiene los miembros de una organización
 */
export async function getOrganizationMembers(organizationId: string) {
  return db.organizationMember.findMany({
    where: { organizationId },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Agrega un usuario existente a una organización (por email)
 */
export async function addUserToOrganization(
  organizationId: string,
  email: string,
  role: string = "editor"
): Promise<{ ok: true; member: any } | { ok: false; error: string }> {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    return { ok: false, error: "No existe un usuario con ese email" };
  }

  const existing = await db.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } },
  });
  if (existing) {
    return { ok: false, error: "El usuario ya pertenece a esta organización" };
  }

  const member = await db.organizationMember.create({
    data: { organizationId, userId: user.id, role },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return { ok: true, member };
}

/**
 * Cambia el rol de un miembro en la organización
 */
export async function updateMemberRole(
  organizationId: string,
  memberId: string,
  role: string
) {
  return db.organizationMember.update({
    where: { id: memberId, organizationId },
    data: { role },
  });
}

/**
 * Elimina un miembro de la organización
 */
export async function removeMember(organizationId: string, memberId: string) {
  await db.organizationMember.delete({
    where: { id: memberId, organizationId },
  });
}

// ─── Helpers ──────────────────────────────────────────────────

async function generateUniqueSlug(baseName: string): Promise<string> {
  const base = baseName
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

  let slug = base || "org";
  let attempts = 0;

  while (attempts < 20) {
    const existing = await db.organization.findUnique({ where: { slug } });
    if (!existing) return slug;
    attempts++;
    slug = `${base}-${attempts}`;
  }

  // Fallback con timestamp
  return `${base}-${Date.now().toString(36)}`;
}
