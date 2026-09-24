"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowRight,
  Download,
  FileSpreadsheet,
  Pencil,
  Search,
  Upload,
  UserPlus,
  Users,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { SearchableFilterInput } from "@/components/searchable-filter";
type D = {
  employees: any[];
  summary: any;
  facilities: any[];
  statuses: any[];
  cadres: any[];
  payroll: any;
  jobCodes: any[];
};
export type Structure = { hospitals: any[]; administrations: any[]; departments: any[]; jobTitles?: any[]; cadreTypes?: any[]; projects?: any[] };
const LOCATION_OPTIONS: Record<string,string[]> = {
  "المحافظات الجنوبية": ["رفح", "خانيونس"],
  "المحافظة الوسطى": ["دير البلح", "النصيرات", "البريج", "المغازي"],
  "محافظة غزة": ["مدينة غزة"],
  "محافظة الشمال": ["جباليا", "بيت لاهيا", "بيت حانون"],
};
const n = new Intl.NumberFormat("en-US");
const txt = (v: any) => (v == null ? "" : String(v).trim());
async function responseError(res: Response, fallback: string) {
  const raw = await res.text();
  if (!raw.trim()) return fallback;
  try {
    const body = JSON.parse(raw) as { error?: unknown };
    return typeof body.error === "string" && body.error.trim()
      ? body.error
      : fallback;
  } catch {
    // Next/proxy errors can be returned as HTML or an empty body. Never mask
    // the actual import failure with "Unexpected end of JSON input".
    return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240) || fallback;
  }
}
const iso = (v: any) => {
  if (!v) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d
      ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`
      : "";
  }
  return txt(v).slice(0, 10);
};
export default function HR() {
  return <HRView />;
}

function employeeValue(row: any, ...keys: string[]) {
  for (const key of keys) {
    const direct = txt(row[key]);
    const value = direct || txt(Object.entries(row).find(([k]) => k.replace(/^\uFEFF/, "").trim() === key.trim())?.[1]);
    if (value) return value;
  }
  return "";
}

async function parseEmployeeWorkbook(file: File) {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const ws = wb.Sheets["الموظفون"] || wb.Sheets["بيانات مصدرة"] || wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("لم يتم العثور على ورقة الموظفين");
  return (XLSX.utils.sheet_to_json(ws) as any[]).map((r) => ({
    employeeNo: employeeValue(r, "رقم الموظف الأصلي", "الرقم"),
    employeeCode: employeeValue(r, "كود الموظف"),
    jobCode: employeeValue(r, "كود المسمى"),
    categoryCode: employeeValue(r, "كود الدائرة الرئيسية"),
    mainAdministration: employeeValue(r, "الدائرة الرئيسية"),
    fullName: employeeValue(r, "اسم الموظف"),
    nationalId: employeeValue(r, "رقم الهوية", "الهوية"),
    gender: employeeValue(r, "الجنس"),
    birthDate: iso(r["تاريخ الميلاد"] ?? r["ت ميلاد"]),
    cadreType: employeeValue(r, "نوع الكادر"),
    phone: employeeValue(r, "الجوال", "جوال"),
    maritalStatus: employeeValue(r, "الحالة الاجتماعية", "حالة اجتماعية"),
    hireDate: iso(r["تاريخ التعيين"] ?? r["ت تعيين"]),
    jobTitle: employeeValue(r, "المسمى الوظيفي", "الوظيفة المهنة", "الوظيفة  المهنة"),
    facility: employeeValue(r, "مركز العمل"),
    administration: employeeValue(r, "الدائرة الأصلية", "الدائرة"),
    department: employeeValue(r, "القسم"),
    qualification: employeeValue(r, "المؤهل العلمي"),
    specialty: employeeValue(r, "التخصص"),
    governorate: employeeValue(r, "المحافظة"),
    city: employeeValue(r, "المدينة"),
    contractStart: iso(r["بداية العقد"]),
    contractEnd: iso(r["نهاية العقد"]),
    endReason: employeeValue(r, "سبب نهاية الخدمة"),
    endDate: iso(r["تاريخ نهاية الخدمة"] ?? r["بتاريخ"]),
    status: employeeValue(r, "حالة الموظف") || "على رأس عمله",
    dualWorkplace: employeeValue(r, "مكان العمل المزدوج"),
  })).filter((r) => r.employeeNo && r.fullName);
}

export function EmployeeImportView({ onImported }: { onImported?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  async function importEmployees(file: File) {
    try {
      setBusy(true); setResult("");
      const rows = await parseEmployeeWorkbook(file);
      if (!rows.length) throw new Error("لم يتم العثور على سجلات صالحة في الملف");
      for (let i = 0; i < rows.length; i += 300) {
        const res = await fetch("/api/hr", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "employees", rows: rows.slice(i, i + 300) }) });
        if (!res.ok) throw new Error(await responseError(res, "فشل استيراد الموظفين"));
      }
      setResult(`تم استيراد ${n.format(rows.length)} موظف بنجاح`);
      toast.success(`تم استيراد ${n.format(rows.length)} موظف`);
      await onImported?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل استيراد الملف";
      setResult(message); toast.error(message);
    } finally { setBusy(false); }
  }
  return <main dir="rtl" className="text-right"><div className="mb-5"><h1 className="text-2xl font-extrabold">استيراد ملف الموظفين</h1><p className="mt-1 text-[#6b7681]">ارفع ملف Excel أو CSV يحتوي ورقة «الموظفون» ليتم إدخاله مباشرة إلى قاعدة البيانات.</p></div><section className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm"><div className="rounded-2xl border-2 border-dashed border-[#e1a4ae] bg-[#fff8f9] p-8 text-center"><FileSpreadsheet className="mx-auto mb-3 size-12 text-[#a50f27]"/><h2 className="text-lg font-bold">ملف الموظفين</h2><p className="mt-2 text-sm leading-7 text-[#6b7681]">يدعم الملف الموحد الذي يحتوي ورقة «الموظفون»، وكذلك ملف «بيانات مصدرة». يتم تحديث السجلات الموجودة حسب رقم الموظف.</p><label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#a50f27] px-5 py-3 font-bold text-white hover:bg-[#870c20]"><Upload className="size-5"/>{busy ? "جارٍ الاستيراد..." : "اختيار ملف الموظفين"}<input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) importEmployees(file); e.currentTarget.value = ""; }} /></label></div>{result && <div className="mt-4 rounded-xl bg-[#f7f9fa] p-4 text-center font-semibold">{result}</div>}<div className="mt-5 rounded-xl bg-[#f7f9fa] p-4 text-sm leading-7 text-[#52606c]"><strong>الحقول الأساسية:</strong> رقم الموظف، اسم الموظف، المسمى الوظيفي، مركز العمل، الدائرة، القسم، نوع الكادر، المحافظة والمدينة. السجلات المكررة يتم تحديثها بدل تكرارها.</div></section></main>;
}

export function HRView({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<D | null>(null),
    [q, setQ] = useState(""),
    [searchInput, setSearchInput] = useState(""),
    [filters, setFilters] = useState({ jobTitle: "", facility: "", administration: "", department: "", status: "", cadreType: "" }),
    [structure, setStructure] = useState<Structure>({ hospitals: [], administrations: [], departments: [], cadreTypes: [], projects: [] }),
    [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/hr?q=${encodeURIComponent(q)}&limit=10000`);
    if (r.ok) setData(await r.json());
  }, [q]);
  useEffect(() => { setPage(1); }, [q, filters.jobTitle, filters.facility, filters.administration, filters.department, filters.status, filters.cadreType]);
  useEffect(() => {
    const timer = window.setTimeout(() => setQ(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  useEffect(() => {
    load();
    fetch("/api/data").then((r) => r.ok ? r.json() : null).then((v) => v && setStructure(v)).catch(() => undefined);
  }, [load]);
  async function upload(file: File, type: "employees" | "payroll") {
    try {
      setBusy(true);
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      let rows: any[] = [];
      if (type === "employees") {
        const ws = wb.Sheets["بيانات مصدرة"] || wb.Sheets[wb.SheetNames[0]];
        rows = (XLSX.utils.sheet_to_json(ws) as any[])
          .map((r) => ({
            employeeNo: txt(r["الرقم"]),
            fullName: txt(r["اسم الموظف"]),
            nationalId: txt(r["الهوية"]),
            gender: txt(r["الجنس"]),
            birthDate: iso(r["ت ميلاد"]),
            cadreType: txt(r["نوع الكادر"]),
            phone: txt(r["جوال"]),
            maritalStatus: txt(r["حالة اجتماعية"]),
            hireDate: iso(r["ت تعيين"]),
            jobTitle: txt(r["الوظيفة  المهنة"] || r["الوظيفة المهنة"]),
            facility: txt(r["مركز العمل"]),
            administration: txt(r["الدائرة"]),
            department: txt(r["القسم"]),
            qualification: txt(r["المؤهل العلمي"]),
            specialty: txt(r["التخصص"]),
            governorate: txt(r["المحافظة"]),
            city: txt(r["المدينة"]),
            contractStart: iso(r["بداية العقد"]),
            contractEnd: iso(r["نهاية العقد"]),
            endReason: txt(r["سبب نهاية الخدمة"]),
            endDate: iso(r["بتاريخ"]),
            status: txt(r["حالة الموظف"]),
            dualWorkplace: txt(r["مكان العمل المزدوج"]),
            salary: txt(r["الراتب"] || r["الراتب الأساسي"]),
            jobGrade: txt(r["الدرجة الوظيفية"] || r["الدرجة"]),
            project: txt(r["المشروع"]),
            projectCoverage: txt(r["نسبة التغطية"] || r["نسبة تغطية المشروع"]),
          }))
          .filter((r) => r.employeeNo && r.fullName);
      } else {
        for (const sn of wb.SheetNames.filter((x) => x.startsWith("شهر"))) {
          const a = XLSX.utils.sheet_to_json(wb.Sheets[sn], {
            range: 2,
          }) as any[];
          const period = sn.match(/(\d+).*?(2026)/) || [];
          rows.push(
            ...a
              .map((r) => ({
                employeeNo: txt(r["الرقم الوظيفي"]),
                employeeName: txt(r["الاسم"]),
                period: period[2]
                  ? `${period[2]}-${String(period[1]).padStart(2, "0")}`
                  : sn,
                project: txt(r["المشروع"]),
                facility: txt(r["تسميات الصفوف"] || r["المركز"]),
                administration: txt(r["المركز"] || r["الدائرة"]),
                gross: Number(r["الإجمالي الكلي"] || 0),
                deductions: Number(r["اجمالي الخصم"] || 0),
                net: Number(r["الصافي"] || 0),
              }))
              .filter((r) => r.employeeNo && r.project),
          );
        }
      }
      for (let i = 0; i < rows.length; i += 300) {
        const res = await fetch("/api/hr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, rows: rows.slice(i, i + 300) }),
        });
        if (!res.ok)
          throw new Error(await responseError(res, "فشل الاستيراد"));
      }
      toast.success(`تم استيراد ${n.format(rows.length)} سجل`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الاستيراد");
    } finally {
      setBusy(false);
    }
  }
  async function uploadUnified(file: File) {
    try {
      setBusy(true);
      const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const employeeSheet = wb.Sheets["الموظفون"];
      const payrollSheet = wb.Sheets["الرواتب والمشاريع"];
      if (!employeeSheet || !payrollSheet)
        throw new Error(
          "الملف الموحّد يجب أن يحتوي ورقتي الموظفون والرواتب والمشاريع",
        );
      const employees = (XLSX.utils.sheet_to_json(employeeSheet) as any[])
        .map((r) => ({
          employeeNo: txt(r["رقم الموظف الأصلي"]),
          employeeCode: txt(r["كود الموظف"]),
          jobCode: txt(r["كود المسمى"]),
          categoryCode: txt(r["كود الدائرة الرئيسية"]),
          mainAdministration: txt(r["الدائرة الرئيسية"]),
          fullName: txt(r["اسم الموظف"]),
          nationalId: txt(r["رقم الهوية"]),
          gender: txt(r["الجنس"]),
          birthDate: iso(r["تاريخ الميلاد"]),
          cadreType: txt(r["نوع الكادر"]),
          phone: txt(r["الجوال"]),
          maritalStatus: txt(r["الحالة الاجتماعية"]),
          hireDate: iso(r["تاريخ التعيين"]),
          jobTitle: txt(r["المسمى الوظيفي"]),
          facility: txt(r["مركز العمل"]),
          administration: txt(r["الدائرة الأصلية"]),
          department: txt(r["القسم"]),
          qualification: txt(r["المؤهل العلمي"]),
          specialty: txt(r["التخصص"]),
          governorate: txt(r["المحافظة"]),
          city: txt(r["المدينة"]),
          contractStart: iso(r["بداية العقد"]),
          contractEnd: iso(r["نهاية العقد"]),
          endReason: txt(r["سبب نهاية الخدمة"]),
          endDate: iso(r["تاريخ نهاية الخدمة"]),
          status: txt(r["حالة الموظف"]),
          dualWorkplace: txt(r["مكان العمل المزدوج"]),
          salary: txt(r["الراتب"] || r["الراتب الأساسي"]),
          jobGrade: txt(r["الدرجة الوظيفية"] || r["الدرجة"]),
          project: txt(r["المشروع"]),
          projectCoverage: txt(r["نسبة التغطية"] || r["نسبة تغطية المشروع"]),
        }))
        .filter((r) => r.employeeNo && r.fullName);
      const payroll = (XLSX.utils.sheet_to_json(payrollSheet) as any[])
        .map((r) => ({
          employeeNo: txt(r["رقم الموظف الأصلي"]),
          employeeName: txt(r["اسم الموظف"]),
          period: txt(r["الفترة"]),
          project: txt(r["المشروع"]),
          facility: txt(r["المركز"]),
          administration: txt(r["الدائرة"]),
          gross: Number(r["الإجمالي الكلي (شيكل)"] || 0),
          deductions: Number(r["إجمالي الخصم (شيكل)"] || 0),
          net: Number(r["الصافي (شيكل)"] || 0),
        }))
        .filter((r) => r.employeeNo && r.project);
      for (const [type, rows] of [
        ["employees", employees],
        ["payroll", payroll],
      ] as const)
        for (let i = 0; i < rows.length; i += 300) {
          const res = await fetch("/api/hr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, rows: rows.slice(i, i + 300) }),
          });
          if (!res.ok)
            throw new Error(await responseError(res, "فشل الاستيراد"));
        }
      toast.success(
        `تم استيراد ${n.format(employees.length)} موظف و${n.format(payroll.length)} سجل راتب`,
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل استيراد الملف الموحّد");
    } finally {
      setBusy(false);
    }
  }
  const filteredEmployees = useMemo(() => (data?.employees || []).filter((e: any) => {
    const employeeField: Record<string, string> = {
      jobTitle: "job_title",
      cadreType: "cadre_type",
      facility: "facility",
      administration: "administration",
      department: "department",
      status: "status",
    };
    const match = (key: string) => {
      const selected = filters[key as keyof typeof filters];
      return !selected || String(e[employeeField[key] || key] || "") === selected;
    };
    return match("jobTitle") && match("facility") && match("administration") && match("department") && match("status") && match("cadreType");
  }), [data?.employees, filters]);
  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / pageSize));
  const visibleEmployees = filteredEmployees.slice((page - 1) * pageSize, page * pageSize);
  const cadreOptions = (data?.cadres || []).map((r: any) => String(r.name)).filter(Boolean);
  const exportFields = [
    ["employee_no", "رقم الموظف"], ["employee_code", "كود الموظف"], ["full_name", "اسم الموظف"],
    ["facility", "مركز العمل"], ["administration", "الإدارة"], ["department", "القسم"],
    ["job_title", "المسمى الوظيفي"], ["cadre_type", "نوع الكادر"], ["status", "الحالة"],
    ["salary", "الراتب"], ["job_grade", "الدرجة الوظيفية"], ["project", "المشروع"], ["project_coverage", "نسبة التغطية"],
  ] as const;
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedExportFields, setSelectedExportFields] = useState<string[]>(["employee_no", "full_name", "facility", "administration", "department", "job_title", "cadre_type", "status"]);
  function exportEmployees(){
    const administrationOrder = ["إدارة المركز", "الإدارة الطبية", "الإدارة التمريضية", "الإدارة الفنية", "الإدارة الفنية المساعدة"];
    const rank = (e:any) => { const a=String(e.administration||e.main_administration||""); const i=administrationOrder.findIndex(x=>a.includes(x)); return i<0?administrationOrder.length:i; };
    const sorted=[...filteredEmployees].sort((a,b)=>{
      const byAdmin=rank(a)-rank(b); if(byAdmin)return byAdmin;
      const aa=String(a.administration||a.main_administration||""), bb=String(b.administration||b.main_administration||"");
      const aEmergency=aa.includes("الطبية")&&/طوارئ|استقبال/.test(String(a.job_title||""));
      const bEmergency=bb.includes("الطبية")&&/طوارئ|استقبال/.test(String(b.job_title||""));
      if(aEmergency!==bEmergency)return aEmergency?-1:1;
      return aa.localeCompare(bb,"ar")||String(a.full_name||"").localeCompare(String(b.full_name||""),"ar");
    });
    const rows=sorted.map((e:any)=>Object.fromEntries(selectedExportFields.map(key=>[exportFields.find(x=>x[0]===key)?.[1]||key,e[key]??""])));
    const ws=XLSX.utils.json_to_sheet(rows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"الموظفون"); XLSX.writeFile(wb,"نتائج_بحث_الموظفين.xlsx"); setExportOpen(false);
  }
  return (
    <main
      dir="rtl"
      className={
        embedded
          ? "text-right"
          : "min-h-screen bg-[#f3f6f8] p-4 text-right lg:p-8"
      }
    >
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold">
              الموظفون والموارد البشرية
            </h1>
            <p className="mt-1 text-[#6b7681]">
              سجل الموظفين والإحصائيات والرواتب والمشاريع
            </p>
          </div>
          <div className="flex items-center gap-3">
            <EmployeeDialog jobCodes={data?.jobCodes || []} structure={structure} cadreOptions={cadreOptions} onSaved={load} />
            {!embedded && (
              <a
                href="/"
                target="_top"
                className="flex items-center gap-2 text-[#a50f27]"
              >
                <ArrowRight />
                القدرة التشغيلية
              </a>
            )}
          </div>
        </div>
        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Card t="كل الموظفين" v={data?.summary?.total} />
          <Card t="على رأس العمل" v={data?.summary?.active} />
          <Card t="المراكز" v={data?.summary?.facilities} />
          <Card t="المسميات" v={data?.summary?.jobs} />
          <Card t="مشاريع الرواتب" v={data?.payroll?.projects} />
          <Card t="إجمالي الرواتب" v={data?.payroll?.gross} money />
        </section>
        <section className="mb-5 rounded-2xl border bg-white p-5">
          <h2 className="mb-3 font-bold text-[#a50f27]">فلاتر بحث الموظفين</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([ ["jobTitle", "المسمى الوظيفي"], ["facility", "مركز العمل"], ["administration", "الدائرة"], ["department", "القسم"], ["status", "حالة الموظف"], ["cadreType", "نوع الكادر"] ] as const).map(([key, label]) => {
              const values = key === "cadreType" ? cadreOptions : Array.from(new Set((data?.employees || []).map((e: any) => e[key === "jobTitle" ? "job_title" : key]).filter(Boolean))).sort();
              return <SearchableFilterInput key={key} value={filters[key]} onChange={(value) => setFilters((f) => ({ ...f, [key]: value }))} placeholder={label} allLabel={`كل ${label}`} options={values.map(String)} />;
            })}
            <Button type="button" variant="outline" onClick={() => { setSearchInput(""); setQ(""); setFilters({ jobTitle: "", facility: "", administration: "", department: "", status: "", cadreType: "" }); }}>مسح الفلاتر</Button>
          </div>
        </section>
        <section className="mb-5 grid gap-4 lg:grid-cols-3">
          <Breakdown title="الموظفون حسب المركز" rows={data?.facilities} />
          <Breakdown title="حسب حالة الموظف" rows={data?.statuses} />
          <Breakdown title="حسب نوع الكادر" rows={data?.cadres} />
        </section>
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold">سجل الموظفين <span className="text-sm font-normal text-[#6b7681]">({n.format(filteredEmployees.length)})</span></h2>
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3 top-3 size-4 text-gray-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ابحث بالاسم أو الرقم أو المركز"
                className="pr-9"
              />
              <Button type="button" onClick={() => setExportOpen(true)} className="mt-2 w-full gap-2 bg-[#18794e] hover:bg-[#12623e]"><Download className="size-4"/>تصدير نتائج البحث Excel</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم الموظف</TableHead>
                  <TableHead className="text-right">المركز</TableHead>
                  <TableHead className="text-right">المسمى</TableHead>
                  <TableHead className="text-right">نوع الكادر</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="w-16 text-center">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEmployees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-semibold">
                      {e.full_name}
                    </TableCell>
                    <TableCell>{e.facility}</TableCell>
                    <TableCell>{e.job_title}</TableCell>
                    <TableCell>{e.cadre_type}</TableCell>
                    <TableCell>{e.status}</TableCell>
                    <TableCell className="text-center">
                      <EmployeeDialog
                        employee={e}
                        jobCodes={data?.jobCodes || []}
                        structure={structure}
                        cadreOptions={cadreOptions}
                        onSaved={load}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-[#fafbfc] p-3 text-sm">
            <div className="flex items-center gap-2"><span>عدد الصفوف:</span><select value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1)}} className="rounded-md border bg-white px-2 py-1"><option value="25">25</option><option value="50">50</option><option value="100">100</option></select><span>من {n.format(filteredEmployees.length)}</span></div>
            <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>السابق</Button><span>صفحة {page} من {totalPages}</span><Button type="button" variant="outline" size="sm" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>التالي</Button></div>
          </div>
        </section>
      </div>
      <Dialog open={exportOpen} onOpenChange={setExportOpen}><DialogContent dir="rtl" className="text-right sm:max-w-lg"><DialogHeader className="text-right"><DialogTitle>اختيار أعمدة التصدير</DialogTitle><DialogDescription>سيتم تصدير نتائج البحث الحالية مرتبة حسب الإدارة.</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-2">{exportFields.map(([key,label])=><label key={key} className="flex items-center gap-2 rounded-lg bg-[#f7f9fa] p-2"><input type="checkbox" checked={selectedExportFields.includes(key)} onChange={e=>setSelectedExportFields(v=>e.target.checked?[...v,key]:v.filter(x=>x!==key))}/><span>{label}</span></label>)}</div><DialogFooter><Button type="button" disabled={!selectedExportFields.length} onClick={exportEmployees} className="w-full gap-2 bg-[#18794e] hover:bg-[#12623e]"><FileSpreadsheet className="size-4"/>تنزيل الملف</Button></DialogFooter></DialogContent></Dialog>
      <Toaster richColors />
    </main>
  );
}
function Card({ t, v, money }: { t: string; v: any; money?: boolean }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <p className="text-sm text-[#6b7681]">{t}</p>
      <strong className="mt-2 block text-2xl">
        {v == null ? "—" : n.format(Number(v))}
        {money ? " ₪" : ""}
      </strong>
    </div>
  );
}
function ImportBox({
  title,
  note,
  onFile,
  busy,
}: {
  title: string;
  note: string;
  onFile: (f: File) => void;
  busy: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-xl border border-dashed border-[#d9a6af] bg-[#fffafb] p-4">
      <span className="grid size-11 place-items-center rounded-xl bg-[#fbecef] text-[#a50f27]">
        <Upload />
      </span>
      <span className="flex-1">
        <strong>{title}</strong>
        <small className="mt-1 block text-[#6b7681]">{note}</small>
      </span>
      <input
        type="file"
        accept=".xlsx,.xls"
        disabled={busy}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <FileSpreadsheet className="text-[#a50f27]" />
    </label>
  );
}
function Breakdown({ title, rows = [] }: { title: string; rows?: any[] }) {
  return (
    <div className="rounded-2xl border bg-white p-4">
      <h3 className="mb-3 font-bold">{title}</h3>
      <div className="max-h-64 space-y-2 overflow-auto">
        {rows.map((r, i) => (
          <div
            key={i}
            className="flex justify-between rounded-lg bg-[#f7f9fa] px-3 py-2"
          >
            <span>{r.name || "غير محدد"}</span>
            <strong>{n.format(r.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

const emptyEmployee = {
  firstName: "",
  fatherName: "",
  grandfatherName: "",
  familyName: "",
  nationalId: "",
  gender: "",
  birthDate: "",
  cadreType: "",
  phone: "",
  maritalStatus: "",
  hireDate: "",
  jobCode: "",
  jobTitle: "",
  categoryCode: "",
  mainAdministration: "",
  facility: "",
  administration: "",
  department: "",
  qualification: "",
  specialty: "",
  governorate: "",
  city: "",
  contractStart: "",
  contractEnd: "",
  endReason: "",
  endDate: "",
  status: "على رأس عمله",
  dualWorkplace: "",
  salary: "",
  jobGrade: "",
  project: "",
  projectCoverage: "",
};

function employeeForm(employee?: any) {
  if (!employee) return { ...emptyEmployee };
  const parts = txt(employee.full_name).split(/\s+/).filter(Boolean);
  return {
    firstName: employee.first_name || parts[0] || "",
    fatherName: employee.father_name || parts[1] || "",
    grandfatherName: employee.grandfather_name || parts[2] || "",
    familyName: employee.family_name || parts.slice(3).join(" ") || "",
    nationalId: employee.national_id || "",
    gender: employee.gender || "",
    birthDate: employee.birth_date || "",
    cadreType: employee.cadre_type || "",
    phone: employee.phone || "",
    maritalStatus: employee.marital_status || "",
    hireDate: employee.hire_date || "",
    jobCode: employee.job_code || "",
    jobTitle: employee.job_title || "",
    categoryCode: employee.category_code || "",
    mainAdministration: employee.main_administration || "",
    facility: employee.facility || "",
    administration: employee.administration || "",
    department: employee.department || "",
    qualification: employee.qualification || "",
    specialty: employee.specialty || "",
    governorate: employee.governorate || "",
    city: employee.city || "",
    contractStart: employee.contract_start || "",
    contractEnd: employee.contract_end || "",
    endReason: employee.end_reason || "",
    endDate: employee.end_date || "",
    status: employee.status || "على رأس عمله",
    dualWorkplace: employee.dual_workplace || "",
    salary: employee.salary || "",
    jobGrade: employee.job_grade || "",
    project: employee.project || "",
    projectCoverage: employee.project_coverage || "",
  };
}

export function EmployeeDialog({
  employee,
  jobCodes,
  structure,
  cadreOptions,
  onSaved,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: {
  employee?: any;
  jobCodes: any[];
  structure: Structure;
  cadreOptions: string[];
  onSaved: () => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const editing = Boolean(employee?.id);
  const [open, setOpen] = useState(false);
  const dialogOpen = controlledOpen ?? open;
  const setDialogOpen = (next: boolean) => {
    if (controlledOpen === undefined) setOpen(next);
    controlledOnOpenChange?.(next);
  };
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => employeeForm(employee));
  const jobOptions = [...jobCodes, ...(structure.jobTitles || []).map((j: any) => ({ jobCode: j.jobCode, jobTitle: j.name, categoryCode: j.categoryCode, mainAdministration: j.mainAdministration }))]
    .filter((j: any) => j.jobCode || j.jobTitle)
    .filter((j: any, i: number, all: any[]) => all.findIndex((x) => (x.jobCode || x.jobTitle) === (j.jobCode || j.jobTitle)) === i);
  const set = (key: string, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  function changeJob(jobCode: string) {
    const job = jobOptions.find((item) => (item.jobCode || item.jobTitle) === jobCode);
    setForm((current) => ({
      ...current,
      jobCode,
      jobTitle: job?.jobTitle || "",
      categoryCode: job?.categoryCode || "",
      mainAdministration: job?.mainAdministration || "",
    }));
  }
  const selectedHospital = structure.hospitals.find((h) => h.name === form.facility);
  const administrations = structure.administrations.filter((a) => !selectedHospital || a.hospitalId === selectedHospital.id);
  const selectedAdministration = administrations.find((a) => a.name === form.administration);
  const departments = structure.departments.filter((d) => (!selectedHospital || d.hospitalId === selectedHospital.id) && (!selectedAdministration || d.administrationId === selectedAdministration.id));
  const governorates = Object.keys(LOCATION_OPTIONS);
  const selectedCities = [...new Set([...(LOCATION_OPTIONS[form.governorate] || []), form.city].filter(Boolean))];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await fetch(editing ? `/api/hr/${employee.id}` : "/api/hr", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? form : { type: "employee", row: form }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "تعذر حفظ بيانات الموظف");
      toast.success(
        editing
          ? "تم تحديث بيانات الموظف"
          : `تمت إضافة الموظف بالكود ${result.employeeCode}`,
      );
      setDialogOpen(false);
      if (!editing) setForm({ ...emptyEmployee });
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "تعذر حفظ بيانات الموظف",
      );
    } finally {
      setSaving(false);
    }
  }

  const validName = [
    form.firstName,
    form.fatherName,
    form.grandfatherName,
    form.familyName,
  ].every((part) => part.trim());

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(next) => {
        setDialogOpen(next);
        if (next) setForm(employeeForm(employee));
      }}
    >
      {!hideTrigger && <DialogTrigger asChild>
        {editing ? (
          <Button variant="ghost" size="icon" title="تعديل الموظف">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button className="gap-2 bg-[#a50f27] hover:bg-[#870c20]">
            <UserPlus className="size-5" />
            إضافة موظف
          </Button>
        )}
      </DialogTrigger>}
      <DialogContent
        dir="rtl"
        className="max-h-[94dvh] w-[calc(100%-1rem)] overflow-y-auto p-5 text-right text-[1.02rem] sm:w-full sm:max-w-6xl sm:p-7"
      >
        <DialogHeader className="text-right sm:text-right">
          <DialogTitle>
            {editing ? "تعديل بيانات الموظف" : "إضافة موظف جديد"}
          </DialogTitle>
          <DialogDescription>
            أدخل البيانات كاملة. يولّد النظام كود الموظف تلقائياً وفق المسمى
            الوظيفي.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-5">
          {editing && (
            <div className="grid gap-3 rounded-xl bg-[#f7f9fa] p-3 sm:grid-cols-2">
              <ReadOnly label="رقم الموظف" value={employee.employee_no} />
              <ReadOnly
                label="كود الموظف"
                value={employee.employee_code || "يولّد عند الحفظ"}
              />
            </div>
          )}

          <FieldGroup title="الاسم الرباعي" className="sm:grid-cols-4">
            <Field
              label="الاسم الأول *"
              value={form.firstName}
              onChange={(v) => set("firstName", v)}
            />
            <Field
              label="اسم الأب *"
              value={form.fatherName}
              onChange={(v) => set("fatherName", v)}
            />
            <Field
              label="اسم الجد *"
              value={form.grandfatherName}
              onChange={(v) => set("grandfatherName", v)}
            />
            <Field
              label="اسم العائلة *"
              value={form.familyName}
              onChange={(v) => set("familyName", v)}
            />
          </FieldGroup>

          <FieldGroup
            title="البيانات الشخصية"
            className="sm:grid-cols-3 lg:grid-cols-4"
          >
            <Field
              label="رقم الهوية"
              value={form.nationalId}
              onChange={(v) => set("nationalId", v)}
            />
            <Choice
              label="الجنس"
              value={form.gender}
              onChange={(v) => set("gender", v)}
              options={["ذكر", "أنثى"]}
            />
            <Field
              label="تاريخ الميلاد"
              type="date"
              value={form.birthDate}
              onChange={(v) => set("birthDate", v)}
            />
            <Field
              label="رقم الجوال"
              type="tel"
              value={form.phone}
              onChange={(v) => set("phone", v)}
            />
            <Choice
              label="الحالة الاجتماعية"
              value={form.maritalStatus}
              onChange={(v) => set("maritalStatus", v)}
              options={["أعزب", "متزوج", "مطلق", "أرمل"]}
            />
            <FixedSelect label="المحافظة" value={form.governorate} onChange={(v) => { set("governorate", v); set("city", ""); }} options={[...new Set([...governorates, form.governorate].filter(Boolean))]} />
            <FixedSelect label="المدينة" value={form.city} onChange={(v) => set("city", v)} options={selectedCities} />
          </FieldGroup>

          <FieldGroup
            title="البيانات الوظيفية"
            className="sm:grid-cols-2 lg:grid-cols-3"
          >
            <label className="space-y-1.5 lg:col-span-2">
              <span className="block text-sm font-medium">
                المسمى الوظيفي *
              </span>
              <select
                value={form.jobCode}
                onChange={(e) => changeJob(e.target.value)}
                className="h-10 w-full rounded-md border bg-white px-3 text-right"
              >
                <option value="">اختر المسمى الوظيفي</option>
                {jobOptions.map((job) => (
                  <option key={job.jobCode || job.jobTitle} value={job.jobCode || job.jobTitle}>
                    {job.mainAdministration || ""}{job.mainAdministration ? " — " : ""}{job.jobTitle || job.name} {job.jobCode ? `(${job.jobCode})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <ReadOnly
              label="الدائرة الرئيسية"
              value={form.mainAdministration || "تُحدد من المسمى"}
            />
            <FixedSelect label="مركز العمل" value={form.facility} onChange={(v) => { set("facility", v); set("administration", ""); set("department", ""); }} options={structure.hospitals.map((h) => h.name)} />
            <FixedSelect label="الدائرة" value={form.administration} onChange={(v) => { set("administration", v); set("department", ""); }} options={administrations.map((a) => a.name)} />
            <FixedSelect label="القسم" value={form.department} onChange={(v) => set("department", v)} options={departments.map((d) => d.name)} />
            <FixedSelect label="نوع الكادر" value={form.cadreType} onChange={(v) => set("cadreType", v)} options={[...cadreOptions, form.cadreType].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)} />
            <Field
              label="تاريخ التعيين"
              type="date"
              value={form.hireDate}
              onChange={(v) => set("hireDate", v)}
            />
            <Choice
              label="حالة الموظف"
              value={form.status}
              onChange={(v) => set("status", v)}
              options={[
                "على رأس عمله",
                "موقوف",
                "منتهية خدماته",
                "إجازة بدون راتب",
              ]}
            />
            <Field
              label="المؤهل العلمي"
              value={form.qualification}
              onChange={(v) => set("qualification", v)}
            />
            <Field
              label="التخصص"
              value={form.specialty}
              onChange={(v) => set("specialty", v)}
            />
            <Field
              label="مكان العمل المزدوج"
              value={form.dualWorkplace}
              onChange={(v) => set("dualWorkplace", v)}
            />
          </FieldGroup>

          <FieldGroup
            title="البيانات المالية وتمويل الوظيفة"
            className="sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field label="راتب الموظف (شيكل)" type="number" value={form.salary} onChange={(v) => set("salary", v)} />
            <Field label="الدرجة الوظيفية" value={form.jobGrade} onChange={(v) => set("jobGrade", v)} />
            <FixedSelect label="المشروع المحمّل عليه" value={form.project} onChange={(v) => set("project", v)} options={[...(structure.projects || []).map((p: any) => p.name), form.project].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)} />
            <Field label="نسبة تغطية الراتب على المشروع (%)" type="number" value={form.projectCoverage} onChange={(v) => set("projectCoverage", v)} />
          </FieldGroup>

          <FieldGroup
            title="بيانات العقد ونهاية الخدمة"
            className="sm:grid-cols-2 lg:grid-cols-4"
          >
            <Field
              label="بداية العقد"
              type="date"
              value={form.contractStart}
              onChange={(v) => set("contractStart", v)}
            />
            <Field
              label="نهاية العقد"
              type="date"
              value={form.contractEnd}
              onChange={(v) => set("contractEnd", v)}
            />
            <Field
              label="سبب نهاية الخدمة"
              value={form.endReason}
              onChange={(v) => set("endReason", v)}
            />
            <Field
              label="تاريخ نهاية الخدمة"
              type="date"
              value={form.endDate}
              onChange={(v) => set("endDate", v)}
            />
          </FieldGroup>

          <DialogFooter className="border-t bg-white pt-4 sm:justify-start">
            <Button
              type="submit"
              disabled={saving || !validName || !form.jobCode}
              className="h-auto min-h-11 w-full whitespace-normal bg-[#a50f27] px-4 py-2.5 text-center leading-6 hover:bg-[#870c20] sm:w-auto"
            >
              {saving
                ? "جارٍ الحفظ..."
                : editing
                  ? "حفظ التعديلات"
                  : "إضافة الموظف وتوليد الكود"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldGroup({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border p-4">
      <legend className="px-2 font-bold text-[#a50f27]">{title}</legend>
      <div className={`grid gap-3 ${className || ""}`}>{children}</div>
    </fieldset>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-right"
      />
    </label>
  );
}

function Choice({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border bg-white px-3 text-right"
      >
        <option value="">اختر</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FixedSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full rounded-md border bg-white px-3 text-right" disabled={!options.length}>
        <option value="">{options.length ? `اختر ${label}` : `لا توجد ${label} مضافة`}</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <label className="space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      <div className="min-h-10 rounded-md border bg-[#f7f9fa] px-3 py-2 text-sm">
        {value}
      </div>
    </label>
  );
}

