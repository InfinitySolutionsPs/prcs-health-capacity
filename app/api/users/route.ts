import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole, type Role } from "@/lib/authorization";
import { hashPassword } from "@/lib/password";
import { ensureEmployeeFields } from "@/db/seed";

const validRoles: Role[] = ["admin", "editor", "viewer"];
const validUsername = (value: string) => /^[a-z0-9._-]{3,40}$/.test(value);

export async function GET() {
  if (!(await requireRole(["admin"])))
    return NextResponse.json({ error: "هذه العملية للمدير فقط" }, { status: 403 });
  const result = await getRawDb()
    .prepare("SELECT id,username,name,role,active,created_at AS createdAt FROM system_users ORDER BY name")
    .all();
  return NextResponse.json({ users: result.results });
}

export async function POST(req: Request) {
  if (!(await requireRole(["admin"])))
    return NextResponse.json({ error: "هذه العملية للمدير فقط" }, { status: 403 });

  try {
    await ensureEmployeeFields();
    const body = await req.json() as Record<string, unknown>;
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const role = String(body.role || "") as Role;

    if (!validUsername(username) || password.length < 8 || name.length < 2 || !validRoles.includes(role))
      return NextResponse.json(
        { error: "أدخل اسم مستخدم صحيحًا (3 أحرف على الأقل) وكلمة مرور من 8 أحرف على الأقل وحدد الصلاحية" },
        { status: 400 },
      );

    const db = getRawDb();
    const existing = await db
      .prepare("SELECT id FROM system_users WHERE LOWER(username)=? LIMIT 1")
      .bind(username)
      .first();
    if (existing)
      return NextResponse.json({ error: "اسم المستخدم مستخدم مسبقًا" }, { status: 409 });

    const result = await db
      .prepare("INSERT INTO system_users (username,email,name,role,active,password_hash) VALUES (?,?,?,?,1,?)")
      .bind(username, `${crypto.randomUUID()}@accounts.prcs.local`, name, role, await hashPassword(password))
      .run();

    return NextResponse.json(
      { id: result.meta.last_row_id, username, name, role, active: 1 },
      { status: 201 },
    );
  } catch (error) {
    console.error("Could not create system user", error);
    return NextResponse.json({ error: "اسم المستخدم مستخدم مسبقًا أو تعذر حفظ الحساب" }, { status: 409 });
  }
}
