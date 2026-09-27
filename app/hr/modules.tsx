"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Check, FileSpreadsheet, Search, Trash2, Upload, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import * as XLSX from "xlsx";

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
    {canEdit && <form onSubmit={submit} className="mb-5 rounded-2xl border border-[#dfe5e9] bg-white p-5 shadow-sm"><div className="mb-4 border-b border-[#e7ebee] pb-3"><h3 className="font-bold">تسجيل إجازة</h3><p className="mt-1 text-xs text-[#7a858f]">أدخل بيانات الموظف وفترة الإجازة وعدد الأيام.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><FormField label="الموظف"><EmployeeSelect employees={employees} value={form.employeeNo} onChange={employeeNo => setForm({ ...form, employeeNo })}/></FormField><FormField label="نوع الإجازة"><select value={form.leaveType} onChange={e => setForm({ ...form, leaveType: e.target.value })} className={selectClass}>{["سنوية","مرضية","طارئة","بدون راتب","أمومة","أخرى"].map(x => <option key={x}>{x}</option>)}</select></FormField><FormField label="عدد الأيام"><Input type="number" min="1" step="1" required value={form.days} onChange={e => setForm({ ...form, days: e.target.value })}/></FormField><FormField label="من تاريخ"><Input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}/></FormField><FormField label="إلى تاريخ"><Input type="date" required min={form.startDate || undefined} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}/></FormField><FormField label="ملاحظات"><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="اختياري"/></FormField></div><Button disabled={busy || !employees.length} className="mt-4 bg-[#a50f27] hover:bg-[#870c20]">{busy ? "جارٍ الحفظ..." : "حفظ الإجازة"}</Button></form>}
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
      <FormField label="نوع الإجراء"><select value={form.penaltyType} onChange={e => setForm({ ...form, penaltyType: e.target.value })} className={selectClass}>{["لفت نظر","إنذار خطي","خصم من الراتب","إيقاف عن العمل","أخرى"].map(x => <option key={x}>{x}</option>)}</select></FormField>
      <FormField label="تاريخ الإجراء"><Input type="date" required value={form.incidentDate} onChange={e => setForm({ ...form, incidentDate: e.target.value })}/></FormField>
      <FormField label="تفاصيل الإجراء" className="lg:col-span-2"><textarea required rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="min-h-10 w-full rounded-md border border-[#dfe5e9] bg-white px-3 py-2 text-right shadow-sm outline-none transition focus:border-[#a50f27] focus:ring-2 focus:ring-[#fbecef]"/></FormField>
      <FormField label="مبلغ الخصم (اختياري)"><Input type="number" min="0" step="0.01" value={form.deductionAmount} onChange={e => setForm({ ...form, deductionAmount: e.target.value })}/></FormField>
    </div><Button disabled={busy || !employees.length} className="mt-4 bg-[#a50f27] hover:bg-[#870c20]">{busy ? "جارٍ الحفظ..." : "حفظ الإجراء"}</Button></form>}
    <section className="overflow-hidden rounded-2xl border border-[#dfe5e9] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ebee] bg-[#fbfcfd] p-4"><h3 className="font-bold">سجل العقوبات</h3><div className="relative w-full sm:max-w-xs"><Search className="absolute right-3 top-3 size-4 text-[#7a858f]"/><Input value={search} onChange={e => setSearch(e.target.value)} className="pr-9" placeholder="ابحث عن موظف أو إجراء"/></div></div><div className="overflow-x-auto"><Table><TableHeader className="bg-[#f7f9fa]"><TableRow><TableHead>الموظف</TableHead><TableHead>نوع الإجراء</TableHead><TableHead>التاريخ</TableHead><TableHead>التفاصيل</TableHead><TableHead>الخصم</TableHead>{isAdmin && <TableHead>إجراء</TableHead>}</TableRow></TableHeader><TableBody>{filtered.map(row => <TableRow key={row.id}><TableCell className="font-semibold">{row.employeeName}<div className="text-xs text-[#7a858f]">{row.employeeNo}</div></TableCell><TableCell>{row.penaltyType}</TableCell><TableCell>{row.incidentDate}</TableCell><TableCell>{row.description}</TableCell><TableCell>{money(row.deductionAmount)}</TableCell>{isAdmin && <TableCell><Button variant="ghost" size="icon" title="حذف" onClick={() => void remove(row.id)}><Trash2 className="size-4 text-[#a50f27]"/></Button></TableCell>}</TableRow>)}{!filtered.length && <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-[#7a858f]">لا توجد سجلات عقوبات</TableCell></TableRow>}</TableBody></Table></div></section>
  </main>;
}

export function PayrollModule({ isAdmin = false }: { isAdmin?: boolean }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("");
  const [periods, setPeriods] = useState<string[]>([]);
  const [totals, setTotals] = useState({ gross: 0, deductions: 0, net: 0 });
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({ employeeNo: "", period: "", project: "", gross: "", deductions: "0", net: "" });
  useEffect(() => {
    if (!isAdmin) return;
    api("/api/hr?limit=10000").then(result => setEmployees(result.employees || [])).catch(error => toast.error(error instanceof Error ? error.message : "تعذر تحميل الموظفين"));
  }, [isAdmin]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), q: search });
      if (period) params.set("period", period);
      const result = await api(`/api/hr/payroll?${params}`);
      setEntries(result.payrollEntries || []);
      setCount(Number(result.count || 0));
      setTotals({ gross: Number(result.totals?.gross || 0), deductions: Number(result.totals?.deductions || 0), net: Number(result.totals?.net || 0) });
      setPeriods(result.periods || []);
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "تعذر تحميل الرواتب"); }
    finally { setLoading(false); }
  }, [page, pageSize, period, search]);
  useEffect(() => { void load(); }, [load]);
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  async function saveEntry(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/hr/payroll", { method: "POST", body: JSON.stringify({ ...form, period: form.period.trim() }) });
      toast.success("تم حفظ سجل الراتب");
      setForm({ employeeNo: "", period: "", project: "", gross: "", deductions: "0", net: "" });
      setPage(1);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر حفظ سجل الراتب"); }
    finally { setSaving(false); }
  }
  async function importFile(file: File) {
    setImporting(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
      const sheets = workbook.SheetNames.filter(name => name.startsWith("شهر"));
      if (!sheets.length) throw new Error("لم يتم العثور على أوراق رواتب تبدأ بكلمة «شهر»");
      const rows = sheets.flatMap(sheetName => {
        const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { range: 2 }) as Record<string, unknown>[];
        const match = sheetName.match(/(20\d{2})\D*(\d{1,2})|(\d{1,2})\D*(20\d{2})/);
        const year = match?.[1] || match?.[4];
        const month = match?.[2] || match?.[3];
        const sheetPeriod = year && month && Number(month) >= 1 && Number(month) <= 12 ? `${year}-${String(month).padStart(2, "0")}` : sheetName;
        return sheetRows.map(row => {
          const amount = (value: unknown) => {
            if (typeof value === "number") return Number.isFinite(value) ? value : 0;
            const parsed = Number(String(value ?? "0").replace(/[,٬\s]/g, "").replace(/[^\d.-]/g, ""));
            return Number.isFinite(parsed) ? parsed : 0;
          };
          return {
            employeeNo: String(row["الرقم الوظيفي"] ?? "").trim(),
            employeeName: String(row["الاسم"] ?? "").trim(),
            period: sheetPeriod,
            project: String(row["المشروع"] ?? "").trim(),
            facility: String(row["تسميات الصفوف"] || row["المركز"] || "").trim(),
            administration: String(row["الدائرة"] || "").trim(),
            gross: amount(row["الإجمالي الكلي"]),
            deductions: amount(row["اجمالي الخصم"]),
            net: amount(row["الصافي"]),
          };
        }).filter(row => row.employeeNo && row.employeeName && row.project);
      });
      if (!rows.length) throw new Error("لم يتم العثور على سجلات رواتب مكتملة (الرقم الوظيفي، الاسم، والمشروع)");
      for (let index = 0; index < rows.length; index += 300) {
        await api("/api/hr", { method: "POST", body: JSON.stringify({ type: "payroll", rows: rows.slice(index, index + 300) }) });
      }
      toast.success(`تم استيراد ${nf.format(rows.length)} سجل راتب`);
      setPage(1);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : "تعذر استيراد ملف الرواتب"); }
    finally { setImporting(false); }
  }
  return <main dir="rtl" className="text-right">
    <Heading title="الرواتب" description="عرض بيانات الرواتب المستوردة مع التصفية حسب الفترة والموظف والمشروع." icon={<WalletCards/>}/>
    <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="إجمالي الرواتب" value={money(totals.gross)} color="#176b87"/><Metric label="إجمالي الخصومات" value={money(totals.deductions)} color="#a50f27"/><Metric label="صافي الرواتب" value={money(totals.net)} color="#18794e"/></div>
    {isAdmin && <div className="mb-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <form onSubmit={saveEntry} className="rounded-2xl border border-[#dfe5e9] bg-white p-5 shadow-sm">
        <div className="mb-4 border-b border-[#e7ebee] pb-3"><h3 className="font-bold">إدخال راتب</h3><p className="mt-1 text-sm text-[#6b7681]">أدخل بيانات الراتب للفترة والمشروع المحددين.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="الموظف"><EmployeeSelect employees={employees} value={form.employeeNo} onChange={employeeNo => setForm(current => ({ ...current, employeeNo }))}/></FormField>
          <FormField label="فترة الراتب"><Input type="month" required value={form.period} onChange={e => setForm(current => ({ ...current, period: e.target.value }))}/></FormField>
          <FormField label="المشروع"><Input required value={form.project} onChange={e => setForm(current => ({ ...current, project: e.target.value }))} placeholder="اسم المشروع"/></FormField>
          <FormField label="إجمالي الراتب"><Input type="number" min="0" step="0.01" required value={form.gross} onChange={e => setForm(current => ({ ...current, gross: e.target.value }))}/></FormField>
          <FormField label="الخصومات"><Input type="number" min="0" step="0.01" required value={form.deductions} onChange={e => setForm(current => ({ ...current, deductions: e.target.value }))}/></FormField>
          <FormField label="صافي الراتب"><Input type="number" min="0" step="0.01" required value={form.net} onChange={e => setForm(current => ({ ...current, net: e.target.value }))}/></FormField>
        </div>
        <Button type="submit" disabled={saving || !employees.length} className="mt-4 bg-[#a50f27] hover:bg-[#870c20]">{saving ? "جارٍ الحفظ..." : "حفظ سجل الراتب"}</Button>
        {!employees.length && <p className="mt-2 text-sm text-[#7a858f]">يجب تحميل سجل الموظفين قبل إدخال الرواتب.</p>}
      </form>
      <section className="rounded-2xl border border-[#dfe5e9] bg-white p-5 shadow-sm"><div className="mb-4 border-b border-[#e7ebee] pb-3"><h3 className="font-bold">استيراد الرواتب من Excel</h3><p className="mt-1 text-sm text-[#6b7681]">يدعم الملف الذي يحتوي أوراقًا بأسماء تبدأ بكلمة «شهر» وبالأعمدة المعتمدة.</p></div><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#d9a6af] bg-[#fffafb] p-4"><span className="grid size-11 place-items-center rounded-xl bg-[#fbecef] text-[#a50f27]"><Upload/></span><span className="flex-1"><strong>{importing ? "جارٍ الاستيراد..." : "اختيار ملف الرواتب"}</strong><small className="mt-1 block text-[#6b7681]">Excel ‏(.xlsx / .xls)</small></span><FileSpreadsheet className="text-[#a50f27]"/><input type="file" accept=".xlsx,.xls" disabled={importing} className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value = ""; }}/></label></section>
    </div>}
    <section className="overflow-hidden rounded-2xl border border-[#dfe5e9] bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7ebee] bg-[#fbfcfd] p-4"><h3 className="font-bold">سجل الرواتب ({nf.format(count)})</h3><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><select value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }} className="h-10 rounded-md border border-[#dfe5e9] bg-white px-3 text-right shadow-sm focus:border-[#a50f27] focus:outline-none"><option value="">كل الفترات</option>{periods.map(value => <option key={value}>{value}</option>)}</select><div className="relative sm:w-64"><Search className="absolute right-3 top-3 size-4 text-[#7a858f]"/><Input value={searchInput} onChange={e => setSearchInput(e.target.value)} className="pr-9" placeholder="ابحث عن موظف أو مشروع"/></div></div></div><div className="overflow-x-auto"><Table><TableHeader className="bg-[#f7f9fa]"><TableRow><TableHead>رقم الموظف</TableHead><TableHead>اسم الموظف</TableHead><TableHead>الفترة</TableHead><TableHead>المشروع</TableHead><TableHead>مركز العمل</TableHead><TableHead>الإدارة</TableHead><TableHead>الإجمالي</TableHead><TableHead>الخصومات</TableHead><TableHead>الصافي</TableHead></TableRow></TableHeader><TableBody>{entries.map(row => <TableRow key={row.id}><TableCell>{row.employeeNo}</TableCell><TableCell className="font-semibold">{row.employeeName}</TableCell><TableCell>{row.period}</TableCell><TableCell>{row.project}</TableCell><TableCell>{row.facility || "—"}</TableCell><TableCell>{row.administration || "—"}</TableCell><TableCell>{money(row.gross)}</TableCell><TableCell>{money(row.deductions)}</TableCell><TableCell className="font-bold text-[#18794e]">{money(row.net)}</TableCell></TableRow>)}{!entries.length && <TableRow><TableCell colSpan={9} className="py-10 text-center text-[#7a858f]">{loading ? "جارٍ تحميل الرواتب..." : "لا توجد سجلات رواتب. أدخل راتبًا أو استورد ملف Excel من الأعلى."}</TableCell></TableRow>}</TableBody></Table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t bg-[#fafbfc] p-3 text-sm"><div className="flex items-center gap-2"><span>عدد الصفوف:</span><select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded-md border bg-white px-2 py-1"><option value="25">25</option><option value="50">50</option><option value="100">100</option></select><span>من {nf.format(count)}</span></div><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>السابق</Button><span>صفحة {page} من {totalPages}</span><Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>التالي</Button></div></div></section>
  </main>;
}
