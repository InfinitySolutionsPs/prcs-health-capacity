import { NextResponse } from "next/server";
import { getRawDb } from "@/db";

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  try{
    const {id}=await params;const recordId=Number(id);const body=await req.json();
    const jobTitleId=Number(body.jobTitleId),required=Number(body.required),available=Number(body.available);const title=await getRawDb().prepare("SELECT name FROM job_titles WHERE id=? AND active=1").bind(jobTitleId).first<{name:string}>();
    if(!Number.isInteger(recordId)||recordId<1||!title||!Number.isInteger(required)||required<0||!Number.isInteger(available)||available<0)return NextResponse.json({error:"أدخل بيانات السجل بصورة صحيحة"},{status:400});
    const result=await getRawDb().prepare("UPDATE staffing SET job_title_id=?,job_title=?,required=?,available=? WHERE id=?").bind(jobTitleId,title.name,required,available,recordId).run();
    if(!result.meta.changes)return NextResponse.json({error:"السجل غير موجود"},{status:404});
    return NextResponse.json({id:recordId,jobTitleId,jobTitle:title.name,required,available,gap:Math.max(required-available,0)});
  }catch(error){console.error(error);return NextResponse.json({error:"تعذر تعديل السجل أو أن المسمى مستخدم مسبقًا"},{status:409})}
}
