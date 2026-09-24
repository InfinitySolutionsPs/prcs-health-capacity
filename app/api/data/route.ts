import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureNormalizedSettings } from "@/db/seed";
import { getAuthorizedUser } from "@/lib/authorization";

export const dynamic="force-dynamic";
export async function GET(){
  try{
    if(!await getAuthorizedUser())return NextResponse.json({error:"يرجى تسجيل الدخول"},{status:401});
    await ensureNormalizedSettings();
    const db=getRawDb();
    const [hospitals,administrations,departments,jobTitles,cadreTypes,projects,staffing]=await db.batch([
      db.prepare("SELECT id, name FROM hospitals ORDER BY name"),
      db.prepare("SELECT a.id, a.hospital_id AS hospitalId, a.name, h.name AS hospitalName FROM administrations a JOIN hospitals h ON h.id=a.hospital_id ORDER BY h.name,a.name"),
      db.prepare("SELECT d.id, d.hospital_id AS hospitalId, d.administration_id AS administrationId, COALESCE(a.name,d.division) AS division, d.name, h.name AS hospitalName FROM departments d JOIN hospitals h ON h.id=d.hospital_id LEFT JOIN administrations a ON a.id=d.administration_id ORDER BY h.name, division, d.name"),
      db.prepare("SELECT id,name,active,main_administration AS mainAdministration,category_code AS categoryCode,job_code AS jobCode FROM job_titles ORDER BY name"),
      db.prepare("SELECT id,name FROM cadre_types ORDER BY name"),
      db.prepare("SELECT id,name FROM projects WHERE active=1 ORDER BY name"),
      db.prepare("WITH employee_counts AS (SELECT CASE WHEN TRIM(facility) IN ('مستشفى الامل','مستشفى الأمل') THEN 'مستشفى الأمل' WHEN TRIM(facility)='مستشفى السرايا الميداني' THEN 'مستشفى السرايا' WHEN TRIM(facility)='مستشفى التاهيل الطبي' THEN 'مستشفى التأهيل الطبي' ELSE TRIM(facility) END AS facility_key,TRIM(job_title) AS job_title,COUNT(*) AS available FROM employees WHERE status='على رأس عمله' GROUP BY facility_key,TRIM(job_title)), has_employees AS (SELECT CASE WHEN EXISTS(SELECT 1 FROM employees LIMIT 1) THEN 1 ELSE 0 END AS value) SELECT s.id,h.id AS hospitalId,h.name AS hospitalName,d.id AS departmentId,d.administration_id AS administrationId,COALESCE(a.name,d.division) AS division,d.name AS departmentName,s.job_title_id AS jobTitleId,COALESCE(j.name,s.job_title) AS jobTitle,s.required,CASE WHEN he.value=1 THEN COALESCE(ec.available,0) ELSE s.available END AS available,MAX(s.required-(CASE WHEN he.value=1 THEN COALESCE(ec.available,0) ELSE s.available END),0) AS gap FROM staffing s JOIN departments d ON d.id=s.department_id JOIN hospitals h ON h.id=d.hospital_id LEFT JOIN administrations a ON a.id=d.administration_id LEFT JOIN job_titles j ON j.id=s.job_title_id CROSS JOIN has_employees he LEFT JOIN employee_counts ec ON ec.facility_key=CASE WHEN h.name='مستشفى الامل' THEN 'مستشفى الأمل' WHEN h.name='مستشفى السرايا' THEN 'مستشفى السرايا' WHEN h.name='مستشفى التأهيل الطبي' THEN 'مستشفى التأهيل الطبي' ELSE TRIM(h.name) END AND ec.job_title=TRIM(COALESCE(j.name,s.job_title)) ORDER BY h.name,division,d.name,jobTitle")
    ]);
    return NextResponse.json({hospitals:hospitals.results,administrations:administrations.results,departments:departments.results,jobTitles:jobTitles.results,cadreTypes:cadreTypes.results,projects:projects.results,staffing:staffing.results});
  }catch(error){console.error(error);return NextResponse.json({error:"تعذر تحميل البيانات"},{status:500})}
}
