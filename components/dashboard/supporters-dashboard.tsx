"use client"

import { Download, FileSpreadsheet, LoaderCircle, MessageSquare, Plus, Save, Search, Trash2, Users, UserSquare2 } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import * as XLSX from "xlsx"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTime } from "@/lib/administrative-services"
import type { SupporterRecord, SupportersDashboardData } from "@/lib/supporters"

type ManualSupporterForm = {
  name: string
  phone: string
  email: string
  notes: string
}

const initialForm: ManualSupporterForm = {
  name: "",
  phone: "",
  email: "",
  notes: "",
}

function exportRowsToExcel(fileName: string, rows: Array<Record<string, string>>) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, "الداعمين")
  XLSX.writeFile(workbook, fileName)
}

function sourceLabel(source: SupporterRecord["source"]) {
  return source === "registered" ? "تلقائي" : "يدوي"
}

export function SupportersDashboard() {
  const [data, setData] = useState<SupportersDashboardData | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState("")
  const [form, setForm] = useState(initialForm)

  async function loadData() {
    setLoading(true)
    const response = await fetch("/api/admin/supporters", { cache: "no-store" })
    const payload = (await response.json()) as SupportersDashboardData & { error?: string }

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "تعذر تحميل بيانات الداعمين" })
      setLoading(false)
      return
    }

    setData(payload)
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const filteredSupporters = useMemo(() => {
    if (!data) {
      return []
    }

    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
      return data.supporters
    }

    return data.supporters.filter((supporter) => {
      const haystack = [supporter.name, supporter.phone, supporter.email ?? "", supporter.notes ?? ""].join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [data, query])

  const manualSupporters = useMemo(
    () => filteredSupporters.filter((supporter) => supporter.source === "manual"),
    [filteredSupporters],
  )

  function runAction(task: () => Promise<void>) {
    setMessage(null)
    startTransition(async () => {
      try {
        await task()
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
      }
    })
  }

  function handleAddManualSupporter() {
    runAction(async () => {
      const response = await fetch("/api/admin/supporters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر إضافة الداعم")
      }

      setForm(initialForm)
      setMessage({ type: "success", text: "تمت إضافة بيانات الداعم" })
      await loadData()
    })
  }

  function handleUpdateManualSupporter(supporter: SupporterRecord) {
    if (supporter.source !== "manual") {
      return
    }

    runAction(async () => {
      const response = await fetch("/api/admin/supporters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: supporter.id.replace("manual:", ""),
          name: supporter.name,
          phone: supporter.phone,
          email: supporter.email ?? "",
          notes: supporter.notes ?? "",
        }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر تحديث بيانات الداعم")
      }

      setMessage({ type: "success", text: "تم تحديث بيانات الداعم اليدوي" })
      await loadData()
    })
  }

  function handleDeleteManualSupporter(id: string) {
    runAction(async () => {
      const response = await fetch("/api/admin/supporters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.replace("manual:", "") }),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر حذف بيانات الداعم")
      }

      setMessage({ type: "success", text: "تم حذف بيانات الداعم اليدوي" })
      await loadData()
    })
  }

  function updateSupporter(id: string, field: keyof SupporterRecord, value: string | null) {
    if (!data) {
      return
    }

    const nextSupporters = filteredSupporters.map((supporter) => (
      supporter.id === id ? { ...supporter, [field]: value } : supporter
    ))

    const nextById = new Map(nextSupporters.map((supporter) => [supporter.id, supporter]))
    setData({
      ...data,
      supporters: data.supporters.map((supporter) => nextById.get(supporter.id) ?? supporter),
      contactOnly: data.contactOnly.map((supporter) => {
        const nextSupporter = nextById.get(supporter.id)
        return nextSupporter ? { ...supporter, name: nextSupporter.name, phone: nextSupporter.phone } : supporter
      }),
    })
  }

  if (loading) {
    return (
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <Alert variant="destructive" className="rounded-[1.5rem] text-right">
        <AlertTitle>تعذر تحميل القسم</AlertTitle>
        <AlertDescription>{message?.text ?? "حدث خطأ غير متوقع أثناء تحميل بيانات الداعمين."}</AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="space-y-6 text-right">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h1 className="text-2xl font-bold text-foreground">المتبرعين</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          إدارة حسابات الداعمين، استعراض بياناتهم تلقائيًا من الحسابات المسجلة، وإضافة بيانات داعمين يدويًا مع التصدير إلى Excel وتجهيز تبويبات الرسائل.
        </p>
      </div>

      {message ? (
        <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          <AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardContent className="p-5 text-right">
            <p className="text-xs text-muted-foreground">إجمالي الداعمين</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{data.stats.total}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardContent className="p-5 text-right">
            <p className="text-xs text-muted-foreground">الداعمون التلقائيون</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{data.stats.registered}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardContent className="p-5 text-right">
            <p className="text-xs text-muted-foreground">الداعمون اليدويون</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{data.stats.manual}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardContent className="p-5 text-right">
            <p className="text-xs text-muted-foreground">الداعمون مع بريد</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{data.stats.withEmail}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="accounts" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[1.5rem] bg-white/90 p-2">
          <TabsTrigger value="accounts" className="rounded-xl px-4 py-2">إدارة حسابات الداعمين</TabsTrigger>
          <TabsTrigger value="data" className="rounded-xl px-4 py-2">بيانات الداعمين</TabsTrigger>
          <TabsTrigger value="sms" className="rounded-xl px-4 py-2">رسالة نصية للداعمين</TabsTrigger>
          <TabsTrigger value="whatsapp" className="rounded-xl px-4 py-2">رسالة واتس للداعمين</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>إدارة حسابات الداعمين</CardTitle>
              <CardDescription>جميع الداعمين يظهرون تلقائيًا بالاسم، الرقم، التاريخ بالضبط، والبريد الإلكتروني.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => exportRowsToExcel("supporters-full.xlsx", filteredSupporters.map((supporter) => ({
                    الاسم: supporter.name,
                    الرقم: supporter.phone,
                    البريد: supporter.email ?? "",
                    "تاريخ الإنشاء": formatDateTime(supporter.createdAt),
                    المصدر: sourceLabel(supporter.source),
                    ملاحظات: supporter.notes ?? "",
                  })))}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  تصدير Excel
                </Button>
                <div className="relative w-full max-w-sm">
                  <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input className="pr-10 text-right" placeholder="بحث بالاسم أو الرقم أو البريد" value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الرقم</TableHead>
                    <TableHead className="text-right">التاريخ بالضبط</TableHead>
                    <TableHead className="text-right">البريد</TableHead>
                    <TableHead className="text-right">المصدر</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSupporters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد بيانات مطابقة.</TableCell>
                    </TableRow>
                  ) : (
                    filteredSupporters.map((supporter) => (
                      <TableRow key={supporter.id}>
                        <TableCell className="text-right font-medium text-foreground">{supporter.name}</TableCell>
                        <TableCell className="text-right" dir="ltr">{supporter.phone}</TableCell>
                        <TableCell className="text-right">{formatDateTime(supporter.createdAt)}</TableCell>
                        <TableCell className="text-right" dir="ltr">{supporter.email ?? "-"}</TableCell>
                        <TableCell className="text-right"><Badge variant="secondary">{sourceLabel(supporter.source)}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>بيانات الداعمين</CardTitle>
                <CardDescription>يظهر هنا فقط الاسم والرقم لكل الداعمين، مع إمكانية التصدير والإضافة اليدوية.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => exportRowsToExcel("supporters-contacts.xlsx", data.contactOnly.map((supporter) => ({
                      الاسم: supporter.name,
                      الرقم: supporter.phone,
                      المصدر: supporter.source === "registered" ? "تلقائي" : "يدوي",
                    })))}
                  >
                    <Download className="h-4 w-4" />
                    تصدير جهات الاتصال Excel
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">الرقم</TableHead>
                      <TableHead className="text-right">المصدر</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contactOnly.map((supporter) => (
                      <TableRow key={supporter.id}>
                        <TableCell className="text-right font-medium text-foreground">{supporter.name}</TableCell>
                        <TableCell className="text-right" dir="ltr">{supporter.phone}</TableCell>
                        <TableCell className="text-right"><Badge variant="outline">{supporter.source === "registered" ? "تلقائي" : "يدوي"}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>إضافة داعم يدويًا</CardTitle>
                <CardDescription>يمكنك إضافة رقم وبيانات داعم من عندك حتى لو لم يكن لديه حساب مسجل في الموقع.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-right">
                  <Label htmlFor="supporter-name">الاسم</Label>
                  <Input id="supporter-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="supporter-phone">الرقم</Label>
                  <Input id="supporter-phone" dir="ltr" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="supporter-email">البريد</Label>
                  <Input id="supporter-email" dir="ltr" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="supporter-notes">ملاحظات</Label>
                  <Textarea id="supporter-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-24" />
                </div>
                <div className="flex justify-start">
                  <Button type="button" className="rounded-xl" disabled={isPending} onClick={handleAddManualSupporter}>
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    إضافة داعم
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>الداعمون اليدويون</CardTitle>
              <CardDescription>يمكنك تعديل أو حذف السجلات اليدوية فقط. الداعمون التلقائيون يأتون من حسابات الموقع مباشرة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {manualSupporters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center text-muted-foreground">لا توجد سجلات يدوية مطابقة حاليًا.</div>
              ) : (
                manualSupporters.map((supporter, index) => (
                  <div key={supporter.id} className="rounded-[1.25rem] border border-border/60 bg-muted/10 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => handleDeleteManualSupporter(supporter.id)} disabled={isPending}>
                          <Trash2 className="h-4 w-4" />
                          حذف
                        </Button>
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => handleUpdateManualSupporter(supporter)} disabled={isPending}>
                          <Save className="h-4 w-4" />
                          حفظ
                        </Button>
                      </div>
                      <h3 className="font-semibold text-foreground">{supporter.name}</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 text-right">
                        <Label>الاسم</Label>
                        <Input value={supporter.name} onChange={(event) => updateSupporter(supporter.id, "name", event.target.value)} />
                      </div>
                      <div className="space-y-2 text-right">
                        <Label>الرقم</Label>
                        <Input dir="ltr" value={supporter.phone} onChange={(event) => updateSupporter(supporter.id, "phone", event.target.value)} />
                      </div>
                      <div className="space-y-2 text-right">
                        <Label>البريد</Label>
                        <Input dir="ltr" value={supporter.email ?? ""} onChange={(event) => updateSupporter(supporter.id, "email", event.target.value)} />
                      </div>
                      <div className="space-y-2 text-right">
                        <Label>الملاحظات</Label>
                        <Textarea value={supporter.notes ?? ""} onChange={(event) => updateSupporter(supporter.id, "notes", event.target.value)} className="min-h-24" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">جاهز للتطوير</Badge>
                <CardTitle>رسالة نصية للداعمين</CardTitle>
              </div>
              <CardDescription>هذا التبويب جاهز للمرحلة التالية. عند شرحك لطريقة الإرسال سنربطه بمزود الرسائل النصية وبنطاق المستلمين.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                <Users className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">عدد الأرقام المتاحة</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{data.contactOnly.length}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                <MessageSquare className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">الحالة الحالية</p>
                <p className="mt-2 text-sm text-muted-foreground">واجهة جاهزة بانتظار تفاصيل الصياغة وآلية الإرسال.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                <FileSpreadsheet className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">تصدير المستلمين</p>
                <Button type="button" variant="outline" className="mt-3 rounded-xl" onClick={() => exportRowsToExcel("supporters-sms-list.xlsx", data.contactOnly.map((supporter) => ({ الاسم: supporter.name, الرقم: supporter.phone })))}>
                  تصدير قائمة SMS
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">جاهز للتطوير</Badge>
                <CardTitle>رسالة واتس للداعمين</CardTitle>
              </div>
              <CardDescription>هذا التبويب موجود الآن كبنية جاهزة. عندما تشرح آلية الرسائل سنربطه بقالب الرسالة ومجموعة المستلمين وخيار الإرسال أو التصدير.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                <UserSquare2 className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">الداعمون المتاحون</p>
                <p className="mt-2 text-2xl font-bold text-foreground">{data.contactOnly.length}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                <MessageSquare className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">المرحلة الحالية</p>
                <p className="mt-2 text-sm text-muted-foreground">واجهة تمهيدية جاهزة حتى نحدد لاحقًا نوع التكامل مع واتساب.</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                <FileSpreadsheet className="mb-3 h-5 w-5 text-primary" />
                <p className="font-semibold text-foreground">تصدير قائمة واتس</p>
                <Button type="button" variant="outline" className="mt-3 rounded-xl" onClick={() => exportRowsToExcel("supporters-whatsapp-list.xlsx", data.contactOnly.map((supporter) => ({ الاسم: supporter.name, الرقم: supporter.phone })))}>
                  تصدير قائمة واتس
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </section>
  )
}
