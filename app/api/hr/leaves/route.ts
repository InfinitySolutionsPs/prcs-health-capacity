import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";
import { ensureNormalizedSettings } from "@/db/seed";

export async function GET() {
  if (!(await requireRole(["admin", "editor", "viewer"])))
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  await ensureNormalizedSettings();
  const rows = await getRawDb().prepare(`
    SELECT l.id,l.employee_no AS employeeNo,COALESCE(e.full_name,l.employee_name) AS employeeName,
      l.leave_type AS leaveType,l.start_date AS startDate,l.end_date AS endDate,l.days,
      l.status,l.notes,l.created_at AS createdAt,e.facility,e.job_title AS jobTitle
    FROM employee_leaves l LEFT JOIN employees e ON e.employee_no=l.employee_no
    ORDER BY l.start_date DESC,l.id DESC
  `).all();
  return NextResponse.json({ leaves: rows.results });
}

export async function POST(req: Request) {
  if (!(await requireRole(["admin", "editor"])))
    return NextResponse.json({ error: "إضافة الإجازات متاحة لمدير النظام والمحرر فقط" }, { status: 403 });
  try {
    await ensureNormalizedSettings();
    const body = await req.json();
    const employeeNo = String(body.employeeNo || "").trim();
    const leaveType = String(body.leaveType || "").trim();
    const startDate = String(body.startDate || "").trim();
    const endDate = String(body.endDate || "").trim();
    const days = Number(body.days);
    const notes = String(body.notes || "").trim();
    const db = getRawDb();
    const employee = await db.prepare("SELECT employee_no,full_name FROM employees WHERE employee_no=?").bind(employeeNo).first<{ employee_no: string; full_name: string }>();
    if (!employee || !leaveType || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < startDate || !Number.isInteger(days) || days < 1)
      return NextResponse.json({ error: "تحقق من الموظف ونوع الإجازة والتواريخ وعدد الأيام" }, { status: 400 });
    const result = await db.prepare("INSERT INTO employee_leaves(employee_no,employee_name,leave_type,start_date,end_date,days,notes) VALUES(?,?,?,?,?,?,?)")
      .bind(employee.employee_no, employee.full_name, leaveType, startDate, endDate, days, notes || null).run();
    return NextResponse.json({ id: result.meta.last_row_id }, { status: 201 });
  } catch (error) {
    console.error("Create employee leave failed", error);
    return NextResponse.json({ error: "تعذر حفظ الإجازة" }, { status: 500 });
  }
}
