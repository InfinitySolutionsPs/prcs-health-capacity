import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";

export async function POST(req: Request) {
  if (!await requireRole(["admin"])) return NextResponse.json({ error: "هذه العملية للمدير فقط" }, { status: 403 });
  try {
    const body = await req.json();
    const name = String(body.name || "").trim();
    const hospitalIds = [...new Set((Array.isArray(body.hospitalIds) ? body.hospitalIds : [body.hospitalId]).map(Number).filter((id: number) => Number.isInteger(id) && id > 0))];
    if (name.length < 2 || !hospitalIds.length) return NextResponse.json({ error: "أدخل اسم الإدارة وحدد مركزًا واحدًا على الأقل" }, { status: 400 });
    const db = getRawDb();
    const hospitals = await db.prepare(`SELECT id,name FROM hospitals WHERE id IN (${hospitalIds.map(() => "?").join(",")})`).bind(...hospitalIds).all<{ id: number; name: string }>();
    if (hospitals.results.length !== hospitalIds.length) return NextResponse.json({ error: "تأكد من المراكز المحددة" }, { status: 400 });
    const ids: number[] = [];
    for (const hospitalId of hospitalIds) {
      let row = await db.prepare("SELECT id FROM administrations WHERE hospital_id=? AND LOWER(TRIM(name))=LOWER(?) ORDER BY id LIMIT 1").bind(hospitalId, name).first<{ id: number }>();
      if (!row) {
        const created = await db.prepare("INSERT INTO administrations (hospital_id,name) VALUES (?,?)").bind(hospitalId, name).run();
        row = { id: Number(created.meta.last_row_id) };
      }
      ids.push(row.id);
      // Keep existing fixed job titles available in each newly linked center.
      await db.prepare("INSERT OR IGNORE INTO job_title_administrations (job_title_id,administration_id) SELECT ja.job_title_id,? FROM job_title_administrations ja JOIN administrations old ON old.id=ja.administration_id WHERE LOWER(TRIM(old.name))=LOWER(?)").bind(row.id, name).run();
    }
    return NextResponse.json({ name, ids, hospitalIds }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "الإدارة موجودة مسبقًا أو تعذر الحفظ" }, { status: 409 });
  }
}
