import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";
import { ensureNormalizedSettings } from "@/db/seed";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(["admin", "editor"])))
    return NextResponse.json({ error: "تعديل الإجازات متاح لمدير النظام والمحرر فقط" }, { status: 403 });
  try {
    await ensureNormalizedSettings();
    const { id } = await params;
    const { status } = await req.json();
    if (!["مقدمة", "موافق عليها", "مرفوضة"].includes(String(status)))
      return NextResponse.json({ error: "حالة الإجازة غير صحيحة" }, { status: 400 });
    const result = await getRawDb().prepare("UPDATE employee_leaves SET status=? WHERE id=?").bind(status, id).run();
    if (!result.meta.changes) return NextResponse.json({ error: "الإجازة غير موجودة" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "تعذر تحديث حالة الإجازة" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole(["admin"])))
    return NextResponse.json({ error: "حذف الإجازات متاح لمدير النظام فقط" }, { status: 403 });
  const { id } = await params;
  const result = await getRawDb().prepare("DELETE FROM employee_leaves WHERE id=?").bind(id).run();
  if (!result.meta.changes) return NextResponse.json({ error: "الإجازة غير موجودة" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
