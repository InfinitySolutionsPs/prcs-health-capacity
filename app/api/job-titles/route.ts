import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
export async function POST(req:Request){try{const name=String((await req.json()).name||"").trim();if(name.length<2)return NextResponse.json({error:"أدخل المسمى الوظيفي"},{status:400});const r=await getRawDb().prepare("INSERT INTO job_titles (name) VALUES (?)").bind(name).run();return NextResponse.json({id:r.meta.last_row_id,name,active:1},{status:201})}catch(e){console.error(e);return NextResponse.json({error:"المسمى موجود مسبقًا أو تعذر الحفظ"},{status:409})}}
