import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getRawDb } from "@/db";

export type Role="admin"|"editor"|"viewer";
export type AuthorizedUser={id:number;authUserId:string|null;email:string;name:string;role:Role;active:number};

export async function getAuthorizedUser():Promise<AuthorizedUser|null>{
  const identity=await getChatGPTUser();if(!identity)return null;
  const db=getRawDb();
  const count=await db.prepare("SELECT COUNT(*) AS count FROM system_users").first<{count:number}>();
  if(!count?.count){
    await db.prepare("INSERT OR IGNORE INTO system_users (auth_user_id,email,name,role,active) VALUES (?,?,?,?,1)").bind(identity.userId,identity.email.toLowerCase(),identity.displayName,"admin").run();
  }
  let user=await db.prepare("SELECT id,auth_user_id AS authUserId,email,name,role,active FROM system_users WHERE auth_user_id=? LIMIT 1").bind(identity.userId).first<AuthorizedUser>();
  if(!user){
    user=await db.prepare("SELECT id,auth_user_id AS authUserId,email,name,role,active FROM system_users WHERE LOWER(email)=LOWER(?) LIMIT 1").bind(identity.email).first<AuthorizedUser>();
    if(user&&!user.authUserId){await db.prepare("UPDATE system_users SET auth_user_id=? WHERE id=?").bind(identity.userId,user.id).run();user={...user,authUserId:identity.userId}}
  }
  return user?.active?user:null;
}

export async function requireRole(roles:Role[]){const user=await getAuthorizedUser();if(!user)return null;return roles.includes(user.role)?user:null}
