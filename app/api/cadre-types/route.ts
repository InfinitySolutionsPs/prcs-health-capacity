import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { ensureNormalizedSettings } from "@/db/seed";
import { requireRole } from "@/lib/authorization";

export async function GET(){
  if(!(await requireRole(["admin","editor","viewer"]))) return NextResponse.json({error:"غير مصرح"},{status:403});
  await ensureNormalizedSettings();
  return NextResponse.json({items:(await getRawDb().prepare("SELECT id,name FROM cadre_types ORDER BY name").all()).results});
}

export async function POST(req:Request){
  if(!(await requireRole(["admin"]))) return NextResponse.json({error:"هذه العملية للمدير فقط"},{status:403});
  try{
    await ensureNormalizedSettings();
    const name=String((await req.json()).name||"").trim();
    if(name.length<2) return NextResponse.json({error:"أدخل اسم نوع الكادر"},{status:400});
    const r=await getRawDb().prepare("INSERT INTO cadre_types (name) VALUES (?)").bind(name).run();
    return NextResponse.json({id:r.meta.last_row_id,name},{status:201});
  }catch{ return NextResponse.json({error:"نوع الكادر موجود مسبقًا أو تعذر الحفظ"},{status:409}); }
}

