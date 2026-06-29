import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/seed — Ejecuta scripts/seed.ts (solo dev)
//
// ⚠️ IMPORTANTE:
//  - Esta ruta EXPLOTA la base de datos. Solo debe existir en
//    desarrollo. En producción devolvemos 404 para no exponer
//    la existencia del endpoint.
//  - Detrás del middleware de NextAuth: si el mode AUTH_DISABLED
//    está desactivado va a exigir sesión válida.
//  - Doble check: incluso sin la sesión, en producción nunca corre.
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    // 404 deliberado para no confirmar la existencia de la ruta.
    return new NextResponse(null, { status: 404 });
  }

  if (process.env.AUTH_DISABLED !== "1") {
    console.warn(
      "[seed] ADVERTENCIA: ejecutando seed con auth activa — considerar restricción.",
    );
  }

  try {
    const projectRoot = process.cwd();
    const seedPath = path.join(projectRoot, "scripts", "seed.ts");

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
      { status: 500 },
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
