import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireRole(["admin", "editor"])))
    return NextResponse.json(
      { error: "التعديل متاح لمدير النظام فقط" },
      { status: 403 },
    );

  const { id } = await params;
  const r = await req.json();
  const nameParts = [
    r.firstName,
    r.fatherName,
    r.grandfatherName,
    r.familyName,
  ].map((part) => String(part || "").trim());
  if (nameParts.some((part) => !part) || !r.jobCode || !r.jobTitle)
    return NextResponse.json(
      { error: "الاسم الرباعي والمسمى الوظيفي مطلوبة" },
      { status: 400 },
    );

  const db = getRawDb();
  const current = await db
    .prepare("SELECT id,job_code,employee_code FROM employees WHERE id=?")
    .bind(id)
    .first<{ id: number; job_code?: string; employee_code?: string }>();
  if (!current)
    return NextResponse.json({ error: "الموظف غير موجود" }, { status: 404 });

  let employeeCode = current.employee_code || null;
  if (r.jobCode !== current.job_code || !employeeCode) {
    const last = await db
      .prepare(
        "SELECT employee_code FROM employees WHERE job_code=? AND id<>? AND employee_code IS NOT NULL ORDER BY employee_code DESC LIMIT 1",
      )
      .bind(r.jobCode, id)
      .first<{ employee_code?: string }>();
    employeeCode = `${r.jobCode}-${String(Number(last?.employee_code?.split("-").pop() || 0) + 1).padStart(4, "0")}`;
  }

  await db
    .prepare(
      `UPDATE employees SET
    employee_code=?,job_code=?,category_code=?,main_administration=?,
    first_name=?,father_name=?,grandfather_name=?,family_name=?,full_name=?,
    national_id=?,gender=?,birth_date=?,cadre_type=?,phone=?,marital_status=?,
    hire_date=?,job_title=?,facility=?,administration=?,department=?,
    qualification=?,specialty=?,governorate=?,city=?,contract_start=?,
    contract_end=?,end_reason=?,end_date=?,status=?,dual_workplace=?,
    updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    )
    .bind(
      employeeCode,
      r.jobCode,
      r.categoryCode || null,
      r.mainAdministration || null,
      ...nameParts,
      nameParts.join(" "),
      r.nationalId || null,
      r.gender || null,
      r.birthDate || null,
      r.cadreType || null,
      r.phone || null,
      r.maritalStatus || null,
      r.hireDate || null,
      r.jobTitle,
      r.facility || "غير محدد",
      r.administration || null,
      r.department || null,
      r.qualification || null,
      r.specialty || null,
      r.governorate || null,
      r.city || null,
      r.contractStart || null,
      r.contractEnd || null,
      r.endReason || null,
      r.endDate || null,
      r.status || "على رأس عمله",
      r.dualWorkplace || null,
      id,
    )
    .run();

  return NextResponse.json({ ok: true, employeeCode });
}
