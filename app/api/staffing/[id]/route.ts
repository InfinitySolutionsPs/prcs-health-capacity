import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";
import { getCurrentEmployeeCount } from "@/lib/staffing-match";

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  if(!await requireRole(["admin","editor"]))return NextResponse.json({error:"ليس لديك صلاحية التعديل"},{status:403});
  try{
    const {id}=await params;const recordId=Number(id);const body=await req.json() as Record<string,unknown>;
    const jobTitleId=Number(body.jobTitleId),required=Number(body.required),db=getRawDb();
    const existing=await db.prepare("SELECT department_id AS departmentId FROM staffing WHERE id=?").bind(recordId).first<{departmentId:number}>();
    if(!Number.isInteger(recordId)||recordId<1||!existing||!Number.isInteger(jobTitleId)||jobTitleId<1||!Number.isInteger(required)||required<0)return NextResponse.json({error:"أدخل بيانات السجل بصورة صحيحة"},{status:400});
    const current=await getCurrentEmployeeCount(db,existing.departmentId,jobTitleId);
    if(!current)return NextResponse.json({error:"المسمى الوظيفي أو القسم غير موجود"},{status:400});
    const {position,available}=current;
    const result=await db.prepare("UPDATE staffing SET job_title_id=?,job_title=?,required=?,available=? WHERE id=?").bind(jobTitleId,position.jobTitle,required,available,recordId).run();
    if(!result.meta.changes)return NextResponse.json({error:"السجل غير موجود"},{status:404});
    return NextResponse.json({id:recordId,jobTitleId,jobTitle:position.jobTitle,required,available,gap:Math.max(required-available,0)});
  }catch(error){console.error(error);return NextResponse.json({error:"تعذر تعديل السجل أو أن المسمى مستخدم مسبقًا"},{status:409})}
}
