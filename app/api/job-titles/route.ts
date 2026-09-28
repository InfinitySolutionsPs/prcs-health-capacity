import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureNormalizedSettings } from "@/db/seed";
import { requireRole } from "@/lib/authorization";

export async function POST(req: Request) {
  if (!await requireRole(["admin"])) return NextResponse.json({ error: "هذه العملية للمدير فقط" }, { status: 403 });
  try {
    await ensureNormalizedSettings();
    const body = await req.json() as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const requestedIds = Array.isArray(body.administrationIds)
      ? [...new Set(body.administrationIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0))]
      : [];
    const db = getRawDb();
    const legacyName = String(body.mainAdministration || "").trim();
    const legacyAdmin = legacyName
      ? await db.prepare("SELECT id,name FROM administrations WHERE name=? ORDER BY id LIMIT 1").bind(legacyName).first<{ id: number; name: string }>()
      : null;
    if (!requestedIds.length && legacyAdmin) requestedIds.push(legacyAdmin.id);
    if (name.length < 2 || !requestedIds.length) return NextResponse.json({ error: "أدخل المسمى وحدد دائرة واحدة على الأقل" }, { status: 400 });

    const administrations = await db.prepare(`SELECT id,name FROM administrations WHERE id IN (${requestedIds.map(() => "?").join(",")})`).bind(...requestedIds).all<{ id: number; name: string }>();
    if (administrations.results.length !== requestedIds.length) return NextResponse.json({ error: "تأكد من الدوائر المحددة" }, { status: 400 });
    const mainAdministration = administrations.results[0].name;
    const categoryCode = String(body.categoryCode || "ORG").trim();
    const existing = await db.prepare("SELECT id,category_code AS categoryCode,job_code AS jobCode FROM job_titles WHERE LOWER(TRIM(name))=LOWER(?) ORDER BY id LIMIT 1").bind(name).first<{ id: number; categoryCode?: string; jobCode?: string }>();

    if (existing) {
      await db.batch(requestedIds.map((administrationId) => db.prepare("INSERT OR IGNORE INTO job_title_administrations (job_title_id,administration_id) VALUES (?,?)").bind(existing.id, administrationId)));
      return NextResponse.json({ id: existing.id, name, mainAdministration, categoryCode: existing.categoryCode || categoryCode, jobCode: existing.jobCode, administrationIds: requestedIds, active: 1, reused: true });
    }

    const last = await db.prepare("SELECT job_code FROM (SELECT job_code FROM job_titles WHERE category_code=? UNION SELECT job_code FROM employees WHERE category_code=?) WHERE job_code IS NOT NULL ORDER BY job_code DESC LIMIT 1").bind(categoryCode, categoryCode).first<{ job_code?: string }>();
    const next = Number(last?.job_code?.split("-").pop() || 0) + 1;
    const jobCode = `${categoryCode}-${String(next).padStart(3, "0")}`;
    const created = await db.prepare("INSERT INTO job_titles (name,department_id,main_administration,category_code,job_code) VALUES (?,?,?,?,?)").bind(name, null, mainAdministration, categoryCode, jobCode).run();
    const id = Number(created.meta.last_row_id);
    await db.batch(requestedIds.map((administrationId) => db.prepare("INSERT OR IGNORE INTO job_title_administrations (job_title_id,administration_id) VALUES (?,?)").bind(id, administrationId)));
    return NextResponse.json({ id, name, mainAdministration, categoryCode, jobCode, administrationIds: requestedIds, active: 1, reused: false }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "تعذر حفظ المسمى الوظيفي وربطه بالدوائر المحددة" }, { status: 409 });
  }
}
