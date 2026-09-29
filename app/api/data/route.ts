import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureNormalizedSettings } from "@/db/seed";
import { getAuthorizedUser } from "@/lib/authorization";
import { countMatchingEmployees } from "@/lib/staffing-match";

type JobTitleRow={id:number;name:string;active:number;departmentId?:number;mainAdministration?:string;categoryCode?:string;jobCode?:string};
type GroupedJobTitle=JobTitleRow&{administrationIds:number[];administrationNames:string[];legacyIds:number[]};

export const dynamic="force-dynamic";
export async function GET(){
  try{
    if(!await getAuthorizedUser())return NextResponse.json({error:"يرجى تسجيل الدخول"},{status:401});
    await ensureNormalizedSettings();
    const db=getRawDb();
    const [hospitals,administrations,departments,jobTitles,titleAdministrations,cadreTypes,projects,projectJobs,staffing]=await db.batch([
      db.prepare("SELECT id, name FROM hospitals ORDER BY name"),
      db.prepare("SELECT a.id, a.hospital_id AS hospitalId, a.name, h.name AS hospitalName FROM administrations a JOIN hospitals h ON h.id=a.hospital_id ORDER BY h.name,a.name"),
      db.prepare("SELECT d.id, d.hospital_id AS hospitalId, d.administration_id AS administrationId, COALESCE(a.name,d.division) AS division, d.name, h.name AS hospitalName FROM departments d JOIN hospitals h ON h.id=d.hospital_id LEFT JOIN administrations a ON a.id=d.administration_id ORDER BY h.name, division, d.name"),
      db.prepare("SELECT id,name,active,department_id AS departmentId,main_administration AS mainAdministration,category_code AS categoryCode,job_code AS jobCode FROM job_titles ORDER BY name"),
      db.prepare("SELECT j.id AS jobTitleId,a.id AS administrationId,a.name AS administrationName FROM job_title_administrations ja JOIN job_titles j ON j.id=ja.job_title_id JOIN administrations a ON a.id=ja.administration_id ORDER BY j.id,a.name"),
      db.prepare("SELECT id,name FROM cadre_types ORDER BY name"),
      db.prepare("SELECT p.id,p.name,p.start_date AS startDate,p.end_date AS endDate,COALESCE((SELECT SUM(CAST(pe.gross AS REAL)) FROM payroll_entries pe WHERE pe.project=p.name),0) AS budgetSpent FROM projects p WHERE p.active=1 ORDER BY p.name"),
      db.prepare("SELECT pj.id,pj.project_id AS projectId,p.name AS projectName,pj.job_title_id AS jobTitleId,j.name AS jobTitle,j.job_code AS jobCode,j.main_administration AS mainAdministration,pj.salary,pj.coverage,pj.required_count AS requiredCount,(SELECT COUNT(*) FROM employees e WHERE e.project=p.name AND e.status='على رأس عمله' AND ((j.job_code IS NOT NULL AND e.job_code=j.job_code) OR (e.job_title=j.name AND COALESCE(e.main_administration,'')=COALESCE(j.main_administration,'')))) AS employeesCount FROM project_jobs pj JOIN projects p ON p.id=pj.project_id JOIN job_titles j ON j.id=pj.job_title_id ORDER BY p.name,j.name,j.main_administration"),
      db.prepare("SELECT s.id,h.id AS hospitalId,h.name AS hospitalName,d.id AS departmentId,d.administration_id AS administrationId,COALESCE(a.name,d.division) AS division,d.name AS departmentName,s.job_title_id AS jobTitleId,COALESCE(j.name,s.job_title) AS jobTitle,j.job_code AS jobCode,s.required,s.available,MAX(s.required-s.available,0) AS gap FROM staffing s JOIN departments d ON d.id=s.department_id JOIN hospitals h ON h.id=d.hospital_id LEFT JOIN administrations a ON a.id=d.administration_id LEFT JOIN job_titles j ON j.id=s.job_title_id ORDER BY h.name,division,d.name,jobTitle")
    ]);
    const activeEmployees = (await db.prepare("SELECT job_code AS jobCode,job_title AS jobTitle,facility,main_administration AS mainAdministration,administration,department,status FROM employees WHERE status IS NULL OR TRIM(status)='' OR status='على رأس عمله'").all()).results as Parameters<typeof countMatchingEmployees>[0];
    const liveStaffing = (staffing.results as any[]).map((row) => {
      const available = countMatchingEmployees(activeEmployees, row);
      return { ...row, available, gap: Math.max(Number(row.required) - available, 0) };
    });
    const directoryById=new Map<number,Set<number>>();
    const directoryNamesById=new Map<number,Set<string>>();
    for(const row of titleAdministrations.results as {jobTitleId:number;administrationId:number;administrationName:string}[]){
      if(!directoryById.has(row.jobTitleId))directoryById.set(row.jobTitleId,new Set());
      if(!directoryNamesById.has(row.jobTitleId))directoryNamesById.set(row.jobTitleId,new Set());
      directoryById.get(row.jobTitleId)!.add(row.administrationId);
      directoryNamesById.get(row.jobTitleId)!.add(row.administrationName);
    }
    // Older installations may already contain duplicate rows for the same title.
    // Present one title in the UI and combine all of its existing links.
    const groupedTitles=new Map<string,GroupedJobTitle>();
    for(const raw of jobTitles.results as JobTitleRow[]){
      const key=String(raw.name||"").trim().toLocaleLowerCase();
      const ids=[...(directoryById.get(raw.id)||[])];
      const names=[...(directoryNamesById.get(raw.id)||[])];
      const title=groupedTitles.get(key);
      if(!title){groupedTitles.set(key,{...raw,administrationIds:ids,administrationNames:names,legacyIds:[raw.id]});}
      else{
        title.administrationIds=[...new Set([...title.administrationIds,...ids])];
        title.administrationNames=[...new Set([...title.administrationNames,...names])];
        title.legacyIds.push(raw.id);
        title.active=Math.max(Number(title.active),Number(raw.active));
      }
    }
    return NextResponse.json({hospitals:hospitals.results,administrations:administrations.results,departments:departments.results,jobTitles:[...groupedTitles.values()],cadreTypes:cadreTypes.results,projects:projects.results,projectJobs:projectJobs.results,staffing:liveStaffing});
  }catch(error){console.error(error);return NextResponse.json({error:"تعذر تحميل البيانات"},{status:500})}
}
