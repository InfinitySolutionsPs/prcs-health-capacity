import {NextResponse} from "next/server";import {clearSession} from "@/lib/authorization";
export async function POST(){await clearSession();return NextResponse.json({ok:true})}
export async function GET(){await clearSession();return NextResponse.redirect(new URL("/login",process.env.PUBLIC_URL||"http://localhost:3000"))}
