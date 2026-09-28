import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";

export async function POST(req: Request) {
  if (!await requireRole(["admin"])) return NextResponse.json({ error: "هذه العملية للمدير فقط" }, { status: 403 });
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const administrationIds = [...new Set((Array.isArray(body.administrationIds) ? body.administrationIds : [body.administrationId]).map(Number).filter((id: number) => Number.isInteger(id) && id > 0))];
    if (name.length < 2 || !administrationIds.length) return NextResponse.json({ error: "أدخل اسم القسم وحدد إدارة واحدة على الأقل" }, { status: 400 });
    const db = getRawDb();
    const administrations = await db.prepare(`SELECT a.id,a.hospital_id AS hospitalId,a.name AS administrationName FROM administrations a WHERE a.id IN (${administrationIds.map(() => "?").join(",")})`).bind(...administrationIds).all<{ id: number; hospitalId: number; administrationName: string }>();
    if (administrations.results.length !== administrationIds.length) return NextResponse.json({ error: "تأكد من الإدارات المحددة" }, { status: 400 });
    const ids: number[] = [];
    for (const administration of administrations.results) {
      let row = await db.prepare("SELECT id FROM departments WHERE administration_id=? AND LOWER(TRIM(name))=LOWER(?) ORDER BY id LIMIT 1").bind(administration.id, name).first<{ id: number }>();
      if (!row) {
        const created = await db.prepare("INSERT INTO departments (hospital_id,administration_id,division,name) VALUES (?,?,?,?)").bind(administration.hospitalId, administration.id, administration.administrationName, name).run();
        row = { id: Number(created.meta.last_row_id) };
      }
      ids.push(row.id);
    }
    return NextResponse.json({ name, ids, administrationIds }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "القسم موجود مسبقًا أو تعذر الحفظ" }, { status: 409 });
  }
}
