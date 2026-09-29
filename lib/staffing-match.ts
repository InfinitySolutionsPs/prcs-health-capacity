export type EmployeePosition = {
  jobCode?: string | null;
  jobTitle?: string | null;
  facility?: string | null;
  mainAdministration?: string | null;
  administration?: string | null;
  department?: string | null;
  status?: string | null;
  employeeCount?: number | null;
};

export type StaffingPosition = {
  hospitalName: string;
  division: string;
  departmentName: string;
  jobTitle: string;
  jobCode?: string | null;
};

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ar")
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\sـ_\-–—]/g, "");
}

function facilityKey(value: unknown) {
  const name = normalize(value);
  if ((name.includes("نقاط") || name.includes("نقطه")) && name.includes("طبيه")) return "الرعايهالصحيهالاوليه";
  if (name.includes("رعايهصحيه") && name.includes("اوليه")) return "الرعايهالصحيهالاوليه";
  return name;
}

function organizationKey(value: unknown) {
  return normalize(value).replace(/^(?:ال)?(?:عياده|عيادات|نقطه|نقاط|مركز|قسم)/, "");
}

export function countMatchingEmployees(employees: EmployeePosition[], position: StaffingPosition) {
  return employees.reduce((total, employee) => total + (employeeMatchesPosition(employee, position) ? Number(employee.employeeCount || 1) : 0), 0);
}

export function employeeMatchesPosition(employee: EmployeePosition, position: StaffingPosition) {
  const wantedJob = normalize(position.jobTitle);
  const wantedCode = normalize(position.jobCode);
  const wantedFacility = facilityKey(position.hospitalName);
  const wantedOrganizations = [position.division, position.departmentName].map(organizationKey).filter(Boolean);

  if (employee.status && employee.status !== "على رأس عمله") return false;
  const sameJob = (wantedCode && normalize(employee.jobCode) === wantedCode) || normalize(employee.jobTitle) === wantedJob;
  if (!sameJob || facilityKey(employee.facility) !== wantedFacility) return false;

  const employeeOrganizations = [employee.mainAdministration, employee.administration, employee.department]
    .map(organizationKey)
    .filter(Boolean);
  return !employeeOrganizations.length || employeeOrganizations.some((name) => wantedOrganizations.includes(name));
}

export async function getCurrentEmployeeCount(db: any, departmentId: number, jobTitleId: number) {
  const position = await db.prepare(`
    SELECT h.name AS hospitalName, COALESCE(a.name, d.division, '') AS division,
      d.name AS departmentName, j.name AS jobTitle, j.job_code AS jobCode
    FROM departments d
    JOIN hospitals h ON h.id = d.hospital_id
    LEFT JOIN administrations a ON a.id = d.administration_id
    JOIN job_titles j ON j.id = ? AND j.active = 1
    WHERE d.id = ?
  `).bind(jobTitleId, departmentId).first() as StaffingPosition | null;
  if (!position) return null;

  const employeeResult = await db.prepare(`
    SELECT job_code AS jobCode, job_title AS jobTitle, facility,
      main_administration AS mainAdministration, administration, department, status
    FROM employees
    WHERE status IS NULL OR TRIM(status) = '' OR status = 'على رأس عمله'
  `).all();
  const employees = (employeeResult?.results || []) as EmployeePosition[];
  return { position, available: countMatchingEmployees(employees, position) };
}
