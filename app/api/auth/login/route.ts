import {NextResponse} from "next/server";
import {getRawDb} from "@/db";
import {createSession} from "@/lib/authorization";
import {verifyPassword} from "@/lib/password";
async function ensureAuthSchema(){const db=getRawDb();const cols=(await db.prepare("PRAGMA table_info(system_users)").all()).results as {name:string}[];const names=new Set(cols.map(c=>c.name));if(!names.has("username"))await db.prepare("ALTER TABLE system_users ADD COLUMN username TEXT").run();if(!names.has("password_hash"))await db.prepare("ALTER TABLE system_users ADD COLUMN password_hash TEXT").run();const initialPassword=String((globalThis as any).process?.env?.PRCS_INITIAL_ADMIN_PASSWORD||"");if(!initialPassword)throw new Error("PRCS_INITIAL_ADMIN_PASSWORD is not configured");const row=await db.prepare("SELECT COUNT(*) AS count FROM system_users").first<{count:number}>();const passwordHash=await (await import("@/lib/password")).hashPassword(initialPassword);if(!row?.count)await db.prepare("INSERT INTO system_users (username,email,name,role,active,password_hash) VALUES (?,?,?,?,1,?)").bind("admin","admin@prcs.local","مدير النظام","admin",passwordHash).run();else{const ready=await db.prepare("SELECT COUNT(*) AS count FROM system_users WHERE password_hash IS NOT NULL AND password_hash<>''").first<{count:number}>();if(!ready?.count)await db.prepare("UPDATE system_users SET username='admin',password_hash=?,active=1,role='admin' WHERE id=(SELECT id FROM system_users ORDER BY id LIMIT 1)").bind(passwordHash).run();}}
export const dynamic="force-dynamic";
export async function POST(req:Request){
  try{await ensureAuthSchema();const b=await req.json();const username=String(b.username||"").trim().toLowerCase();const password=String(b.password||"");
    const user=await getRawDb().prepare("SELECT id,password_hash AS passwordHash FROM system_users WHERE (LOWER(username)=? OR LOWER(email)=?) AND active=1 LIMIT 1").bind(username,username).first<{id:number;passwordHash:string|null}>();
    if(!user?.passwordHash||!(await verifyPassword(password,user.passwordHash)))return NextResponse.json({error:"اسم المستخدم أو كلمة المرور غير صحيحة"},{status:401});
    await createSession(user.id);return NextResponse.json({ok:true});
  }catch(e){console.error(e);return NextResponse.json({error:"تعذر تسجيل الدخول حاليًا"},{status:500})}
}
