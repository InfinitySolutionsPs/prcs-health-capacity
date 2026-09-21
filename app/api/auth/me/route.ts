import {NextResponse} from "next/server";import {getAuthorizedUser} from "@/lib/authorization";
export const dynamic="force-dynamic";
export async function GET(){const user=await getAuthorizedUser();if(!user)return NextResponse.json({error:"غير مصرح لك بالدخول"},{status:401});return NextResponse.json({user})}
