import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
export async function POST(req:Request){try{const body=await req.json();const name=String(body.name||"").trim();if(name.length<2)return NextResponse.json({error:"أدخل اسم المستشفى"},{status:400});const result=await getRawDb().prepare("INSERT INTO hospitals (name) VALUES (?)").bind(name).run();return NextResponse.json({id:result.meta.last_row_id,name},{status:201})}catch(error){console.error(error);return NextResponse.json({error:"اسم المستشفى موجود مسبقًا أو تعذر الحفظ"},{status:409})}}
