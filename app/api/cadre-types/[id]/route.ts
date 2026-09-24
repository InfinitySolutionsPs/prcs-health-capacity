import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureNormalizedSettings } from "@/db/seed";
import { requireRole } from "@/lib/authorization";

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await requireRole(["admin"]))) return NextResponse.json({error:"هذه العملية للمدير فقط"},{status:403});
  await ensureNormalizedSettings();
  const id=Number((await params).id),name=String((await req.json()).name||"").trim();
  if(!Number.isInteger(id)||name.length<2) return NextResponse.json({error:"الاسم غير صحيح"},{status:400});
  try{const r=await getRawDb().prepare("UPDATE cadre_types SET name=? WHERE id=?").bind(name,id).run();return r.meta.changes?NextResponse.json({id,name}):NextResponse.json({error:"السجل غير موجود"},{status:404})}catch{return NextResponse.json({error:"تعذر التعديل أو الاسم مستخدم"},{status:409})}
}
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await requireRole(["admin"]))) return NextResponse.json({error:"هذه العملية للمدير فقط"},{status:403});
  await ensureNormalizedSettings();
  try{const id=Number((await params).id),db=getRawDb();const row=await db.prepare("SELECT name FROM cadre_types WHERE id=?").bind(id).first<{name:string}>();if(!row)return NextResponse.json({error:"السجل غير موجود"},{status:404});const linked=await db.prepare("SELECT COUNT(*) AS count FROM employees WHERE cadre_type=?").bind(row.name).first<{count:number}>();if(Number(linked?.count||0)>0)return NextResponse.json({error:`لا يمكن حذف «${row.name}». يوجد موظفون يستخدمون نوع الكادر هذا. عالج الموظفين المرتبطين أولًا.`},{status:409});await db.prepare("DELETE FROM cadre_types WHERE id=?").bind(id).run();return NextResponse.json({ok:true})}catch(e){console.error(e);return NextResponse.json({error:"تعذر حذف نوع الكادر"},{status:409})}
}

