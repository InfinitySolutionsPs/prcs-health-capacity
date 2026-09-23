import seedData from "./seed-data.json";
import employeeSeed from "./employee-seed.json";
import { getRawDb } from "./index";
import { hashPassword } from "@/lib/password";

const SEED_KEY="hospital_excel_seed_v1";
const EMPLOYEE_FIELDS_KEY="employee_salary_fields_v1";
const CADRE_TYPES_KEY="cadre_types_v1";
const DEFAULT_CADRE_TYPES=["كادر","عقد","عقد مشروع","عقد ساعات","عقد يومي","عقد استشاري"];

export async function ensureEmployeeFields(){
  const db=getRawDb();
  const userColumns=(await db.prepare("PRAGMA table_info(system_users)").all()).results as {name:string}[];
  const userNames=new Set(userColumns.map(c=>c.name));
  if(!userNames.has("username"))await db.prepare("ALTER TABLE system_users ADD COLUMN username TEXT").run();
  if(!userNames.has("password_hash"))await db.prepare("ALTER TABLE system_users ADD COLUMN password_hash TEXT").run();
  const userCount=await db.prepare("SELECT COUNT(*) AS count FROM system_users").first<{count:number}>();
  if(!userCount?.count){
    await db.prepare("INSERT INTO system_users (username,email,name,role,active,password_hash) VALUES (?,?,?,?,1,?)").bind("admin","admin@prcs.local","مدير النظام","admin",await hashPassword("admin123")).run();
  }else{
    await db.prepare("UPDATE system_users SET username=COALESCE(NULLIF(username,''),LOWER(email)) WHERE username IS NULL OR username='' ").run();
  }
  await db.prepare("CREATE TABLE IF NOT EXISTS cadre_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("INSERT OR IGNORE INTO cadre_types (name) SELECT DISTINCT TRIM(cadre_type) FROM employees WHERE cadre_type IS NOT NULL AND TRIM(cadre_type)<>''").run();
  await db.batch(DEFAULT_CADRE_TYPES.map(name=>db.prepare("INSERT OR IGNORE INTO cadre_types (name) VALUES (?)").bind(name)));
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
  if(done)return;

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
  const existing=await db.prepare("SELECT COUNT(*) AS count FROM employees").first<{count:number}>();
  if((existing?.count||0)>0)return;
  const records=Array.isArray(employeeSeed.records)?employeeSeed.records:[];
  for(let i=0;i<records.length;i+=50){
    await db.batch(records.slice(i,i+50).map((r:any)=>db.prepare(`INSERT OR IGNORE INTO employees(
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

export async function ensureNormalizedSettings(){
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
}
