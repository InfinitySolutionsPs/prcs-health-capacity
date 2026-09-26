import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";
import { ensureNormalizedSettings } from "@/db/seed";

export async function GET() {
  if (!(await requireRole(["admin", "editor", "viewer"])))
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  await ensureNormalizedSettings();
  const rows = await getRawDb().prepare(`
    SELECT p.id,p.employee_no AS employeeNo,COALESCE(e.full_name,p.employee_name) AS employeeName,
      p.penalty_type AS penaltyType,p.incident_date AS incidentDate,p.description,
      p.deduction_amount AS deductionAmount,p.created_at AS createdAt,e.facility,e.job_title AS jobTitle
    FROM employee_penalties p LEFT JOIN employees e ON e.employee_no=p.employee_no
    ORDER BY p.incident_date DESC,p.id DESC
  `).all();
  return NextResponse.json({ penalties: rows.results });
}

export async function POST(req: Request) {
  if (!(await requireRole(["admin", "editor"])))
    return NextResponse.json({ error: "إضافة العقوبات متاحة لمدير النظام والمحرر فقط" }, { status: 403 });
  try {
    await ensureNormalizedSettings();
    const body = await req.json();
    const employeeNo = String(body.employeeNo || "").trim();
    const penaltyType = String(body.penaltyType || "").trim();
    const incidentDate = String(body.incidentDate || "").trim();
    const description = String(body.description || "").trim();
    const deductionAmount = Number(body.deductionAmount || 0);
    const db = getRawDb();
    const employee = await db.prepare("SELECT employee_no,full_name FROM employees WHERE employee_no=?").bind(employeeNo).first<{ employee_no: string; full_name: string }>();
    if (!employee || !penaltyType || !/^\d{4}-\d{2}-\d{2}$/.test(incidentDate) || !description || !Number.isFinite(deductionAmount) || deductionAmount < 0)
      return NextResponse.json({ error: "تحقق من الموظف ونوع العقوبة والتاريخ والتفاصيل" }, { status: 400 });
    const result = await db.prepare("INSERT INTO employee_penalties(employee_no,employee_name,penalty_type,incident_date,description,deduction_amount) VALUES(?,?,?,?,?,?)")
      .bind(employee.employee_no, employee.full_name, penaltyType, incidentDate, description, String(deductionAmount)).run();
    return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    console.error("Create employee penalty failed", error);
    return NextResponse.json({ error: "تعذر حفظ العقوبة" }, { status: 500 });
  }
}
