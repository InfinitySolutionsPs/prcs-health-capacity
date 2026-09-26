import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(["admin"])))
    return NextResponse.json({ error: "حذف العقوبات متاح لمدير النظام فقط" }, { status: 403 });
  const { id } = await params;
  const result = await getRawDb().prepare("DELETE FROM employee_penalties WHERE id=?").bind(id).run();
  if (!result.meta.changes) return NextResponse.json({ error: "العقوبة غير موجودة" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
