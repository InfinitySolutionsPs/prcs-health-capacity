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
      db.prepare("SELECT s.id,h.id AS hospitalId,h.name AS hospitalName,d.id AS departmentId,d.administration_id AS administrationId,COALESCE(a.name,d.division) AS division,d.name AS departmentName,s.job_title_id AS jobTitleId,COALESCE(j.name,s.job_title) AS jobTitle,s.required,s.available,MAX(s.required-s.available,0) AS gap FROM staffing s JOIN departments d ON d.id=s.department_id JOIN hospitals h ON h.id=d.hospital_id LEFT JOIN administrations a ON a.id=d.administration_id LEFT JOIN job_titles j ON j.id=s.job_title_id ORDER BY h.name,division,d.name,jobTitle")
    ]);
    return NextResponse.json({hospitals:hospitals.results,administrations:administrations.results,departments:departments.results,jobTitles:jobTitles.results,cadreTypes:cadreTypes.results,projects:projects.results,staffing:staffing.results});
  }catch(error){console.error(error);return NextResponse.json({error:"تعذر تحميل البيانات"},{status:500})}
}

