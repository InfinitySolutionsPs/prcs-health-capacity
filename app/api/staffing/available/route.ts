import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { requireRole } from "@/lib/authorization";
import { getCurrentEmployeeCount } from "@/lib/staffing-match";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await requireRole(["admin", "editor"])))
    return NextResponse.json({ error: "ليس لديك صلاحية عرض بيانات الاحتياج" }, { status: 403 });

  const url = new URL(req.url);
  const departmentId = Number(url.searchParams.get("departmentId"));
  const jobTitleId = Number(url.searchParams.get("jobTitleId"));
  if (!Number.isInteger(departmentId) || departmentId < 1 || !Number.isInteger(jobTitleId) || jobTitleId < 1)
    return NextResponse.json({ error: "اختر القسم والمسمى الوظيفي أولًا" }, { status: 400 });

  try {
    const result = await getCurrentEmployeeCount(getRawDb(), departmentId, jobTitleId);
    if (!result) return NextResponse.json({ error: "القسم أو المسمى الوظيفي غير موجود" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to count employees for staffing entry", error);
    return NextResponse.json({ error: "تعذر قراءة الموظفين المطابقين للاحتياج" }, { status: 500 });
  }
}
