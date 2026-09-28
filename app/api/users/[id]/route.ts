import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole, type Role } from "@/lib/authorization";
import { hashPassword } from "@/lib/password";
import { ensureEmployeeFields } from "@/db/seed";

const validRoles: Role[] = ["admin", "editor", "viewer"];
const validUsername = (value: string) => /^[a-z0-9._-]{3,40}$/.test(value);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await requireRole(["admin"]);
  if (!current)
    return NextResponse.json({ error: "هذه العملية للمدير فقط" }, { status: 403 });

  try {
    await ensureEmployeeFields();
    const id = Number((await params).id);
    const body = await req.json() as Record<string, unknown>;
    const username = String(body.username || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const role = String(body.role || "") as Role;
    const active = body.active ? 1 : 0;
    const password = String(body.password || "");

    if (!Number.isInteger(id) || !validUsername(username) || name.length < 2 || !validRoles.includes(role) || (password && password.length < 8))
      return NextResponse.json({ error: "بيانات المستخدم غير صحيحة" }, { status: 400 });
    if (id === current.id && (!active || role !== "admin"))
      return NextResponse.json({ error: "لا يمكنك تعطيل حسابك أو إزالة صلاحية المدير عنه" }, { status: 400 });

    const db = getRawDb();
    const duplicate = await db
      .prepare("SELECT id FROM system_users WHERE LOWER(username)=? AND id<>? LIMIT 1")
      .bind(username, id)
      .first();
    if (duplicate)
      return NextResponse.json({ error: "اسم المستخدم مستخدم لحساب آخر" }, { status: 409 });

    const result = password
      ? await db.prepare("UPDATE system_users SET username=?,name=?,role=?,active=?,password_hash=? WHERE id=?")
          .bind(username, name, role, active, await hashPassword(password), id).run()
      : await db.prepare("UPDATE system_users SET username=?,name=?,role=?,active=? WHERE id=?")
          .bind(username, name, role, active, id).run();

    if (!result.meta.changes)
      return NextResponse.json({ error: "المستخدم غير موجود" }, { status: 404 });
    return NextResponse.json({ id, username, name, role, active });
  } catch (error) {
    console.error("Could not update system user", error);
    return NextResponse.json({ error: "تعذر تعديل بيانات المستخدم" }, { status: 409 });
  }
}
