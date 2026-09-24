import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureNormalizedSettings } from "@/db/seed";
import { requireRole } from "@/lib/authorization";

export async function GET(){
  if(!(await requireRole(["admin","editor","viewer"]))) return NextResponse.json({error:"غير مصرح"},{status:403});
  await ensureNormalizedSettings();
  return NextResponse.json({items:(await getRawDb().prepare("SELECT id,name,start_date AS startDate,end_date AS endDate FROM projects WHERE active=1 ORDER BY name").all()).results});
}
export async function POST(req:Request){
  if(!(await requireRole(["admin"]))) return NextResponse.json({error:"هذه العملية للمدير فقط"},{status:403});
  try{await ensureNormalizedSettings();const body=await req.json(),name=String(body.name||"").trim(),startDate=String(body.startDate||"").trim(),endDate=String(body.endDate||"").trim();if(name.length<2)return NextResponse.json({error:"أدخل اسم المشروع"},{status:400});if(startDate&&endDate&&startDate>endDate)return NextResponse.json({error:"تاريخ نهاية المشروع يجب أن يكون بعد تاريخ البداية"},{status:400});const r=await getRawDb().prepare("INSERT INTO projects (name,start_date,end_date) VALUES (?,?,?)").bind(name,startDate||null,endDate||null).run();return NextResponse.json({id:r.meta.last_row_id,name,startDate,endDate},{status:201})}catch{return NextResponse.json({error:"المشروع موجود مسبقًا أو تعذر الحفظ"},{status:409})}
}
