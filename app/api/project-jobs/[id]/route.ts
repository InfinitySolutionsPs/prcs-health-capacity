import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureNormalizedSettings } from "@/db/seed";
import { requireRole } from "@/lib/authorization";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(["admin"]))) return NextResponse.json({ error: "هذه العملية للمدير فقط" }, { status: 403 });
  await ensureNormalizedSettings();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "المعرّف غير صحيح" }, { status: 400 });
  const result = await getRawDb().prepare("DELETE FROM project_jobs WHERE id=?").bind(id).run();
  return result.meta.changes ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "السجل غير موجود" }, { status: 404 });
}

