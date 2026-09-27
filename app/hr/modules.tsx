"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Check, Search, Trash2, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const nf = new Intl.NumberFormat("en-US");
const selectClass = "h-10 w-full rounded-md border border-[#dfe5e9] bg-white px-3 text-right shadow-sm outline-none transition focus:border-[#a50f27] focus:ring-2 focus:ring-[#fbecef]";
const money = (value: unknown) => nf.format(Number(String(value ?? 0).replace(/[^0-9.-]/g, "")) || 0);
type Employee = { employee_no: string; full_name: string; job_title?: string; facility?: string };
async function api(path: string, options?: RequestInit) {
  const response = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "تعذر تنفيذ العملية");
  return body;
}
function Heading({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return <div className="mb-5 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-xl bg-[#fbecef] text-[#a50f27] [&_svg]:size-6">{icon}</span><div><h2 className="text-2xl font-bold">{title}</h2><p className="mt-1 text-sm text-[#6b7681]">{description}</p></div></div>;
}
function FormField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={"block space-y-1.5 " + className}><span className="block text-sm font-semibold">{label}</span>{children}</label>;
}
function EmployeeSelect({ employees, value, onChange }: { employees: Employee[]; value: string; onChange: (value: string) => void }) {
  return <select required value={value} onChange={e => onChange(e.target.value)} className={selectClass}>
    <option value="">اختر الموظف</option>
    {employees.map(employee => <option key={employee.employee_no} value={employee.employee_no}>{employee.full_name} — {employee.employee_no}{employee.facility ? " — " + employee.facility : ""}</option>)}
  </select>;
}
function Metric({ label, value, color }: { label: string; value: string | number; color: string }) {
  return <div className="rounded-xl border border-[#dfe5e9] border-r-4 bg-white p-4 shadow-sm" style={{ borderRightColor: color }}><div className="text-sm text-[#6b7681]">{label}</div><div className="mt-2 text-2xl font-extrabold">{value}</div></div>;
}

export function LeavesModule({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ employeeNo: "", leaveType: "سنوية", startDate: "", endDate: "", days: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [hr, leaveData] = await Promise.all([api("/api/hr?limit=10000"), api("/api/hr/leaves")]);
      setEmployees(hr.employees || []);
      setLeaves(leaveData.leaves || []);
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل الإجازات"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => leaves.filter(row => [row.employeeName, row.employeeNo, row.leaveType, row.status].some(value => String(value || "").toLowerCase().includes(search.toLowerCase()))), [leaves, search]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await api("/api/hr/leaves", { method: "POST", body: JSON.stringify(form) }); setForm({ employeeNo: "", leaveType: "سنوية", startDate: "", endDate: "", days: "", notes: "" }); toast.success("تم تسجيل الإجازة"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ الإجازة"); }
    finally { setBusy(false); }
  }
  async function updateStatus(id: number, status: string) {
    try { await api("/api/hr/leaves/" + id, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); toast.success("تم تحديث حالة الإجازة"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحديث الحالة"); }
  }
  async function remove(id: number) {
    if (!window.confirm("هل تريد حذف سجل الإجازة؟")) return;
    try { await api("/api/hr/leaves/" + id, { method: "DELETE" }); await load(); toast.success("تم حذف سجل الإجازة"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حذف الإجازة"); }
  }
  return <main dir="rtl" className="text-right">
    <Heading title="الإجازات" description="تسجيل إجازات الموظفين ومتابعة حالتها." icon={<CalendarDays/>}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="إجمالي السجلات" value={nf.format(leaves.length)} color="#176b87"/><Metric label="بانتظار القرار" value={nf.format(leaves.filter(x => x.status === "مقدمة").length)} color="#c77d10"/><Metric label="موافق عليها" value={nf.format(leaves.filter(x => x.status === "موافق عليها").length)} color="#18794e"/></div>
    {canEdit && <form onSubmit={submit} className="mb-5 rounded-2xl border border-[#dfe5e9] bg-white p-5 shadow-sm"><div className="mb-4 border-b border-[#e7ebee] pb-3"><h3 className="font-bold">تسجيل إجازة</h3><p className="mt-1 text-xs text-[#7a858f]">أدخل بيانات الموظف وفترة الإجازة وعدد الأيام.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><FormField label="الموظف"><EmployeeSelect employees={employees} value={form.employeeNo} onChange={employeeNo => setForm({ ...form, employeeNo })}/></FormField><FormField label="نوع الإجازة"><select value={form.leaveType} onChange={e => setForm({ ...form, leaveType: e.target.value })} className="h-10 w-full rounded-md border bg-white px-3 text-right">{["سنوية","مرضية","طارئة","بدون راتب","أمومة","أخرى"].map(x => <option key={x}>{x}</option>)}</select></FormField><FormField label="عدد الأيام"><Input type="number" min="1" step="1" required value={form.days} onChange={e => setForm({ ...form, days: e.target.value })}/></FormField><FormField label="من تاريخ"><Input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}/></FormField><FormField label="إلى تاريخ"><Input type="date" required min={form.startDate || undefined} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}/></FormField><FormField label="ملاحظات"><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="اختياري"/></FormField></div><Button disabled={busy || !employees.length} className="mt-4 bg-[#a50f27] hover:bg-[#870c20]">{busy ? "جارٍ الحفظ..." : "حفظ الإجازة"}</Button></form>}
    <section className="overflow-hidden rounded-2xl border border-[#dfe5e9] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ebee] bg-[#fbfcfd] p-4"><h3 className="font-bold">سجل الإجازات</h3><div className="relative w-full sm:max-w-xs"><Search className="absolute right-3 top-3 size-4 text-[#7a858f]"/><Input value={search} onChange={e => setSearch(e.target.value)} className="pr-9" placeholder="ابحث عن موظف أو نوع الإجازة"/></div></div><div className="overflow-x-auto"><Table><TableHeader className="bg-[#f7f9fa]"><TableRow><TableHead>الموظف</TableHead><TableHead>نوع الإجازة</TableHead><TableHead>الفترة</TableHead><TableHead>الأيام</TableHead><TableHead>الحالة</TableHead><TableHead>ملاحظات</TableHead>{isAdmin && <TableHead>إجراء</TableHead>}</TableRow></TableHeader><TableBody>{filtered.map(row => <TableRow key={row.id}><TableCell className="font-semibold">{row.employeeName}<div className="text-xs text-[#7a858f]">{row.employeeNo}</div></TableCell><TableCell>{row.leaveType}</TableCell><TableCell>{row.startDate} — {row.endDate}</TableCell><TableCell>{nf.format(row.days)}</TableCell><TableCell><select disabled={!canEdit} value={row.status} onChange={e => void updateStatus(row.id, e.target.value)} className="rounded-md border border-[#dfe5e9] bg-white px-2 py-1 shadow-sm focus:border-[#a50f27] focus:outline-none"><option>مقدمة</option><option>موافق عليها</option><option>مرفوضة</option></select></TableCell><TableCell>{row.notes || "—"}</TableCell>{isAdmin && <TableCell><Button variant="ghost" size="icon" title="حذف" onClick={() => void remove(row.id)}><Trash2 className="size-4 text-[#a50f27]"/></Button></TableCell>}</TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-[#7a858f]">لا توجد سجلات إجازات</TableCell></TableRow>}</TableBody></Table></div></section>
  </main>;
}

export function PenaltiesModule({ canEdit, isAdmin }: { canEdit: boolean; isAdmin: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ employeeNo: "", penaltyType: "لفت نظر", incidentDate: "", description: "", deductionAmount: "0" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const [hr, penaltyData] = await Promise.all([api("/api/hr?limit=10000"), api("/api/hr/penalties")]); setEmployees(hr.employees || []); setPenalties(penaltyData.penalties || []); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل العقوبات"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = useMemo(() => penalties.filter(row => [row.employeeName, row.employeeNo, row.penaltyType, row.description].some(value => String(value || "").toLowerCase().includes(search.toLowerCase()))), [penalties, search]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await api("/api/hr/penalties", { method: "POST", body: JSON.stringify(form) }); setForm({ employeeNo: "", penaltyType: "لفت نظر", incidentDate: "", description: "", deductionAmount: "0" }); toast.success("تم تسجيل الإجراء"); await load(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ الإجراء"); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    if (!window.confirm("هل تريد حذف سجل الإجراء؟")) return;
    try { await api("/api/hr/penalties/" + id, { method: "DELETE" }); await load(); toast.success("تم حذف السجل"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حذف السجل"); }
  }
  return <main dir="rtl" className="text-right">
    <Heading title="العقوبات" description="توثيق الإجراءات والعقوبات المرتبطة بملفات الموظفين." icon={<AlertTriangle/>}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="إجمالي السجلات" value={nf.format(penalties.length)} color="#a50f27"/><Metric label="خصومات مالية" value={nf.format(penalties.filter(x => Number(x.deductionAmount) > 0).length)} color="#c77d10"/><Metric label="إجمالي مبالغ الخصم" value={money(penalties.reduce((sum, x) => sum + Number(x.deductionAmount || 0), 0))} color="#176b87"/></div>
    {canEdit && <form onSubmit={submit} className="mb-5 rounded-2xl border border-[#dfe5e9] bg-white p-5 shadow-sm"><div className="mb-4 border-b border-[#e7ebee] pb-3"><h3 className="font-bold">تسجيل إجراء</h3><p className="mt-1 text-xs text-[#7a858f]">أدخل الإجراء وتاريخه، ويمكن إضافة مبلغ خصم عند الحاجة.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <FormField label="الموظف"><EmployeeSelect employees={employees} value={form.employeeNo} onChange={employeeNo => setForm({ ...form, employeeNo })}/></FormField>
      <FormField label="نوع الإجراء"><select value={form.penaltyType} onChange={e => setForm({ ...form, penaltyType: e.target.value })} className="h-10 w-full rounded-md border bg-white px-3 text-right">{["لفت نظر","إنذار خطي","خصم من الراتب","إيقاف عن العمل","أخرى"].map(x => <option key={x}>{x}</option>)}</select></FormField>
      <FormField label="تاريخ الإجراء"><Input type="date" required value={form.incidentDate} onChange={e => setForm({ ...form, incidentDate: e.target.value })}/></FormField>
      <FormField label="تفاصيل الإجراء" className="lg:col-span-2"><textarea required rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="min-h-10 w-full rounded-md border border-[#dfe5e9] bg-white px-3 py-2 text-right shadow-sm outline-none transition focus:border-[#a50f27] focus:ring-2 focus:ring-[#fbecef]"/></FormField>
      <FormField label="مبلغ الخصم (اختياري)"><Input type="number" min="0" step="0.01" value={form.deductionAmount} onChange={e => setForm({ ...form, deductionAmount: e.target.value })}/></FormField>
    </div><Button disabled={busy || !employees.length} className="mt-4 bg-[#a50f27] hover:bg-[#870c20]">{busy ? "جارٍ الحفظ..." : "حفظ الإجراء"}</Button></form>}
    <section className="overflow-hidden rounded-2xl border border-[#dfe5e9] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ebee] bg-[#fbfcfd] p-4"><h3 className="font-bold">سجل العقوبات</h3><div className="relative w-full sm:max-w-xs"><Search className="absolute right-3 top-3 size-4 text-[#7a858f]"/><Input value={search} onChange={e => setSearch(e.target.value)} className="pr-9" placeholder="ابحث عن موظف أو إجراء"/></div></div><div className="overflow-x-auto"><Table><TableHeader className="bg-[#f7f9fa]"><TableRow><TableHead>الموظف</TableHead><TableHead>نوع الإجراء</TableHead><TableHead>التاريخ</TableHead><TableHead>التفاصيل</TableHead><TableHead>الخصم</TableHead>{isAdmin && <TableHead>إجراء</TableHead>}</TableRow></TableHeader><TableBody>{filtered.map(row => <TableRow key={row.id}><TableCell className="font-semibold">{row.employeeName}<div className="text-xs text-[#7a858f]">{row.employeeNo}</div></TableCell><TableCell>{row.penaltyType}</TableCell><TableCell>{row.incidentDate}</TableCell><TableCell>{row.description}</TableCell><TableCell>{money(row.deductionAmount)}</TableCell>{isAdmin && <TableCell><Button variant="ghost" size="icon" title="حذف" onClick={() => void remove(row.id)}><Trash2 className="size-4 text-[#a50f27]"/></Button></TableCell>}</TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-[#7a858f]">لا توجد سجلات عقوبات</TableCell></TableRow>}</TableBody></Table></div></section>
  </main>;
}

export function PayrollModule() {
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const result = await api("/api/hr/payroll"); setEntries(result.payrollEntries || []); }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل الرواتب"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const periods = useMemo(() => [...new Set(entries.map(row => String(row.period || "")))].filter(Boolean).sort((a, b) => b.localeCompare(a)), [entries]);
  const filtered = useMemo(() => entries.filter(row => (!period || row.period === period) && [row.employeeName, row.employeeNo, row.project, row.facility, row.administration].some(value => String(value || "").toLowerCase().includes(search.toLowerCase()))), [entries, period, search]);
  const totals = useMemo(() => filtered.reduce((acc, row) => ({ gross: acc.gross + (Number(String(row.gross || 0).replace(/[^0-9.-]/g, "")) || 0), deductions: acc.deductions + (Number(String(row.deductions || 0).replace(/[^0-9.-]/g, "")) || 0), net: acc.net + (Number(String(row.net || 0).replace(/[^0-9.-]/g, "")) || 0) }), { gross: 0, deductions: 0, net: 0 }), [filtered]);
  return <main dir="rtl" className="text-right">
    <Heading title="الرواتب" description="عرض بيانات الرواتب المستوردة مع التصفية حسب الفترة والموظف والمشروع." icon={<WalletCards/>}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="إجمالي الرواتب" value={money(totals.gross)} color="#176b87"/><Metric label="إجمالي الخصومات" value={money(totals.deductions)} color="#a50f27"/><Metric label="صافي الرواتب" value={money(totals.net)} color="#18794e"/></div>
    <section className="overflow-hidden rounded-2xl border border-[#dfe5e9] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ebee] bg-[#fbfcfd] p-4"><h3 className="font-bold">سجل الرواتب ({nf.format(filtered.length)})</h3><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><select value={period} onChange={e => setPeriod(e.target.value)} className={selectClass}><option value="">كل الفترات</option>{periods.map(value => <option key={value}>{value}</option>)}</select><div className="relative sm:w-64"><Search className="absolute right-3 top-3 size-4 text-[#7a858f]"/><Input value={search} onChange={e => setSearch(e.target.value)} className="pr-9" placeholder="ابحث عن موظف أو مشروع"/></div></div></div><div className="overflow-x-auto"><Table><TableHeader className="bg-[#f7f9fa]"><TableRow><TableHead>رقم الموظف</TableHead><TableHead>اسم الموظف</TableHead><TableHead>الفترة</TableHead><TableHead>المشروع</TableHead><TableHead>مركز العمل</TableHead><TableHead>الإدارة</TableHead><TableHead>الإجمالي</TableHead><TableHead>الخصومات</TableHead><TableHead>الصافي</TableHead></TableRow></TableHeader><TableBody>{filtered.map(row => <TableRow key={row.id}><TableCell>{row.employeeNo}</TableCell><TableCell className="font-semibold">{row.employeeName}</TableCell><TableCell>{row.period}</TableCell><TableCell>{row.project}</TableCell><TableCell>{row.facility || "—"}</TableCell><TableCell>{row.administration || "—"}</TableCell><TableCell>{money(row.gross)}</TableCell><TableCell>{money(row.deductions)}</TableCell><TableCell className="font-bold text-[#18794e]">{money(row.net)}</TableCell></TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={9} className="py-10 text-center text-[#7a858f]">{loading ? "جارٍ تحميل الرواتب..." : "لا توجد سجلات رواتب. استورد ملف الرواتب من شاشة الموظفين."}</TableCell></TableRow>}</TableBody></Table></div></section>
  </main>;
}
