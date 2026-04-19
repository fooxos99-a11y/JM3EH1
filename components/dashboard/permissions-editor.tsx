"use client"

import { LoaderCircle, Plus, Save, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import { calculateAge, employeeGenderValues, maritalStatusValues } from "@/lib/administrative-services"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { dashboardPermissionKeys, type DashboardPermissionKey } from "@/lib/dashboard-permissions"

type AdminAccount = {
  id: string
  name: string
  phone: string
  email: string | null
  title: string
  permissions: Array<DashboardPermissionKey | "*">
  nationalId: string
  birthDate: string
  gender: (typeof employeeGenderValues)[number]
  maritalStatus: (typeof maritalStatusValues)[number]
  jobRank: string
}

const labels: Record<DashboardPermissionKey | "*", string> = {
  "*": "كل الصلاحيات",
  preparation: "التحضير",
  administrative_requests: "الطلبات الإدارية",
  services: "الخدمات",
  tasks: "المهام",
  staff_achievements: "إنجازات الموظفين",
  supporters: "المتبرعين",
  logo: "الشعار",
  hero: "الهيرو",
  donations: "فرص التبرع",
  projects: "المشاريع",
  giftings: "الإهداءات",
  achievements: "الإنجازات",
  about: "من نحن",
  news: "الأخبار",
  gallery: "المعرض",
  partners: "الشركاء",
  footer: "الفوتر",
  colors: "الألوان",
  permissions: "الصلاحيات",
}

function PermissionPicker({ value, onChange }: { value: Array<DashboardPermissionKey | "*">; onChange: (value: Array<DashboardPermissionKey | "*">) => void }) {
  const isAll = value.includes("*")

  function togglePermission(permission: DashboardPermissionKey | "*") {
    if (permission === "*") {
      onChange(isAll ? ["hero"] : ["*"])
      return
    }

    if (isAll) {
      onChange([permission])
      return
    }

    onChange(value.includes(permission) ? value.filter((item) => item !== permission) : [...value, permission])
  }

  return (
    <div className="grid gap-2 md:grid-cols-3">
      <label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm">
        <input type="checkbox" checked={isAll} onChange={() => togglePermission("*")} />
        <span>{labels["*"]}</span>
      </label>
      {dashboardPermissionKeys.filter((permission) => permission !== "permissions").map((permission) => (
        <label key={permission} className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm">
          <input type="checkbox" checked={isAll || value.includes(permission)} onChange={() => togglePermission(permission)} />
          <span>{labels[permission]}</span>
        </label>
      ))}
      <label className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm">
        <input type="checkbox" checked={isAll || value.includes("permissions")} onChange={() => togglePermission("permissions")} />
        <span>{labels.permissions}</span>
      </label>
    </div>
  )
}

const initialForm = {
  name: "",
  title: "",
  phone: "",
  email: "",
  password: "",
  nationalId: "",
  birthDate: "",
  gender: "male" as (typeof employeeGenderValues)[number],
  maritalStatus: "single" as (typeof maritalStatusValues)[number],
  jobRank: "",
  permissions: ["hero"] as Array<DashboardPermissionKey | "*">,
}

export function PermissionsEditor() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState(initialForm)

  async function loadAccounts() {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/admin-users", { cache: "no-store" })
      const payload = (await response.json()) as { accounts?: AdminAccount[]; error?: string }

      if (!response.ok) {
        setMessage({ type: "error", text: payload.error ?? "تعذر تحميل الحسابات الإدارية" })
        setAccounts([])
        return
      }

      setAccounts(payload.accounts ?? [])
    } catch {
      setMessage({ type: "error", text: "تعذر الاتصال بالخادم أثناء تحميل الحسابات" })
      setAccounts([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAccounts()
  }, [])

  const managerCount = useMemo(() => accounts.filter((account) => account.permissions.includes("*")).length, [accounts])

  function handleCreate() {
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/admin-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        })

        const payload = (await response.json()) as { error?: string }

        if (!response.ok) {
          setMessage({ type: "error", text: payload.error ?? "تعذر إنشاء الحساب الإداري" })
          return
        }

        setForm(initialForm)
        setMessage({ type: "success", text: "تم إنشاء الحساب الإداري بنجاح" })
        await loadAccounts()
      } catch {
        setMessage({ type: "error", text: "تعذر الاتصال بالخادم أثناء إنشاء الحساب" })
      }
    })
  }

  function updateAccount(index: number, field: keyof AdminAccount, value: string | Array<DashboardPermissionKey | "*">) {
    setAccounts((current) => current.map((account, accountIndex) => (accountIndex === index ? { ...account, [field]: value } : account)))
  }

  function saveAccount(account: AdminAccount) {
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/admin-users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: account.id,
            name: account.name,
            title: account.title,
            email: account.email ?? "",
            nationalId: account.nationalId,
            birthDate: account.birthDate,
            gender: account.gender,
            maritalStatus: account.maritalStatus,
            jobRank: account.jobRank,
            permissions: account.permissions,
          }),
        })

        const payload = (await response.json()) as { error?: string }
        setMessage(
          response.ok
            ? { type: "success", text: "تم تحديث الحساب" }
            : { type: "error", text: payload.error ?? "تعذر تحديث الحساب" },
        )

        if (response.ok) {
          await loadAccounts()
        }
      } catch {
        setMessage({ type: "error", text: "تعذر الاتصال بالخادم أثناء تحديث الحساب" })
      }
    })
  }

  function deleteAccount(userId: string) {
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/admin-users", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        })

        const payload = (await response.json()) as { error?: string }
        setMessage(
          response.ok
            ? { type: "success", text: "تم حذف الحساب الإداري" }
            : { type: "error", text: payload.error ?? "تعذر حذف الحساب" },
        )

        if (response.ok) {
          await loadAccounts()
        }
      } catch {
        setMessage({ type: "error", text: "تعذر الاتصال بالخادم أثناء حذف الحساب" })
      }
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-6 text-right">
          <h2 className="text-lg font-bold text-foreground">إضافة حساب إداري</h2>
          <p className="mt-1 text-sm text-muted-foreground">عدد الحسابات الكاملة الصلاحية: {managerCount}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-right"><Label htmlFor="admin-name">الاسم</Label><Input id="admin-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label htmlFor="admin-title">المسمى الوظيفي</Label><Input id="admin-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label htmlFor="admin-phone">رقم الجوال</Label><Input id="admin-phone" dir="ltr" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label htmlFor="admin-email">البريد</Label><Input id="admin-email" dir="ltr" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label htmlFor="admin-national-id">رقم الهوية</Label><Input id="admin-national-id" value={form.nationalId} onChange={(event) => setForm((current) => ({ ...current, nationalId: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label htmlFor="admin-birth-date">تاريخ الميلاد</Label><Input id="admin-birth-date" type="date" value={form.birthDate} onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>النوع</Label><Select value={form.gender} onValueChange={(value) => setForm((current) => ({ ...current, gender: value as (typeof employeeGenderValues)[number] }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">ذكر</SelectItem><SelectItem value="female">أنثى</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 text-right"><Label>الحالة الاجتماعية</Label><Select value={form.maritalStatus} onValueChange={(value) => setForm((current) => ({ ...current, maritalStatus: value as (typeof maritalStatusValues)[number] }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="single">أعزب</SelectItem><SelectItem value="married">متزوج</SelectItem><SelectItem value="divorced">مطلق</SelectItem><SelectItem value="widowed">أرمل</SelectItem></SelectContent></Select></div>
          <div className="space-y-2 text-right"><Label htmlFor="admin-job-rank">الرتبة الوظيفية</Label><Input id="admin-job-rank" value={form.jobRank} onChange={(event) => setForm((current) => ({ ...current, jobRank: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label htmlFor="admin-age">العمر</Label><Input id="admin-age" value={String(calculateAge(form.birthDate) ?? "")} disabled /></div>
          <div className="space-y-2 text-right md:col-span-2"><Label htmlFor="admin-password">كلمة المرور</Label><Input id="admin-password" type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></div>
          <div className="space-y-2 text-right md:col-span-2"><Label>الصلاحيات</Label><PermissionPicker value={form.permissions} onChange={(permissions) => setForm((current) => ({ ...current, permissions }))} /></div>
        </div>
        <div className="mt-6 flex justify-end"><Button type="button" className="rounded-xl" onClick={handleCreate} disabled={isPending}><Plus className="h-4 w-4" />إنشاء الحساب</Button></div>
      </div>

      <div className="space-y-4">
        {isLoading ? <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div> : null}
        {accounts.map((account, index) => (
          <div key={account.id} className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between"><div className="flex gap-2"><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => deleteAccount(account.id)} disabled={isPending}><Trash2 className="h-4 w-4" />حذف</Button><Button type="button" variant="outline" className="rounded-xl" onClick={() => saveAccount(account)} disabled={isPending}><Save className="h-4 w-4" />حفظ</Button></div><h3 className="text-lg font-bold text-foreground">{account.name}</h3></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-right"><Label htmlFor={`account-name-${account.id}`}>الاسم</Label><Input id={`account-name-${account.id}`} value={account.name} onChange={(event) => updateAccount(index, "name", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label htmlFor={`account-title-${account.id}`}>المسمى الوظيفي</Label><Input id={`account-title-${account.id}`} value={account.title} onChange={(event) => updateAccount(index, "title", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label htmlFor={`account-phone-${account.id}`}>رقم الجوال</Label><Input id={`account-phone-${account.id}`} value={account.phone} disabled /></div>
              <div className="space-y-2 text-right"><Label htmlFor={`account-email-${account.id}`}>البريد</Label><Input id={`account-email-${account.id}`} dir="ltr" value={account.email ?? ""} onChange={(event) => updateAccount(index, "email", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label htmlFor={`account-national-${account.id}`}>رقم الهوية</Label><Input id={`account-national-${account.id}`} value={account.nationalId} onChange={(event) => updateAccount(index, "nationalId", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label htmlFor={`account-birth-${account.id}`}>تاريخ الميلاد</Label><Input id={`account-birth-${account.id}`} type="date" value={account.birthDate} onChange={(event) => updateAccount(index, "birthDate", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label>النوع</Label><Select value={account.gender} onValueChange={(value) => updateAccount(index, "gender", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">ذكر</SelectItem><SelectItem value="female">أنثى</SelectItem></SelectContent></Select></div>
              <div className="space-y-2 text-right"><Label>الحالة الاجتماعية</Label><Select value={account.maritalStatus} onValueChange={(value) => updateAccount(index, "maritalStatus", value)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="single">أعزب</SelectItem><SelectItem value="married">متزوج</SelectItem><SelectItem value="divorced">مطلق</SelectItem><SelectItem value="widowed">أرمل</SelectItem></SelectContent></Select></div>
              <div className="space-y-2 text-right"><Label htmlFor={`account-rank-${account.id}`}>الرتبة الوظيفية</Label><Input id={`account-rank-${account.id}`} value={account.jobRank} onChange={(event) => updateAccount(index, "jobRank", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label htmlFor={`account-age-${account.id}`}>العمر</Label><Input id={`account-age-${account.id}`} value={String(calculateAge(account.birthDate) ?? "")} disabled /></div>
              <div className="space-y-2 text-right md:col-span-2"><Label>الصلاحيات</Label><PermissionPicker value={account.permissions} onChange={(permissions) => updateAccount(index, "permissions", permissions)} /></div>
            </div>
          </div>
        ))}
      </div>

      {message ? (
        <Alert className={message.type === "success" ? "rounded-[1.25rem] border-emerald-200 bg-emerald-50/85 text-emerald-900" : "rounded-[1.25rem] border-red-200 bg-red-50/85 text-red-900"}>
          <AlertTitle>{message.type === "success" ? "تمت العملية بنجاح" : "تعذر تنفيذ العملية"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
