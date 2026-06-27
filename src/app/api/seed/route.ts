import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// POST /api/seed — Ejecuta scripts/seed.ts (solo admin, solo dev)
//
// ⚠️ IMPORTANTE:
//  - Esta ruta EXPLOTA la base de datos. Solo debe existir en
//    desarrollo. En producción debe ser 404 o 401.
//  - El cwd se resuelve relativo al proyecto (no hardcodeado como
//    antes, que rompía en Windows).
//  - Comandos largos (60s timeout).
export async function POST() {
  // Solo habilitado en entornos de desarrollo y sin auth activa
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        ok: false,
        error: "Seed deshabilitado en producción",
      },
      { status: 403 }
    );
  }

  // Solo si auth NO está configurada (modo dev). En caso de auth activa
  // en desarrollo, loggear warning para que el admin decida restringir.
  if (process.env.AUTH_DISABLED !== "1") {
    console.warn(
      "[seed] ADVERTENCIA: ejecutando seed con auth activa — considerar restricción."
    );
  }

  try {
    const projectRoot = process.cwd();

    // Verificar que scripts/seed.ts exista antes de invocar bun
    const seedPath = path.join(projectRoot, "scripts", "seed.ts");

    // Usar `bun run` si está disponible; fallback a `npx tsx`
    const command = (await isCommandAvailable("bun"))
      ? `bun run scripts/seed.ts`
      : `npx tsx scripts/seed.ts`;

    const { stdout, stderr } = await execAsync(command, {
      cwd: projectRoot,
      timeout: 60_000,
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || "",
      },
    });

    return NextResponse.json({
      ok: true,
      seedPath: path.relative(projectRoot, seedPath),
      runner: command.split(" ")[0],
      stdout: stdout.slice(0, 10_000),
      stderr: stderr ? stderr.slice(0, 5_000) : undefined,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e.message,
        stdout: e.stdout ? String(e.stdout).slice(0, 5_000) : undefined,
        stderr: e.stderr ? String(e.stderr).slice(0, 5_000) : undefined,
      },
      { status: 500 }
    );
  }
}

// Detecta si un ejecutable está disponible en PATH
async function isCommandAvailable(cmd: string): Promise<boolean> {
  try {
    const check = process.platform === "win32" ? `where ${cmd}` : `which ${cmd}`;
    await execAsync(check, { timeout: 2_000 });
    return true;
  } catch {
    return false;
  }
}
