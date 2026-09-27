import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";
import { ensureNormalizedSettings } from "@/db/seed";
export async function GET(req: Request) {
  if (!(await requireRole(["admin", "editor", "viewer"])))
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 });
  const u = new URL(req.url),
    q = (u.searchParams.get("q") || "").trim(),
    limit = Math.min(Number(u.searchParams.get("limit") || 100), 10000),
    paged = u.searchParams.has("page"),
    page = Math.max(1, Number(u.searchParams.get("page") || 1)),
    pageSize = Math.min(100, Math.max(1, Number(u.searchParams.get("pageSize") || 25))),
    filters = ["jobTitle", "facility", "administration", "department", "status", "cadreType", "project"] as const;
  const db = getRawDb();
  // Settings and the one-time seed include unrelated tables. A problem while
  // normalizing one of those tables must not hide an employee register that
  // is already present in the database.
  try {
    await ensureNormalizedSettings();
  } catch (error) {
    console.error("HR data initialization failed; continuing with existing employees", error);
  }
  const filterColumns = { jobTitle: "job_title", facility: "facility", administration: "administration", department: "department", status: "status", cadreType: "cadre_type", project: "project" } as const;
  const clauses: string[] = [];
  const args: string[] = [];
  if (q) {
    clauses.push("(full_name LIKE ? OR employee_no LIKE ? OR facility LIKE ? OR department LIKE ? OR job_title LIKE ?)");
    args.push(...Array(5).fill(`%${q}%`));
  }
  for (const key of filters) {
    const value = u.searchParams.get(key);
    if (value) { clauses.push(`${filterColumns[key]} = ?`); args.push(value); }
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  // Fetch the employee rows and their counts first. These are the essential
  // data for this screen; auxiliary dashboard/settings queries are isolated
  // below so one missing optional table cannot turn the whole page into HTTP 500.
  let employees: { results: unknown[] };
  let filteredCount: { count: number } | null;
  let seededCount: { count: number } | null;
  try {
    employees = await db
      .prepare(`SELECT * FROM employees ${where} ORDER BY full_name LIMIT ? OFFSET ?`)
      .bind(...args, paged ? pageSize : limit, paged ? (page - 1) * pageSize : 0)
      .all() as { results: unknown[] };
    filteredCount = await db.prepare(`SELECT COUNT(*) AS count FROM employees ${where}`).bind(...args).first<{count:number}>();
    seededCount = await db.prepare("SELECT COUNT(*) AS count FROM employees").first<{count:number}>();
  } catch (error) {
    console.error("HR employee register query failed", error);
    return NextResponse.json({ error: "تعذر قراءة سجل الموظفين من قاعدة البيانات" }, { status: 500 });
  }
  const optional = async <T,>(name: string, run: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await run(); }
    catch (error) { console.error(`HR auxiliary query failed: ${name}`, error); return fallback; }
  };
  const [summary, facilities, statuses, cadres, payroll, jobCodes, hospitals, administrations, departments, jobTitles, cadreTypes, filterOptions] =
    await Promise.all([
      optional("summary", () => db.prepare("SELECT COUNT(*) total, SUM(CASE WHEN status='على رأس عمله' THEN 1 ELSE 0 END) active, COUNT(DISTINCT facility) facilities, COUNT(DISTINCT job_title) jobs FROM employees").first(), null),
      optional("facilities", () => db.prepare("SELECT facility name,COUNT(*) value FROM employees WHERE status='على رأس عمله' GROUP BY facility ORDER BY value DESC").all(), {results: []}),
      optional("statuses", () => db.prepare("SELECT status name,COUNT(*) value FROM employees GROUP BY status ORDER BY value DESC").all(), {results: []}),
      optional("cadres", () => db.prepare("SELECT cadre_type name,COUNT(*) value FROM employees WHERE status='على رأس عمله' GROUP BY cadre_type ORDER BY value DESC").all(), {results: []}),
      optional("payroll", () => db.prepare("SELECT COUNT(*) entries,COUNT(DISTINCT employee_no) employees,COUNT(DISTINCT project) projects,COALESCE(SUM(CAST(gross AS REAL)),0) gross,COALESCE(SUM(CAST(net AS REAL)),0) net FROM payroll_entries").first(), null),
      optional("job codes", () => db.prepare("SELECT job_code AS jobCode,job_title AS jobTitle,category_code AS categoryCode,main_administration AS mainAdministration,COUNT(*) employeeCount FROM employees WHERE job_code IS NOT NULL GROUP BY job_code,job_title,category_code,main_administration ORDER BY main_administration,job_title").all(), {results: []}),
      optional("hospitals", () => db.prepare("SELECT id,name FROM hospitals ORDER BY name").all(), {results: []}),
      optional("administrations", () => db.prepare("SELECT a.id,a.hospital_id AS hospitalId,a.name,h.name AS hospitalName FROM administrations a JOIN hospitals h ON h.id=a.hospital_id ORDER BY h.name,a.name").all(), {results: []}),
      optional("departments", () => db.prepare("SELECT d.id,d.hospital_id AS hospitalId,d.administration_id AS administrationId,COALESCE(a.name,d.division) AS administration,d.name,h.name AS hospitalName FROM departments d JOIN hospitals h ON h.id=d.hospital_id LEFT JOIN administrations a ON a.id=d.administration_id ORDER BY h.name,administration,d.name").all(), {results: []}),
      optional("job titles", () => db.prepare("SELECT id,name,active,main_administration AS mainAdministration,category_code AS categoryCode,job_code AS jobCode FROM job_titles WHERE active=1 ORDER BY name").all(), {results: []}),
      optional("cadre types", () => db.prepare("SELECT id,name FROM cadre_types ORDER BY name").all(), {results: []}),
      optional("filter options", () => db.prepare("SELECT 'jobTitle' AS kind,job_title AS value FROM employees WHERE job_title IS NOT NULL AND job_title<>'' UNION SELECT 'facility',facility FROM employees WHERE facility IS NOT NULL AND facility<>'' UNION SELECT 'administration',administration FROM employees WHERE administration IS NOT NULL AND administration<>'' UNION SELECT 'department',department FROM employees WHERE department IS NOT NULL AND department<>'' UNION SELECT 'project',project FROM employees WHERE project IS NOT NULL AND project<>'' UNION SELECT 'cadreType',cadre_type FROM employees WHERE cadre_type IS NOT NULL AND cadre_type<>'' ORDER BY kind,value").all(), {results: []}),
    ]);
  const optionRows = filterOptions.results as {kind:string;value:string}[];
  const options = Object.fromEntries(["jobTitle", "facility", "administration", "department", "project", "cadreType"].map(kind => [kind, optionRows.filter(row => row.kind === kind).map(row => row.value)]));
  return NextResponse.json({
    employees: employees.results,
    employeeCount: Number(seededCount?.count || 0),
    filteredCount: Number(filteredCount?.count || 0),
    page: paged ? page : 1,
    pageSize: paged ? pageSize : limit,
    filterOptions: options,
    summary,
    facilities: facilities.results,
    statuses: statuses.results,
    cadres: cadres.results,
    payroll,
    jobCodes: jobCodes.results,
    settings: { hospitals: hospitals.results, administrations: administrations.results, departments: departments.results, jobTitles: jobTitles.results, cadreTypes: cadreTypes.results },
  });
}
async function postHR(req: Request) {
  const b = await req.json();
  const allowed = b.type === "employee"
    ? await requireRole(["admin", "editor"])
    : await requireRole(["admin"]);
  if (!allowed)
    return NextResponse.json(
      { error: b.type === "employee" ? "إضافة الموظفين متاحة للمدير والمحرر فقط" : "الاستيراد متاح لمدير النظام فقط" },
      { status: 403 },
    );
  const db = getRawDb();
  await ensureNormalizedSettings();
  if (b.type === "employees") {
    const rows = Array.isArray(b.rows) ? b.rows : [];
    for (let i = 0; i < rows.length; i += 80) {
      await db.batch(
        rows
          .slice(i, i + 80)
          .map((r: any) =>
            db
              .prepare(
                `INSERT INTO employees(employee_no,employee_code,job_code,category_code,main_administration,full_name,national_id,gender,birth_date,cadre_type,phone,marital_status,hire_date,job_title,facility,administration,department,qualification,specialty,governorate,city,contract_start,contract_end,end_reason,end_date,status,dual_workplace,salary,job_grade,next_grade_eligibility,project,project_coverage,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(employee_no) DO UPDATE SET employee_code=excluded.employee_code,job_code=excluded.job_code,category_code=excluded.category_code,main_administration=excluded.main_administration,full_name=excluded.full_name,national_id=excluded.national_id,gender=excluded.gender,birth_date=excluded.birth_date,cadre_type=excluded.cadre_type,phone=excluded.phone,marital_status=excluded.marital_status,hire_date=excluded.hire_date,job_title=excluded.job_title,facility=excluded.facility,administration=excluded.administration,department=excluded.department,qualification=excluded.qualification,specialty=excluded.specialty,governorate=excluded.governorate,city=excluded.city,contract_start=excluded.contract_start,contract_end=excluded.contract_end,end_reason=excluded.end_reason,end_date=excluded.end_date,status=excluded.status,dual_workplace=excluded.dual_workplace,salary=excluded.salary,job_grade=excluded.job_grade,project=excluded.project,project_coverage=excluded.project_coverage,next_grade_eligibility=excluded.next_grade_eligibility,updated_at=CURRENT_TIMESTAMP`,
              )
              .bind(
                r.employeeNo,
                r.employeeCode || null,
                r.jobCode || null,
                r.categoryCode || null,
                r.mainAdministration || null,
                r.fullName,
                r.nationalId || null,
                r.gender || null,
                r.birthDate || null,
                r.cadreType || null,
                r.phone || null,
                r.maritalStatus || null,
                r.hireDate || null,
                r.jobTitle || "غير محدد",
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
                r.salary || null,
                r.jobGrade || null,
                r.nextGradeEligibility || null,
                r.project || null,
                r.projectCoverage || null,
              ),
          ),
      );
    }
    return NextResponse.json({ ok: true, count: rows.length });
  }
  if (b.type === "employee") {
    const r = b.row || {};
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
    const fullName = nameParts.join(" ");
    const last = await db
      .prepare(
        "SELECT employee_code FROM employees WHERE job_code=? AND employee_code IS NOT NULL ORDER BY employee_code DESC LIMIT 1",
      )
      .bind(r.jobCode)
      .first<{ employee_code?: string }>();
    const next = Number(last?.employee_code?.split("-").pop() || 0) + 1;
    const employeeCode = `${r.jobCode}-${String(next).padStart(4, "0")}`;
    const maxNo = await db
      .prepare("SELECT MAX(CAST(employee_no AS INTEGER)) value FROM employees")
      .first<{ value?: number }>();
    const employeeNo = String(Number(maxNo?.value || 0) + 1);
    await db
      .prepare(
        `INSERT INTO employees(
      employee_no,employee_code,job_code,category_code,main_administration,
      first_name,father_name,grandfather_name,family_name,full_name,
      national_id,gender,birth_date,cadre_type,phone,marital_status,hire_date,
      job_title,facility,administration,department,qualification,specialty,
      governorate,city,contract_start,contract_end,end_reason,end_date,status,
      dual_workplace,salary,job_grade,next_grade_eligibility,project,project_coverage,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`,
      )
      .bind(
        employeeNo,
        employeeCode,
        r.jobCode,
        r.categoryCode || null,
        r.mainAdministration || null,
        ...nameParts,
        fullName,
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
        r.salary || null,
        r.jobGrade || null,
        r.nextGradeEligibility || null,
        r.project || null,
        r.projectCoverage || null,
      )
      .run();
    return NextResponse.json({ ok: true, employeeNo, employeeCode });
  }
  if (b.type === "payroll") {
    const rows = Array.isArray(b.rows) ? b.rows : [];
    for (let i = 0; i < rows.length; i += 80) {
      await db.batch(
        rows
          .slice(i, i + 80)
          .map((r: any) =>
            db
              .prepare(
                `INSERT INTO payroll_entries(employee_no,employee_name,period,project,facility,administration,gross,deductions,net) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(employee_no,period,project) DO UPDATE SET employee_name=excluded.employee_name,facility=excluded.facility,administration=excluded.administration,gross=excluded.gross,deductions=excluded.deductions,net=excluded.net`,
              )
              .bind(
                r.employeeNo,
                r.employeeName,
                r.period,
                r.project,
                r.facility || null,
                r.administration || null,
                String(r.gross || 0),
                String(r.deductions || 0),
                String(r.net || 0),
              ),
          ),
      );
    }
    return NextResponse.json({ ok: true, count: rows.length });
  }
  return NextResponse.json(
    { error: "نوع الاستيراد غير صحيح" },
    { status: 400 },
  );
}

// Always return JSON to the browser. Without this guard, a database/schema
// failure can produce an empty or HTML response and the importer reports the
// misleading "Unexpected end of JSON input" message.
export async function POST(req: Request) {
  try {
    return await postHR(req);
  } catch (error) {
    console.error("HR import failed", error);
    return NextResponse.json(
      { error: "تعذر استيراد الملف. تحقق من الأعمدة المطلوبة ثم أعد المحاولة." },
      { status: 500 },
    );
  }
}
