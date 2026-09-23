"use client";
import { useCallback, useEffect, useState } from "react";
import * as XLSX from "xlsx";
import {
  ArrowRight,
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
type D = {
  employees: any[];
  summary: any;
  facilities: any[];
  statuses: any[];
  cadres: any[];
  payroll: any;
  jobCodes: any[];
};
type Structure = { hospitals: any[]; administrations: any[]; departments: any[]; jobTitles?: any[]; cadreTypes?: any[] };
const LOCATION_OPTIONS: Record<string,string[]> = {
  "المحافظات الجنوبية": ["رفح", "خانيونس"],
  "المحافظة الوسطى": ["دير البلح", "النصيرات", "البريج", "المغازي"],
  "محافظة غزة": ["مدينة غزة"],
  "محافظة الشمال": ["جباليا", "بيت لاهيا", "بيت حانون"],
};
const n = new Intl.NumberFormat("en-US");
const txt = (v: any) => (v == null ? "" : String(v).trim());
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

export function HRView({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<D | null>(null),
    [q, setQ] = useState(""),
    [filters, setFilters] = useState({ jobTitle: "", facility: "", administration: "", department: "", status: "", cadreType: "" }),
    [structure, setStructure] = useState<Structure>({ hospitals: [], administrations: [], departments: [], cadreTypes: [] }),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch(`/api/hr?q=${encodeURIComponent(q)}&limit=500`);
    if (r.ok) setData(await r.json());
  }, [q]);
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
          throw new Error((await res.json()).error || "فشل الاستيراد");
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
            throw new Error((await res.json()).error || "فشل الاستيراد");
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
  return (
    <main
      dir="rtl"
      className={
        embedded
          ? "text-right"
          : "min-h-screen bg-[#f3f6f8] p-4 text-right lg:p-8"
      }
    >
      <div className="mx-auto max-w-[1500px]">
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
            <EmployeeDialog jobCodes={data?.jobCodes || []} structure={structure} onSaved={load} />
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
              const values = Array.from(new Set((data?.employees || []).map((e: any) => e[key === "jobTitle" ? "job_title" : key]).filter(Boolean))).sort();
              return <select key={key} value={filters[key]} onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))} className="h-10 rounded-md border bg-white px-3 text-right text-sm"><option value="">كل {label}</option>{values.map((v: any) => <option key={v} value={v}>{v}</option>)}</select>;
            })}
            <Button type="button" variant="outline" onClick={() => { setQ(""); setFilters({ jobTitle: "", facility: "", administration: "", department: "", status: "", cadreType: "" }); }}>مسح الفلاتر</Button>
          </div>
        </section>
        <section className="mb-5 grid gap-4 lg:grid-cols-3">
          <Breakdown title="الموظفون حسب المركز" rows={data?.facilities} />
          <Breakdown title="حسب حالة الموظف" rows={data?.statuses} />
          <Breakdown title="حسب نوع الكادر" rows={data?.cadres} />
        </section>
        <section className="overflow-hidden rounded-2xl border bg-white">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold">سجل الموظفين</h2>
            <div className="relative w-full sm:w-80">
              <Search className="absolute right-3 top-3 size-4 text-gray-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث بالاسم أو الرقم أو المركز"
                className="pr-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الرقم</TableHead>
                  <TableHead className="text-right">كود الموظف</TableHead>
                  <TableHead className="text-right">اسم الموظف</TableHead>
                  <TableHead className="text-right">المركز</TableHead>
                  <TableHead className="text-right">الدائرة</TableHead>
                  <TableHead className="text-right">القسم</TableHead>
                  <TableHead className="text-right">المسمى</TableHead>
                  <TableHead className="text-right">نوع الكادر</TableHead>
                  <TableHead className="text-right">الدرجة</TableHead>
                  <TableHead className="text-right">الراتب</TableHead>
                  <TableHead className="text-right">المشروع / التغطية</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="w-16 text-center">إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.employees?.filter((e: any) => {
                  const match = (key: string) => !filters[key as keyof typeof filters] || String(e[key === "jobTitle" ? "job_title" : key] || "") === filters[key as keyof typeof filters];
                  return match("jobTitle") && match("facility") && match("administration") && match("department") && match("status") && match("cadreType");
                }).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.employee_no}</TableCell>
                    <TableCell dir="ltr" className="text-right font-mono text-[0.95rem] tracking-tight">
                      {e.employee_code || "—"}
                    </TableCell>
                    <TableCell className="font-semibold">
                      {e.full_name}
                    </TableCell>
                    <TableCell>{e.facility}</TableCell>
                    <TableCell>{e.administration}</TableCell>
                    <TableCell>{e.department}</TableCell>
                    <TableCell>{e.job_title}</TableCell>
                    <TableCell>{e.cadre_type}</TableCell>
                    <TableCell>{e.job_grade || "—"}</TableCell>
                    <TableCell>{e.salary ? `${n.format(Number(e.salary))} ₪` : "—"}</TableCell>
                    <TableCell>{e.project ? `${e.project}${e.project_coverage ? ` (${e.project_coverage}%)` : ""}` : "—"}</TableCell>
                    <TableCell>{e.status}</TableCell>
                    <TableCell className="text-center">
                      <EmployeeDialog
                        employee={e}
                        jobCodes={data?.jobCodes || []}
                        structure={structure}
                        onSaved={load}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
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

function EmployeeDialog({
  employee,
  jobCodes,
  structure,
  onSaved,
}: {
  employee?: any;
  jobCodes: any[];
  structure: Structure;
  onSaved: () => Promise<void>;
}) {
  const editing = Boolean(employee?.id);
  const [open, setOpen] = useState(false);
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
      setOpen(false);
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
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setForm(employeeForm(employee));
      }}
    >
      <DialogTrigger asChild>
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
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="max-h-[94dvh] w-[calc(100%-1rem)] overflow-y-auto p-4 text-right sm:w-full sm:max-w-5xl sm:p-6"
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
            <FixedSelect label="نوع الكادر" value={form.cadreType} onChange={(v) => set("cadreType", v)} options={[...(structure.cadreTypes || []).map((c: any) => c.name), form.cadreType].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i)} />
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
            <Field label="المشروع المحمّل عليه" value={form.project} onChange={(v) => set("project", v)} />
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

