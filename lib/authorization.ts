import {cookies} from "next/headers";
import {getRawDb} from "@/db";
export type Role="admin"|"editor"|"viewer";
export type AuthorizedUser={id:number;authUserId:string|null;username:string;email:string;name:string;role:Role;active:number};
const SESSION_COOKIE="prcs_hr_session";
const enc=new TextEncoder();
function b64(bytes:ArrayBuffer){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")}
function unb64(value:string){const s=value.replaceAll("-","+").replaceAll("_","/")+"=".repeat((4-value.length%4)%4);return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function secret(){const db=getRawDb();let row=await db.prepare("SELECT value FROM system_metadata WHERE key='session_secret'").first<{value:string}>();if(!row){const value=crypto.randomUUID()+crypto.randomUUID();await db.prepare("INSERT OR IGNORE INTO system_metadata (key,value) VALUES ('session_secret',?)").bind(value).run();row=await db.prepare("SELECT value FROM system_metadata WHERE key='session_secret'").first<{value:string}>()}return row?.value||"prcs-session-secret"}
async function sign(value:string){const key=await crypto.subtle.importKey("raw",enc.encode(await secret()),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64(await crypto.subtle.sign("HMAC",key,enc.encode(value)))}
export async function createSession(id:number){const value=b64(enc.encode(JSON.stringify({id,exp:Date.now()+43200000})));const token=`${value}.${await sign(value)}`;(await cookies()).set(SESSION_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:true,path:"/",maxAge:43200})}
export async function clearSession(){(await cookies()).delete(SESSION_COOKIE)}
export async function getAuthorizedUser():Promise<AuthorizedUser|null>{const raw=(await cookies()).get(SESSION_COOKIE)?.value||"";const [value,signature]=raw.split(".");if(!value||!signature||signature!==(await sign(value)))return null;let payload:{id:number;exp:number};try{payload=JSON.parse(new TextDecoder().decode(unb64(value)))}catch{return null}if(!Number.isInteger(payload.id)||payload.exp<Date.now())return null;const user=await getRawDb().prepare("SELECT id,auth_user_id AS authUserId,COALESCE(username,email) AS username,email,name,role,active FROM system_users WHERE id=? LIMIT 1").bind(payload.id).first<AuthorizedUser>();return user?.active?user:null}
export async function requireRole(roles:Role[]){const user=await getAuthorizedUser();if(!user)return null;return roles.includes(user.role)?user:null}
