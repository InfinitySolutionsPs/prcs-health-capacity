const enc=new TextEncoder();
function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,"0")).join("")}
export async function hashPassword(password:string,salt=crypto.randomUUID()){
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:120000,hash:"SHA-256"},key,256);
  return `${salt}:${hex(bits)}`;
}
export async function verifyPassword(password:string,stored:string){
  const [salt,expected]=String(stored||"").split(":");if(!salt||!expected)return false;
  const actual=(await hashPassword(password,salt)).split(":")[1]||"";
  return actual.length===expected.length && [...actual].every((c,i)=>c===expected[i]);
}
