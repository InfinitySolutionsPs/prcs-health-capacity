import seedData from "./seed-data.json";
import { getRawDb } from "./index";

const SEED_KEY="hospital_excel_seed_v1";
const EMPLOYEE_FIELDS_KEY="employee_salary_fields_v1";
const CADRE_TYPES_KEY="cadre_types_v1";

export async function ensureEmployeeFields(){
  const db=getRawDb();
  await db.prepare("CREATE TABLE IF NOT EXISTS cadre_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)").run();
  await db.prepare("INSERT OR IGNORE INTO cadre_types (name) SELECT DISTINCT TRIM(cadre_type) FROM employees WHERE cadre_type IS NOT NULL AND TRIM(cadre_type)<>''").run();
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

export async function ensureNormalizedSettings(){
  await ensureEmployeeFields();
  await ensureBaseData();
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

