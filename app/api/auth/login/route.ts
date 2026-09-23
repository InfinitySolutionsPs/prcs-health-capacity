import {NextResponse} from "next/server";
import {getRawDb} from "@/db";
import {createSession} from "@/lib/authorization";
import {verifyPassword} from "@/lib/password";
async function ensureAuthSchema(){const db=getRawDb();const cols=(await db.prepare("PRAGMA table_info(system_users)").all()).results as {name:string}[];const names=new Set(cols.map(c=>c.name));if(!names.has("username"))await db.prepare("ALTER TABLE system_users ADD COLUMN username TEXT").run();if(!names.has("password_hash"))await db.prepare("ALTER TABLE system_users ADD COLUMN password_hash TEXT").run();return db}
export const dynamic="force-dynamic";
export async function POST(req:Request){
  try{const db=await ensureAuthSchema();const ready=await db.prepare("SELECT COUNT(*) AS count FROM system_users WHERE password_hash IS NOT NULL AND password_hash<>''").first<{count:number}>();if(!ready?.count)return NextResponse.json({error:"يجب إنشاء حساب المدير أولًا",needsSetup:true},{status:428});const b=await req.json();const username=String(b.username||"").trim().toLowerCase();const password=String(b.password||"");
    const user=db.prepare("SELECT id,password_hash AS passwordHash FROM system_users WHERE (LOWER(username)=? OR LOWER(email)=?) AND active=1 LIMIT 1").bind(username,username); const row=await user.first<{id:number;passwordHash:string|null}>();
    if(!row?.passwordHash||!(await verifyPassword(password,row.passwordHash)))return NextResponse.json({error:"اسم المستخدم أو كلمة المرور غير صحيحة"},{status:401});
    await createSession(row.id);return NextResponse.json({ok:true});
  }catch(e){console.error(e);return NextResponse.json({error:"تعذر تسجيل الدخول حاليًا"},{status:500})}
}
