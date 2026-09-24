import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureNormalizedSettings } from "@/db/seed";
import { requireRole } from "@/lib/authorization";
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await requireRole(["admin"]))) return NextResponse.json({error:"هذه العملية للمدير فقط"},{status:403});
  await ensureNormalizedSettings();const id=Number((await params).id),body=await req.json(),name=String(body.name||"").trim(); const current=await getRawDb().prepare("SELECT start_date AS startDate,end_date AS endDate FROM projects WHERE id=?").bind(id).first<{startDate:string|null;endDate:string|null}>(); const startDate=body.startDate===undefined?String(current?.startDate||""):String(body.startDate||"").trim(),endDate=body.endDate===undefined?String(current?.endDate||""):String(body.endDate||"").trim();if(!Number.isInteger(id)||name.length<2)return NextResponse.json({error:"البيانات غير صحيحة"},{status:400});if(startDate&&endDate&&startDate>endDate)return NextResponse.json({error:"تاريخ نهاية المشروع يجب أن يكون بعد تاريخ البداية"},{status:400});
  try{const r=await getRawDb().prepare("UPDATE projects SET name=?,start_date=?,end_date=? WHERE id=?").bind(name,startDate||null,endDate||null,id).run();return r.meta.changes?NextResponse.json({id,name,startDate,endDate}):NextResponse.json({error:"السجل غير موجود"},{status:404})}catch{return NextResponse.json({error:"تعذر التعديل أو الاسم مستخدم"},{status:409})}
}
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await requireRole(["admin"]))) return NextResponse.json({error:"هذه العملية للمدير فقط"},{status:403});
  await ensureNormalizedSettings();
  try{const id=Number((await params).id),db=getRawDb();const row=await db.prepare("SELECT name FROM projects WHERE id=?").bind(id).first<{name:string}>();if(!row)return NextResponse.json({error:"السجل غير موجود"},{status:404});const linked=await db.prepare("SELECT COUNT(*) AS count FROM employees WHERE project=?").bind(row.name).first<{count:number}>();const payroll=await db.prepare("SELECT COUNT(*) AS count FROM payroll_entries WHERE project=?").bind(row.name).first<{count:number}>();if(Number(linked?.count||0)>0||Number(payroll?.count||0)>0)return NextResponse.json({error:`لا يمكن حذف «${row.name}». يوجد موظفون أو سجلات رواتب مرتبطة بهذا المشروع. عالج الارتباطات أولًا.`},{status:409});await db.prepare("DELETE FROM projects WHERE id=?").bind(id).run();return NextResponse.json({ok:true})}catch(e){console.error(e);return NextResponse.json({error:"تعذر حذف المشروع"},{status:409})}
}

