import seedData from "./seed-data.json";
import employeeSeed from "./employee-seed.json";
import { getRawDb } from "./index";

const SEED_KEY="hospital_excel_seed_v1";
const EMPLOYEE_SEED_KEY="employee_seed_v1";
const EMPLOYEE_FIELDS_KEY="employee_salary_fields_v1";
const CADRE_TYPES_KEY="cadre_types_v1";
const DEFAULT_CADRE_TYPES=["كادر","عقد","عقد مشروع","عقد ساعات","عقد يومي","عقد استشاري"];
const DEFAULT_PROJECTS=["Bright Futures","DRC-HealthyMinds","DRC/NOVO 2026-2027","ECHO HIP 2025","EHFK الالماني","FRC-CDCS phase 2-2025","GRC- TDA2","GRC-BMZ","GRC-BMZ SSF","GRC-GP1","HOPE","ICRC-EMS","ICRC-EMS-2026","JRCS-CBRP-2026-2027","MEP/SWISS","MedGlobal","PRCS-NORWEGIAN","PRCS_Gavi_2025","SWRC-Sida Hum","TRC-Gaza Health -2026","المشروع الكندي","المشروع النرويجي"];

/** Create the complete local-D1 schema for a brand-new Coolify resource. */
async function ensureCoreSchema(){
  const db=getRawDb();
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS hospitals (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_name ON hospitals(name)"),
    db.prepare("CREATE TABLE IF NOT EXISTS administrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hospital_id INTEGER NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_administrations_hospital_name ON administrations(hospital_id,name)"),
    db.prepare("CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY AUTOINCREMENT, hospital_id INTEGER NOT NULL, administration_id INTEGER, division TEXT NOT NULL DEFAULT 'غير محدد', name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_hospital_division_name ON departments(hospital_id,division,name)"),
    db.prepare("CREATE TABLE IF NOT EXISTS job_titles (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, main_administration TEXT, category_code TEXT, job_code TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_job_titles_name ON job_titles(name)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_job_titles_job_code ON job_titles(job_code)"),
    db.prepare("CREATE TABLE IF NOT EXISTS staffing (id INTEGER PRIMARY KEY AUTOINCREMENT, department_id INTEGER NOT NULL, job_title_id INTEGER, job_title TEXT NOT NULL, required INTEGER NOT NULL DEFAULT 0, available INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_staffing_department_job ON staffing(department_id,job_title)"),
    db.prepare("CREATE TABLE IF NOT EXISTS system_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS system_users (id INTEGER PRIMARY KEY AUTOINCREMENT, auth_user_id TEXT, username TEXT, password_hash TEXT, email TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'viewer', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_system_users_auth_user_id ON system_users(auth_user_id)"),
    db.prepare("CREATE TABLE IF NOT EXISTS employees (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_no TEXT NOT NULL, first_name TEXT, father_name TEXT, grandfather_name TEXT, family_name TEXT, employee_code TEXT, job_code TEXT, category_code TEXT, main_administration TEXT, full_name TEXT NOT NULL, national_id TEXT, gender TEXT, birth_date TEXT, cadre_type TEXT, phone TEXT, marital_status TEXT, hire_date TEXT, job_title TEXT NOT NULL, facility TEXT NOT NULL, administration TEXT, department TEXT, qualification TEXT, specialty TEXT, governorate TEXT, city TEXT, contract_start TEXT, contract_end TEXT, end_reason TEXT, end_date TEXT, status TEXT NOT NULL DEFAULT 'على رأس عمله', dual_workplace TEXT, salary TEXT, job_grade TEXT, project TEXT, project_coverage TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_employee_no ON employees(employee_no)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_employee_code ON employees(employee_code)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_employees_full_name ON employees(full_name)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_employees_facility ON employees(facility)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_employees_job_title ON employees(job_title)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_employees_cadre_type ON employees(cadre_type)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_employees_administration ON employees(administration)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)"),
    db.prepare("CREATE TABLE IF NOT EXISTS payroll_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, employee_no TEXT NOT NULL, employee_name TEXT NOT NULL, period TEXT NOT NULL, project TEXT NOT NULL, facility TEXT, administration TEXT, gross TEXT NOT NULL DEFAULT '0', deductions TEXT NOT NULL DEFAULT '0', net TEXT NOT NULL DEFAULT '0', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_employee_period_project ON payroll_entries(employee_no,period,project)"),
    db.prepare("CREATE TABLE IF NOT EXISTS projects (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
  ]);
}

export async function ensureEmployeeFields(){
  const db=getRawDb();
  const userColumns=(await db.prepare("PRAGMA table_info(system_users)").all()).results as {name:string}[];
  const userNames=new Set(userColumns.map(c=>c.name));
  if(!userNames.has("username"))await db.prepare("ALTER TABLE system_users ADD COLUMN username TEXT").run();
  if(!userNames.has("password_hash"))await db.prepare("ALTER TABLE system_users ADD COLUMN password_hash TEXT").run();
  const userCount=await db.prepare("SELECT COUNT(*) AS count FROM system_users").first<{count:number}>();
  if(userCount?.count){
    await db.prepare("UPDATE system_users SET username=COALESCE(NULLIF(username,''),LOWER(email)) WHERE username IS NULL OR username='' ").run();
  }
  await db.prepare("CREATE TABLE IF NOT EXISTS cadre_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("INSERT OR IGNORE INTO cadre_types (name) SELECT DISTINCT TRIM(cadre_type) FROM employees WHERE cadre_type IS NOT NULL AND TRIM(cadre_type)<>''").run();
  await db.batch(DEFAULT_CADRE_TYPES.map(name=>db.prepare("INSERT OR IGNORE INTO cadre_types (name) VALUES (?)").bind(name)));
  await db.batch(DEFAULT_PROJECTS.map(name=>db.prepare("INSERT OR IGNORE INTO projects (name) VALUES (?)").bind(name)));
  const done=await db.prepare("SELECT value FROM system_metadata WHERE key=?").bind(EMPLOYEE_FIELDS_KEY).first();
  if(done)return;
  const columns=(await db.prepare("PRAGMA table_info(employees)").all()).results as {name:string}[];
  const existing=new Set(columns.map(c=>c.name));
  const fields:[string,string][]=[["salary","TEXT"],["job_grade","TEXT"],["project","TEXT"],["project_coverage","TEXT"]];
  for(const [name,type] of fields) if(!existing.has(name)) await db.prepare(`ALTER TABLE employees ADD COLUMN ${name} ${type}`).run();
  await db.prepare("INSERT OR REPLACE INTO system_metadata (key,value) VALUES (?,?)").bind(EMPLOYEE_FIELDS_KEY,new Date().toISOString()).run();
  await db.prepare("INSERT OR REPLACE INTO system_metadata (key,value) VALUES (?,?)").bind(CADRE_TYPES_KEY,new Date().toISOString()).run();
}

export async function ensureBaseData(){
  const db=getRawDb();
  const done=await db.prepare("SELECT value FROM system_metadata WHERE key=?").bind(SEED_KEY).first();
  const existing=await db.prepare("SELECT COUNT(*) AS count FROM staffing").first<{count:number}>();
  if(done && (existing?.count||0)>0)return;

  const hospitals=[...new Set(seedData.records.map(r=>r.hospital))];
  await db.batch(hospitals.map(name=>db.prepare("INSERT OR IGNORE INTO hospitals (name) VALUES (?)").bind(name)));
  const hospitalRows=(await db.prepare("SELECT id,name FROM hospitals").all()).results as {id:number;name:string}[];
  const hospitalIds=new Map(hospitalRows.map(h=>[h.name,h.id]));

  const departmentMap=new Map<string,{hospitalId:number;division:string;name:string}>();
  for(const row of seedData.records){
    const hospitalId=hospitalIds.get(row.hospital);if(!hospitalId)continue;
    departmentMap.set(`${hospitalId}|${row.division}|${row.department}`,{hospitalId,division:row.division,name:row.department});
  }
  const departments=[...departmentMap.values()];
  for(let i=0;i<departments.length;i+=50){
    await db.batch(departments.slice(i,i+50).map(d=>db.prepare("INSERT OR IGNORE INTO departments (hospital_id,division,name) VALUES (?,?,?)").bind(d.hospitalId,d.division,d.name)));
  }
  const departmentRows=(await db.prepare("SELECT id,hospital_id AS hospitalId,division,name FROM departments").all()).results as {id:number;hospitalId:number;division:string;name:string}[];
  const departmentIds=new Map(departmentRows.map(d=>[`${d.hospitalId}|${d.division}|${d.name}`,d.id]));

  const statements=[];
  for(const row of seedData.records){
    const hospitalId=hospitalIds.get(row.hospital);if(!hospitalId)continue;
    const departmentId=departmentIds.get(`${hospitalId}|${row.division}|${row.department}`);if(!departmentId)continue;
    statements.push(db.prepare("INSERT OR IGNORE INTO staffing (department_id,job_title,required,available) VALUES (?,?,?,?)").bind(departmentId,row.jobTitle,row.required,row.available));
  }
  for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50));
  await db.prepare("INSERT OR REPLACE INTO system_metadata (key,value) VALUES (?,?)").bind(SEED_KEY,new Date().toISOString()).run();
}

/**
 * Populate the employee register once on a new/empty deployment. Existing
 * databases are never overwritten; the normal Excel importer remains the
 * source of truth for later updates.
 */
async function ensureEmployeeSeed(){
  const db=getRawDb();
  const seeded=await db.prepare("SELECT value FROM system_metadata WHERE key=?").bind(EMPLOYEE_SEED_KEY).first();
  const existing=await db.prepare("SELECT COUNT(*) AS count FROM employees").first<{count:number}>();
  if(seeded && (existing?.count||0)>0)return;
  if(seeded && !(existing?.count||0)){
    await db.prepare("DELETE FROM system_metadata WHERE key=?").bind(EMPLOYEE_SEED_KEY).run();
  }
  if((existing?.count||0)>0){
    await db.prepare("INSERT OR REPLACE INTO system_metadata (key,value) VALUES (?,?)").bind(EMPLOYEE_SEED_KEY,new Date().toISOString()).run();
    return;
  }
  const records=Array.isArray(employeeSeed.records)?employeeSeed.records:[];
  if(!records.length) throw new Error("Employee seed is empty");
  await seedEmployeeRecords(records);
  await db.prepare("INSERT OR REPLACE INTO system_metadata (key,value) VALUES (?,?)").bind(EMPLOYEE_SEED_KEY,new Date().toISOString()).run();
}

async function seedEmployeeRecords(records:any[]){
  const db=getRawDb();
  for(let i=0;i<records.length;i+=250){
    await db.batch(records.slice(i,i+250).map((r:any)=>db.prepare(`INSERT OR IGNORE INTO employees(
      employee_no,employee_code,job_code,category_code,main_administration,full_name,national_id,gender,birth_date,cadre_type,phone,marital_status,hire_date,job_title,facility,administration,department,qualification,specialty,governorate,city,contract_start,contract_end,end_reason,end_date,status,dual_workplace,salary,job_grade,project,project_coverage,updated_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).bind(
      r.employeeNo,r.employeeCode||null,r.jobCode||null,r.categoryCode||null,r.mainAdministration||null,r.fullName,
      r.nationalId||null,r.gender||null,r.birthDate||null,r.cadreType||null,r.phone||null,r.maritalStatus||null,
      r.hireDate||null,r.jobTitle||"غير محدد",r.facility||"غير محدد",r.administration||null,r.department||null,
      r.qualification||null,r.specialty||null,r.governorate||null,r.city||null,r.contractStart||null,r.contractEnd||null,
      r.endReason||null,r.endDate||null,r.status||"على رأس عمله",r.dualWorkplace||null,r.salary||null,r.jobGrade||null,
      r.project||null,r.projectCoverage||null
    )));
  }
}

let normalizedPromise: Promise<void> | null = null;

export function ensureNormalizedSettings(){
  if(normalizedPromise) return normalizedPromise;
  normalizedPromise=(async()=>{
  await ensureCoreSchema();
  await ensureEmployeeFields();
  await ensureBaseData();
  await ensureEmployeeSeed();
  const db=getRawDb();
  const divisions=(await db.prepare("SELECT DISTINCT hospital_id AS hospitalId, division FROM departments WHERE administration_id IS NULL").all()).results as {hospitalId:number;division:string}[];
  for(let i=0;i<divisions.length;i+=50){
    await db.batch(divisions.slice(i,i+50).map(row=>db.prepare("INSERT OR IGNORE INTO administrations (hospital_id,name) VALUES (?,?)").bind(row.hospitalId,row.division)));
  }
  if(divisions.length){
    await db.prepare("UPDATE departments SET administration_id=(SELECT a.id FROM administrations a WHERE a.hospital_id=departments.hospital_id AND a.name=departments.division LIMIT 1) WHERE administration_id IS NULL").run();
  }
  await db.prepare("INSERT OR IGNORE INTO job_titles (name) SELECT DISTINCT job_title FROM staffing WHERE TRIM(job_title)<>''").run();
  await db.prepare("UPDATE staffing SET job_title_id=(SELECT j.id FROM job_titles j WHERE j.name=staffing.job_title LIMIT 1) WHERE job_title_id IS NULL").run();
  })().catch(error=>{ normalizedPromise=null; throw error; });
  return normalizedPromise;
}
