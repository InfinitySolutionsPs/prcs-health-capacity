import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";
import { ensureNormalizedSettings } from "@/db/seed";

export async function GET() {
  if (!(await requireRole(["admin", "editor", "viewer"])))
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  await ensureNormalizedSettings();
  const rows = await getRawDb().prepare(`
    SELECT id,employee_no AS employeeNo,employee_name AS employeeName,period,project,
      facility,administration,gross,deductions,net,created_at AS createdAt
    FROM payroll_entries
    ORDER BY period DESC,employee_name
    LIMIT 10000
  `).all();
  return NextResponse.json({ payrollEntries: rows.results });
}
