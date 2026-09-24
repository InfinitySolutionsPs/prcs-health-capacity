import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureNormalizedSettings } from "@/db/seed";
import { requireRole } from "@/lib/authorization";

export async function GET() {
  if (!(await requireRole(["admin", "editor", "viewer"]))) return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  await ensureNormalizedSettings();
  const rows = await getRawDb().prepare("SELECT pj.id,pj.project_id AS projectId,p.name AS projectName,pj.job_title_id AS jobTitleId,j.name AS jobTitle,j.job_code AS jobCode,pj.salary,pj.coverage,pj.required_count AS requiredCount FROM project_jobs pj JOIN projects p ON p.id=pj.project_id JOIN job_titles j ON j.id=pj.job_title_id ORDER BY p.name,j.name").all();
  return NextResponse.json({ items: rows.results });
}

export async function POST(req: Request) {
  if (!(await requireRole(["admin"]))) return NextResponse.json({ error: "هذه العملية للمدير فقط" }, { status: 403 });
  try {
    await ensureNormalizedSettings();
    const body = await req.json();
    const projectId = Number(body.projectId), jobTitleId = Number(body.jobTitleId);
    const salary = String(body.salary ?? "").trim(), coverage = String(body.coverage ?? "").trim(), requiredCount = Number(body.requiredCount ?? 1);
    if (!Number.isInteger(projectId) || !Number.isInteger(jobTitleId) || !salary || !coverage || !Number.isInteger(requiredCount) || requiredCount < 0) return NextResponse.json({ error: "اختر المشروع والمسمى وأدخل الراتب ونسبة التغطية" }, { status: 400 });
    const db = getRawDb();
    const exists = await db.prepare("SELECT id FROM project_jobs WHERE project_id=? AND job_title_id=?").bind(projectId, jobTitleId).first();
    if (exists) return NextResponse.json({ error: "هذا المسمى مضاف للمشروع مسبقًا" }, { status: 409 });
    const result = await db.prepare("INSERT INTO project_jobs(project_id,job_title_id,salary,coverage,required_count) VALUES(?,?,?,?,?)").bind(projectId, jobTitleId, salary, coverage, requiredCount).run();
    return NextResponse.json({ ok: true, id: result.meta.last_row_id }, { status: 201 });
  } catch (error) { console.error(error); return NextResponse.json({ error: "تعذر حفظ وظيفة المشروع" }, { status: 500 }); }
}

