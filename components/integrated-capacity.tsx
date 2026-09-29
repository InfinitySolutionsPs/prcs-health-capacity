"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, RefreshCw, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmployeeDialog, type Structure } from "@/app/hr/page";
import { SearchableSelect } from "@/components/searchable-select";
import { employeeMatchesPosition } from "@/lib/staffing-match";

type Staffing = {
  id: number;
  hospitalName: string;
  division: string;
  departmentName: string;
  jobTitle: string;
  jobCode?: string | null;
  required: number;
  available: number;
  gap: number;
};
type Employee = {
  id: number;
  full_name?: string;
  employee_code?: string;
  job_code?: string;
  job_title?: string;
  facility?: string;
  main_administration?: string;
  administration?: string;
  department?: string;
  status?: string;
};
type CapacityData = {
  hospitals: { id: number; name: string }[];
  administrations?: any[];
  departments?: any[];
  jobTitles?: any[];
  projects?: any[];
  cadreTypes?: { id: number; name: string }[];
  staffing: Staffing[];
};

const nf = new Intl.NumberFormat("en-US");
const active = (e: Employee) => !e.status || e.status === "على رأس عمله";

export function IntegratedCapacity() {
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobCodes, setJobCodes] = useState<any[]>([]);
  const [cadreOptions, setCadreOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [hospital, setHospital] = useState("all");
  const [administration, setAdministration] = useState("all");
  const [department, setDepartment] = useState("all");
  const [jobTitle, setJobTitle] = useState("all");
  const [deficitOnly, setDeficitOnly] = useState(false);
  const [surplusOnly, setSurplusOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function load() {
    setLoading(true);
    try {
      const [capacityRes, employeesRes] = await Promise.all([
        fetch("/api/data", { cache: "no-store" }),
        fetch("/api/hr?capacity=1", { cache: "no-store" }),
      ]);
      if (!capacityRes.ok || !employeesRes.ok) throw new Error("تعذر تحميل بيانات الدمج");
      const [capacityBody, employeesBody] = await Promise.all([
        capacityRes.json(),
        employeesRes.json(),
      ]);
      setCapacity(capacityBody);
      setEmployees(employeesBody.employees || []);
      setJobCodes(employeesBody.jobCodes || []);
      setCadreOptions((employeesBody.cadreTypes || []).map((item: any) => item.name).filter(Boolean));
    } catch {
      setCapacity(null);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredStaffing = useMemo(() => {
    if (!capacity) return [];
    return capacity.staffing.filter((row) => {
      const text = `${row.hospitalName} ${row.division} ${row.departmentName} ${row.jobTitle}`;
      return (
        (hospital === "all" || row.hospitalName === hospital) &&
        (administration === "all" || row.division === administration) &&
        (department === "all" || row.departmentName === department) &&
        (jobTitle === "all" || row.jobTitle === jobTitle) &&
        (!query || text.toLocaleLowerCase("ar").includes(query.trim().toLocaleLowerCase("ar"))) &&
        ((!deficitOnly && !surplusOnly) || (deficitOnly && row.gap > 0) || (surplusOnly && row.available > row.required))
      );
    });
  }, [capacity, hospital, administration, department, jobTitle, query, deficitOnly, surplusOnly]);

  const options = useMemo(() => {
    const rows = capacity?.staffing || [];
    const atHospital = rows.filter((row) => hospital === "all" || row.hospitalName === hospital);
    const atAdministration = atHospital.filter((row) => administration === "all" || row.division === administration);
    const atDepartment = atAdministration.filter((row) => department === "all" || row.departmentName === department);
    const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));
    return {
      hospitals: unique(rows.map((row) => row.hospitalName)),
      administrations: unique(atHospital.map((row) => row.division)),
      departments: unique(atAdministration.map((row) => row.departmentName)),
      jobs: unique(atDepartment.map((row) => row.jobTitle)),
    };
  }, [capacity, hospital, administration, department]);

  useEffect(() => { setAdministration("all"); setDepartment("all"); setJobTitle("all"); }, [hospital]);
  useEffect(() => { setDepartment("all"); setJobTitle("all"); }, [administration]);
  useEffect(() => { setJobTitle("all"); }, [department]);

  const totals = filteredStaffing.reduce((sum, row) => {
    const actual = row.available;
    return { required: sum.required + row.required, actual: sum.actual + actual, gap: sum.gap + Math.max(row.required - actual, 0), surplus: sum.surplus + Math.max(actual - row.required, 0), covered: sum.covered + Math.min(actual, row.required) };
  }, { required: 0, actual: 0, gap: 0, surplus: 0, covered: 0 });
  const coverage = totals.required ? Math.round(totals.covered / totals.required * 100) : 0;
  const pageCount = Math.max(1, Math.ceil(filteredStaffing.length / pageSize));
  const pagedStaffing = filteredStaffing.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [query, hospital, administration, department, jobTitle, deficitOnly, surplusOnly, pageSize]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const capacityStructure: Structure = {
    hospitals: capacity?.hospitals || [],
    administrations: capacity?.administrations || [],
    departments: capacity?.departments || [],
    jobTitles: capacity?.jobTitles || [],
    projects: capacity?.projects || [],
    projectJobs: (capacity as any)?.projectJobs || [],
    cadreTypes: capacity?.cadreTypes || [],
  };

  return <div dir="rtl" className="space-y-5 text-right">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-extrabold">القدرة التشغيلية والموظفون</h2>
        <p className="mt-1 text-sm text-[#6b7681]">عرض موحّد يربط الاحتياج والموجود والعجز مع الموظفين المسجلين فعليًا.</p>
      </div>
      <Button variant="outline" onClick={load} disabled={loading} className="gap-2"><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"}/>تحديث البيانات</Button>
    </div>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Summary title="السجلات الوظيفية" value={filteredStaffing.length}/>
      <Summary title="إجمالي الاحتياج" value={totals.required}/>
      <Summary title="الموظفون الموجودون فعليًا" value={totals.actual} tone="green"/>
      <Summary title="العجز المحسوب من الموظفين" value={totals.gap} tone="red"/>
      <Summary title="الفائض عن الاحتياج" value={totals.surplus} tone="amber"/>
      <Summary title="نسبة تغطية الاحتياج" value={coverage} suffix="%" tone="blue"/>
    </section>

    <section className="rounded-2xl border border-[#dfe5e9] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 font-bold text-[#a50f27]"><Search className="size-5" /> البحث والتصفية <span className="text-xs font-normal text-[#7a858f]">اكتب داخل أي فلتر للوصول السريع</span></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative"><span className="sr-only">بحث</span><Search className="pointer-events-none absolute right-3 top-3.5 size-4 text-[#89939c]"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المستشفى أو القسم أو المسمى" className="h-11 w-full rounded-xl border border-[#dfe5e9] bg-white pr-9 pl-3 text-right text-sm outline-none transition focus:border-[#b5122b] focus:ring-2 focus:ring-[#b5122b]/15"/></label>
        <Filter value={hospital} setValue={setHospital} label="المستشفى / المركز" values={options.hospitals}/>
        <Filter value={administration} setValue={setAdministration} label="الإدارة الرئيسية" values={options.administrations}/>
        <Filter value={department} setValue={setDepartment} label="القسم" values={options.departments}/>
        <Filter value={jobTitle} setValue={setJobTitle} label="المسمى الوظيفي" values={options.jobs}/>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2"><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#a50f27]"><input type="checkbox" checked={deficitOnly} onChange={(e) => setDeficitOnly(e.target.checked)} className="size-4 accent-[#a50f27]"/>عرض الوظائف التي فيها عجز</label><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-amber-700"><input type="checkbox" checked={surplusOnly} onChange={(e) => setSurplusOnly(e.target.checked)} className="size-4 accent-amber-600"/>عرض الوظائف التي فيها فائض</label></div>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#dfe5e9] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b px-5 py-4 font-bold"><UsersRound className="size-5 text-[#a50f27]"/>تفاصيل الموظفين حسب الاحتياج</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-[0.9rem]">
          <thead className="bg-[#f7f9fa]"><tr>{["المستشفى / المركز", "الإدارة الرئيسية", "القسم", "المسمى الوظيفي", "الاحتياج", "الموجود فعليًا", "العجز", "الفائض", "الموظفون"].map((title) => <th key={title} className="whitespace-nowrap border-b px-3 py-3 text-right font-bold">{title}</th>)}</tr></thead>
          <tbody>{loading ? <tr><td colSpan={9} className="p-10 text-center text-[#6b7681]">جاري تحميل البيانات...</td></tr> : filteredStaffing.length === 0 ? <tr><td colSpan={9} className="p-10 text-center text-[#6b7681]">لا توجد نتائج حسب الفلاتر المحددة.</td></tr> : pagedStaffing.map((row) => {
            const actual = row.available;
            const gap = Math.max(row.required - actual, 0);
            const surplus = Math.max(actual - row.required, 0);
            return <tr key={row.id} className={`align-top ${gap > 0 ? "bg-[#fffafb]" : surplus > 0 ? "bg-amber-50/60" : ""} hover:bg-[#f7f9fa]`}><td className="whitespace-nowrap border-b px-3 py-3 font-semibold">{row.hospitalName}</td><td className="whitespace-nowrap border-b px-3 py-3">{row.division}</td><td className="whitespace-nowrap border-b px-3 py-3">{row.departmentName}</td><td className="whitespace-nowrap border-b px-3 py-3">{row.jobTitle}</td><td className="whitespace-nowrap border-b px-3 py-3 font-bold">{nf.format(row.required)}</td><td className="whitespace-nowrap border-b px-3 py-3 font-bold text-emerald-700">{nf.format(actual)}</td><td className={`whitespace-nowrap border-b px-3 py-3 font-bold ${gap > 0 ? "text-[#b5122b]" : "text-emerald-700"}`}>{nf.format(gap)}</td><td className={`whitespace-nowrap border-b px-3 py-3 font-bold ${surplus > 0 ? "text-amber-700" : "text-[#89939c]"}`}>{surplus > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1">فائض {nf.format(surplus)}</span> : nf.format(0)}</td><td className="whitespace-nowrap border-b px-3 py-3 text-center"><EmployeeNamesCell employees={employees} position={row} employeeCount={actual} jobCodes={jobCodes} structure={capacityStructure} cadreOptions={cadreOptions} onSaved={load}/></td></tr>;
          })}</tbody>
        </table>
      </div>
      {!loading && filteredStaffing.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-[#f7f9fa] px-4 py-3 text-xs"><label className="flex items-center gap-2">عدد السجلات في الصفحة<SearchableSelect value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} placeholder="عدد الصفوف" searchPlaceholder="ابحث عن عدد الصفوف" className="h-9 w-24" contentClassName="min-w-48" options={[10,25,50,100].map(value=>({value:String(value),label:String(value)}))}/></label><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</Button><span>صفحة {page} من {pageCount} — {nf.format(filteredStaffing.length)} سجل</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>التالي</Button></div></div>}
    </section>
  </div>;
}

function EmployeeNamesCell({ employees, position, employeeCount, jobCodes, structure, cadreOptions, onSaved }: { employees: Employee[]; position: Staffing; employeeCount: number; jobCodes: any[]; structure: Structure; cadreOptions: string[]; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Employee | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const matchedEmployees = useMemo(() => open ? employees.filter((employee) => active(employee) && employeeMatchesPosition({
    jobCode: employee.job_code,
    jobTitle: employee.job_title,
    facility: employee.facility,
    mainAdministration: employee.main_administration,
    administration: employee.administration,
    department: employee.department,
    status: employee.status,
  }, position)) : [], [open, employees, position]);
  const pages = Math.max(1, Math.ceil(matchedEmployees.length / pageSize));
  const visible = matchedEmployees.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [matchedEmployees.length, pageSize]);
  if (!employeeCount) return <span className="text-[#89939c]">لا يوجد موظفون</span>;
  return <>
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2 border-[#b5122b] text-[#a50f27]">
      <Eye className="size-4"/>عرض الموظفين ({nf.format(employeeCount)})
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dir="rtl" className="w-[95vw] max-w-6xl text-right">
        <DialogHeader className="text-right"><DialogTitle>الموظفون الموجودون فعليًا — {position.hospitalName} / {position.departmentName}</DialogTitle><DialogDescription>اضغط على اسم الموظف لعرض تفاصيله. العدد: {nf.format(matchedEmployees.length)}</DialogDescription></DialogHeader>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-xs"><thead className="bg-[#f7f9fa]"><tr><th className="whitespace-nowrap border-b px-3 py-2 text-right">#</th><th className="whitespace-nowrap border-b px-3 py-2 text-right">اسم الموظف</th><th className="whitespace-nowrap border-b px-3 py-2 text-right">المسمى الوظيفي</th><th className="whitespace-nowrap border-b px-3 py-2 text-right">مركز العمل</th><th className="whitespace-nowrap border-b px-3 py-2 text-right">القسم</th><th className="whitespace-nowrap border-b px-3 py-2 text-right">الحالة</th></tr></thead><tbody>{visible.map((employee, index) => <tr key={employee.id} className="hover:bg-[#fffafb]"><td className="whitespace-nowrap border-b px-3 py-2">{(page - 1) * pageSize + index + 1}</td><td className="whitespace-nowrap border-b px-3 py-2"><button type="button" onClick={() => setDetail(employee)} className="font-semibold text-[#a50f27] underline underline-offset-4">{employee.full_name || "بدون اسم"}</button></td><td className="whitespace-nowrap border-b px-3 py-2">{employee.job_title || "—"}</td><td className="whitespace-nowrap border-b px-3 py-2">{employee.facility || "—"}</td><td className="whitespace-nowrap border-b px-3 py-2">{employee.department || "—"}</td><td className="whitespace-nowrap border-b px-3 py-2">{employee.status || "على رأس عمله"}</td></tr>)}</tbody></table>
          {!matchedEmployees.length && <p className="p-6 text-center text-sm text-[#7a858f]">لا يوجد موظفون مطابقون لهذا القسم.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><label className="flex items-center gap-2">عدد الموظفين في الصفحة<SearchableSelect value={String(pageSize)} onChange={(value) => setPageSize(Number(value))} placeholder="عدد الموظفين" searchPlaceholder="ابحث عن العدد" className="h-9 w-24" contentClassName="min-w-48" options={[5,10,25,50].map(value=>({value:String(value),label:String(value)}))}/></label><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>السابق</Button><span>صفحة {page} من {pages}</span><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>التالي</Button></div></div>
      </DialogContent>
    </Dialog>
    <EmployeeDialog employee={detail} open={Boolean(detail)} onOpenChange={(value) => !value && setDetail(null)} hideTrigger jobCodes={jobCodes} structure={structure} cadreOptions={cadreOptions} onSaved={onSaved} />
  </>;
}

function EmployeeEditDialog({ employee, open, onOpenChange }: { employee: Employee | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    if (employee) setForm({
      firstName: (employee as any).first_name || "", fatherName: (employee as any).father_name || "", grandfatherName: (employee as any).grandfather_name || "", familyName: (employee as any).family_name || "",
      jobCode: (employee as any).job_code || "", jobTitle: employee.job_title || "", facility: employee.facility || "", administration: employee.administration || employee.main_administration || "", department: employee.department || "", status: employee.status || "على رأس عمله", phone: (employee as any).phone || ""
    });
  }, [employee]);
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    if (!employee) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/hr/${employee.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...employee, ...form }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "تعذر تحديث بيانات الموظف");
      onOpenChange(false);
    } catch (error) { window.alert(error instanceof Error ? error.message : "تعذر تحديث بيانات الموظف"); } finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="w-[95vw] max-w-3xl text-right"><DialogHeader className="text-right"><DialogTitle>تعديل بيانات الموظف</DialogTitle><DialogDescription>{employee?.full_name || ""}</DialogDescription></DialogHeader>{employee && <div className="grid gap-3 sm:grid-cols-2">{[["firstName","الاسم الأول"],["fatherName","اسم الأب"],["grandfatherName","اسم الجد"],["familyName","اسم العائلة"],["jobCode","كود المسمى"],["jobTitle","المسمى الوظيفي"],["facility","مركز العمل"],["administration","الدائرة"],["department","القسم"],["status","حالة الموظف"],["phone","رقم الجوال"]].map(([key,label]) => <label key={key} className="block"><span className="mb-1 block text-xs font-semibold">{label}</span><input value={form[key] || ""} onChange={(event) => set(key, event.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#b5122b]/20" /></label>)}<Button type="button" disabled={saving} onClick={save} className="sm:col-span-2 bg-[#a50f27] hover:bg-[#870c20]">{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button></div>}</DialogContent></Dialog>;
}

function Filter({ value, setValue, label, values }: { value: string; setValue: (value: string) => void; label: string; values: string[] }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-[#6b7681]">{label}</span><SearchableSelect value={value} onChange={setValue} placeholder={`الكل — ${label}`} searchPlaceholder={`ابحث عن ${label}`} options={[{ value: "all", label: `الكل — ${label}` }, ...values.map((item) => ({ value: item, label: item }))]} /></label>;
}

function Summary({ title, value, tone = "blue", suffix = "" }: { title: string; value: number; tone?: "blue" | "green" | "red" | "amber"; suffix?: string }) {
  const color = tone === "green" ? "border-r-emerald-600" : tone === "red" ? "border-r-[#b5122b]" : tone === "amber" ? "border-r-amber-500" : "border-r-[#197b9a]";
  return <div className={`rounded-2xl border border-[#dfe5e9] border-r-4 ${color} bg-white p-4 shadow-sm`}><p className="text-sm text-[#6b7681]">{title}</p><p className="mt-2 text-3xl font-extrabold" dir="ltr">{nf.format(value)}{suffix}</p></div>;
}
