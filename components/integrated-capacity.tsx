"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Search, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";

type Staffing = {
  id: number;
  hospitalName: string;
  division: string;
  departmentName: string;
  jobTitle: string;
  required: number;
  available: number;
  gap: number;
};
type Employee = {
  id: number;
  full_name?: string;
  employee_code?: string;
  job_title?: string;
  facility?: string;
  main_administration?: string;
  administration?: string;
  department?: string;
  status?: string;
};
type CapacityData = {
  hospitals: { id: number; name: string }[];
  staffing: Staffing[];
};

const nf = new Intl.NumberFormat("en-US");
const clean = (value: unknown) => String(value ?? "").trim();
const active = (e: Employee) => !e.status || e.status === "على رأس عمله";
const facilityKey = (value: unknown) => {
  const name = clean(value);
  if (name === "مستشفى الامل" || name === "مستشفى الأمل") return "مستشفى الأمل";
  if (name === "مستشفى السرايا الميداني") return "مستشفى السرايا";
  if (name === "مستشفى التاهيل الطبي") return "مستشفى التأهيل الطبي";
  return name;
};

export function IntegratedCapacity() {
  const [capacity, setCapacity] = useState<CapacityData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [hospital, setHospital] = useState("all");
  const [administration, setAdministration] = useState("all");
  const [department, setDepartment] = useState("all");
  const [jobTitle, setJobTitle] = useState("all");
  const [deficitOnly, setDeficitOnly] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [capacityRes, employeesRes] = await Promise.all([
        fetch("/api/data", { cache: "no-store" }),
        fetch("/api/hr?limit=10000", { cache: "no-store" }),
      ]);
      if (!capacityRes.ok || !employeesRes.ok) throw new Error("تعذر تحميل بيانات الدمج");
      const [capacityBody, employeesBody] = await Promise.all([
        capacityRes.json(),
        employeesRes.json(),
      ]);
      setCapacity(capacityBody);
      setEmployees(employeesBody.employees || []);
    } catch {
      setCapacity(null);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const employeesFor = (row: Staffing) => employees.filter((employee) => {
    return active(employee) &&
      facilityKey(employee.facility) === facilityKey(row.hospitalName) &&
      clean(employee.job_title) === clean(row.jobTitle);
  });

  const filteredStaffing = useMemo(() => {
    if (!capacity) return [];
    return capacity.staffing.filter((row) => {
      const text = `${row.hospitalName} ${row.division} ${row.departmentName} ${row.jobTitle}`;
      const employeeNames = employeesFor(row).map((employee) => clean(employee.full_name)).join(" ");
      return (
        (hospital === "all" || row.hospitalName === hospital) &&
        (administration === "all" || row.division === administration) &&
        (department === "all" || row.departmentName === department) &&
        (jobTitle === "all" || row.jobTitle === jobTitle) &&
        (!query || `${text} ${employeeNames}`.includes(query.trim())) &&
        (!deficitOnly || row.gap > 0)
      );
    });
  }, [capacity, employees, hospital, administration, department, jobTitle, query, deficitOnly]);

  const options = useMemo(() => ({
    hospitals: Array.from(new Set((capacity?.staffing || []).map((r) => r.hospitalName))).sort(),
    administrations: Array.from(new Set((capacity?.staffing || []).map((r) => r.division))).sort(),
    departments: Array.from(new Set((capacity?.staffing || []).map((r) => r.departmentName))).sort(),
    jobs: Array.from(new Set((capacity?.staffing || []).map((r) => r.jobTitle))).sort(),
  }), [capacity]);

  const totals = filteredStaffing.reduce((sum, row) => {
    const actual = employeesFor(row).length;
    return { required: sum.required + row.required, actual: sum.actual + actual, gap: sum.gap + Math.max(row.required - actual, 0) };
  }, { required: 0, actual: 0, gap: 0 });

  return <div dir="rtl" className="space-y-5 text-right">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-extrabold">القدرة التشغيلية والموظفون</h2>
        <p className="mt-1 text-sm text-[#6b7681]">عرض موحّد يربط الاحتياج والموجود والعجز مع الموظفين المسجلين فعليًا.</p>
      </div>
      <Button variant="outline" onClick={load} disabled={loading} className="gap-2"><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"}/>تحديث البيانات</Button>
    </div>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Summary title="السجلات الوظيفية" value={filteredStaffing.length}/>
      <Summary title="إجمالي الاحتياج" value={totals.required}/>
      <Summary title="الموظفون الموجودون فعليًا" value={totals.actual} tone="green"/>
      <Summary title="العجز المحسوب من الموظفين" value={totals.gap} tone="red"/>
    </section>

    <section className="rounded-2xl border border-[#dfe5e9] bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 font-bold text-[#a50f27]"><Search className="size-5"/>فلاتر شاشة الدمج الجديدة</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className="relative xl:col-span-2"><span className="sr-only">بحث</span><Search className="pointer-events-none absolute right-3 top-3 size-4 text-[#89939c]"/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم المستشفى أو القسم أو المسمى" className="h-10 w-full rounded-lg border bg-white pr-9 pl-3 text-right outline-none focus:ring-2 focus:ring-[#b5122b]/20"/></label>
        <Filter value={hospital} setValue={setHospital} label="المستشفى / المركز" values={options.hospitals}/>
        <Filter value={administration} setValue={setAdministration} label="الإدارة الرئيسية" values={options.administrations}/>
        <Filter value={department} setValue={setDepartment} label="القسم" values={options.departments}/>
        <Filter value={jobTitle} setValue={setJobTitle} label="المسمى الوظيفي" values={options.jobs}/>
      </div>
      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#a50f27]"><input type="checkbox" checked={deficitOnly} onChange={(e) => setDeficitOnly(e.target.checked)} className="size-4 accent-[#a50f27]"/>عرض الوظائف التي فيها عجز فقط</label>
    </section>

    <section className="overflow-hidden rounded-2xl border border-[#dfe5e9] bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b px-5 py-4 font-bold"><UsersRound className="size-5 text-[#a50f27]"/>تفاصيل الموظفين حسب الاحتياج</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px] border-collapse text-sm">
          <thead className="bg-[#f7f9fa]"><tr>{["المستشفى / المركز", "الإدارة الرئيسية", "القسم", "المسمى الوظيفي", "الاحتياج", "الموجود فعليًا", "العجز", "أسماء الموظفين الموجودين"].map((title) => <th key={title} className="border-b px-4 py-3 text-right font-bold">{title}</th>)}</tr></thead>
          <tbody>{loading ? <tr><td colSpan={8} className="p-10 text-center text-[#6b7681]">جاري تحميل البيانات...</td></tr> : filteredStaffing.length === 0 ? <tr><td colSpan={8} className="p-10 text-center text-[#6b7681]">لا توجد نتائج حسب الفلاتر المحددة.</td></tr> : filteredStaffing.map((row) => {
            const matched = employeesFor(row);
            const actual = matched.length;
            const gap = Math.max(row.required - actual, 0);
            return <tr key={row.id} className="align-top hover:bg-[#fffafb]"><td className="border-b px-4 py-3 font-semibold">{row.hospitalName}</td><td className="border-b px-4 py-3">{row.division}</td><td className="border-b px-4 py-3">{row.departmentName}</td><td className="border-b px-4 py-3">{row.jobTitle}</td><td className="border-b px-4 py-3 font-bold">{nf.format(row.required)}</td><td className="border-b px-4 py-3 font-bold text-emerald-700">{nf.format(actual)}</td><td className={`border-b px-4 py-3 font-bold ${gap > 0 ? "text-[#b5122b]" : "text-emerald-700"}`}>{nf.format(gap)}</td><td className="border-b px-4 py-3 leading-7">{matched.length ? matched.map((employee) => employee.full_name).join("، ") : <span className="text-[#89939c]">لا يوجد موظفون مسجلون</span>}</td></tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

function Filter({ value, setValue, label, values }: { value: string; setValue: (value: string) => void; label: string; values: string[] }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-[#6b7681]">{label}</span><select value={value} onChange={(e) => setValue(e.target.value)} className="h-10 w-full rounded-lg border bg-white px-3 text-right outline-none focus:ring-2 focus:ring-[#b5122b]/20"><option value="all">الكل</option>{values.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function Summary({ title, value, tone = "blue" }: { title: string; value: number; tone?: "blue" | "green" | "red" }) {
  const color = tone === "green" ? "border-r-emerald-600" : tone === "red" ? "border-r-[#b5122b]" : "border-r-[#197b9a]";
  return <div className={`rounded-2xl border border-[#dfe5e9] border-r-4 ${color} bg-white p-4 shadow-sm`}><p className="text-sm text-[#6b7681]">{title}</p><p className="mt-2 text-3xl font-extrabold" dir="ltr">{nf.format(value)}</p></div>;
}
