import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    const { stdout, stderr } = await execAsync("bun run scripts/seed.ts", {
      cwd: "/home/z/my-project",
      timeout: 60000,
    });
    return NextResponse.json({ ok: true, stdout, stderr });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
