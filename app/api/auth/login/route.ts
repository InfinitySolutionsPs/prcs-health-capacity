import {NextResponse} from "next/server";
import {getRawDb} from "@/db";
import {createSession} from "@/lib/authorization";
import {verifyPassword} from "@/lib/password";
import {ensureEmployeeFields} from "@/db/seed";
export const dynamic="force-dynamic";
export async function POST(req:Request){
  try{await ensureEmployeeFields();const b=await req.json();const username=String(b.username||"").trim().toLowerCase();const password=String(b.password||"");
    const user=await getRawDb().prepare("SELECT id,password_hash AS passwordHash FROM system_users WHERE (LOWER(username)=? OR LOWER(email)=?) AND active=1 LIMIT 1").bind(username,username).first<{id:number;passwordHash:string|null}>();
    if(!user?.passwordHash||!(await verifyPassword(password,user.passwordHash)))return NextResponse.json({error:"اسم المستخدم أو كلمة المرور غير صحيحة"},{status:401});
    await createSession(user.id);return NextResponse.json({ok:true});
  }catch(e){console.error(e);return NextResponse.json({error:"تعذر تسجيل الدخول حاليًا"},{status:500})}
}
