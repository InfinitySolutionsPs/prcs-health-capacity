import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";
import { ensureNormalizedSettings } from "@/db/seed";

export async function GET(req: Request) {
  if (!(await requireRole(["admin", "editor", "viewer"])))
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  await ensureNormalizedSettings();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  const period = (url.searchParams.get("period") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || 25)));
  const clauses: string[] = [];
  const args: string[] = [];
  if (period) { clauses.push("period = ?"); args.push(period); }
  if (q) {
    clauses.push("(employee_name LIKE ? OR employee_no LIKE ? OR project LIKE ? OR facility LIKE ? OR administration LIKE ?)");
    args.push(...Array(5).fill(`%${q}%`));
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const db = getRawDb();
  const [rows, count, totals, periods] = await Promise.all([
    db.prepare(`
    SELECT id,employee_no AS employeeNo,employee_name AS employeeName,period,project,
      facility,administration,gross,deductions,net,created_at AS createdAt
    FROM payroll_entries ${where}
    ORDER BY period DESC,employee_name
    LIMIT ? OFFSET ?
  `).bind(...args, pageSize, (page - 1) * pageSize).all(),
    db.prepare(`SELECT COUNT(*) AS count FROM payroll_entries ${where}`).bind(...args).first<{count:number}>(),
    db.prepare(`SELECT COALESCE(SUM(CAST(gross AS REAL)),0) AS gross,COALESCE(SUM(CAST(deductions AS REAL)),0) AS deductions,COALESCE(SUM(CAST(net AS REAL)),0) AS net FROM payroll_entries ${where}`).bind(...args).first(),
    db.prepare("SELECT DISTINCT period FROM payroll_entries WHERE period IS NOT NULL AND period<>'' ORDER BY period DESC").all(),
  ]);
  return NextResponse.json({ payrollEntries: rows.results, count: Number(count?.count || 0), page, pageSize, totals, periods: periods.results.map((row: any) => row.period) });
}
