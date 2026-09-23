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
