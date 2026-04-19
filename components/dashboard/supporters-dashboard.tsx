"use client"

import { Download, FileSpreadsheet, LoaderCircle, Pencil, Plus, Search, Upload, Users } from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import * as XLSX from "xlsx"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SupporterAccountType, SupporterRecord, SupportersDashboardData } from "@/lib/supporters"

type DashboardTab = "accounts" | "database"

type ManualSupporterForm = {
  name: string
  accountType: SupporterAccountType
  phone: string
  email: string
}

type EditableSupporterForm = {
  id: string
  source: SupporterRecord["source"]
  name: string
  accountType: SupporterAccountType
  phone: string
  email: string
}

const accountTypeOptions: Array<{ value: SupporterAccountType; label: string }> = [
  { value: "individual", label: "أفراد" },
  { value: "institution", label: "مؤسسات" },
  { value: "charity", label: "جمعيات خيرية" },
]

const initialForm: ManualSupporterForm = {
  name: "",
  accountType: "individual",
  phone: "",
  email: "",
}

function exportRowsToExcel(fileName: string, rows: Array<Record<string, string>>) {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(workbook, worksheet, "الداعمين")
  XLSX.writeFile(workbook, fileName)
}

function accountTypeLabel(accountType: SupporterAccountType) {
  return accountTypeOptions.find((option) => option.value === accountType)?.label ?? "أفراد"
}

function sourceLabel(source: SupporterRecord["source"]) {
  return source === "registered" ? "حساب موقع" : "مدخل يدوي"
}

function normalizeAccountType(value: unknown): SupporterAccountType {
  const normalizedValue = String(value ?? "").trim().toLowerCase()

  if (["institution", "institutions", "company", "organization", "مؤسسة", "مؤسسات"].includes(normalizedValue)) {
    return "institution"
  }

  if (["charity", "charitable", "ngo", "جمعية", "جمعيات", "جمعية خيرية", "جمعيات خيرية"].includes(normalizedValue)) {
    return "charity"
  }

  return "individual"
}

function readExcelValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const exactValue = row[key]
    if (typeof exactValue === "string" && exactValue.trim()) {
      return exactValue.trim()
    }

    if (typeof exactValue === "number") {
      return String(exactValue)
    }

    const normalizedEntry = Object.entries(row).find(([entryKey]) => entryKey.trim().toLowerCase() === key.trim().toLowerCase())
    if (!normalizedEntry) {
      continue
    }

    const [, normalizedValue] = normalizedEntry
    if (typeof normalizedValue === "string" && normalizedValue.trim()) {
      return normalizedValue.trim()
    }

    if (typeof normalizedValue === "number") {
      return String(normalizedValue)
    }
  }

  return ""
}

function parseSupportersFromExcel(file: File) {
  return new Promise<ManualSupporterForm[]>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: "array" })
        const firstSheetName = workbook.SheetNames[0]
        const firstSheet = workbook.Sheets[firstSheetName]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" })

        const parsedRows = rows
          .map((row) => ({
            name: readExcelValue(row, ["name", "full_name", "الاسم", "اسم الداعم"]),
            accountType: normalizeAccountType(readExcelValue(row, ["account_type", "type", "نوع الحساب", "النوع"])),
            phone: readExcelValue(row, ["phone", "mobile", "رقم الجوال", "الجوال", "الهاتف"]),
            email: readExcelValue(row, ["email", "البريد الإلكتروني", "البريد الالكتروني"]),
          }))
          .filter((row) => row.name && row.phone)

        if (parsedRows.length === 0) {
          reject(new Error("لم يتم العثور على صفوف صالحة داخل ملف Excel"))
          return
        }

        resolve(parsedRows)
      } catch {
        reject(new Error("تعذر قراءة ملف Excel. تأكد من صحة الملف والأعمدة."))
      }
    }

    reader.onerror = () => reject(new Error("تعذر فتح ملف Excel"))
    reader.readAsArrayBuffer(file)
  })
}

function buildPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis", totalPages] as const
  }

  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const
  }

  return [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages] as const
}

function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const startIndex = (safePage - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    rows: rows.slice(startIndex, endIndex),
    page: safePage,
    totalPages,
    startIndex,
    endIndex: Math.min(endIndex, rows.length),
  }
}

function PaginationSection({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) {
    return null
  }

  const pageNumbers = buildPageNumbers(currentPage, totalPages)

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={(event) => {
              event.preventDefault()
              if (currentPage > 1) {
                onPageChange(currentPage - 1)
              }
            }}
            className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {pageNumbers.map((pageNumber, index) => (
          <PaginationItem key={`${pageNumber}-${index}`}>
            {pageNumber === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink
                href="#"
                isActive={pageNumber === currentPage}
                onClick={(event) => {
                  event.preventDefault()
                  onPageChange(pageNumber)
                }}
              >
                {pageNumber}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={(event) => {
              event.preventDefault()
              if (currentPage < totalPages) {
                onPageChange(currentPage + 1)
              }
            }}
            className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export function SupportersDashboard() {
  const [data, setData] = useState<SupportersDashboardData | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<DashboardTab>("accounts")
  const [query, setQuery] = useState("")
  const [form, setForm] = useState<ManualSupporterForm>(initialForm)
  const [accountsPage, setAccountsPage] = useState(1)
  const [databasePage, setDatabasePage] = useState(1)
  const [editingSupporter, setEditingSupporter] = useState<EditableSupporterForm | null>(null)
  const accountsExcelInputRef = useRef<HTMLInputElement>(null)
  const databaseExcelInputRef = useRef<HTMLInputElement>(null)

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
      const haystack = [
        supporter.name,
        accountTypeLabel(supporter.accountType),
        supporter.phone,
        supporter.email ?? "",
      ].join(" ").toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [data, query])

  useEffect(() => {
    setAccountsPage(1)
    setDatabasePage(1)
  }, [query])

  const accountsPagination = useMemo(() => paginateRows(filteredSupporters, accountsPage, 50), [accountsPage, filteredSupporters])
  const databasePagination = useMemo(() => paginateRows(filteredSupporters, databasePage, 100), [databasePage, filteredSupporters])

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
        body: JSON.stringify({ action: "create_manual_supporter", supporter: form }),
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

  function handleExcelImport(file: File) {
    runAction(async () => {
      const supporters = await parseSupportersFromExcel(file)
      const response = await fetch("/api/admin/supporters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import_supporters", supporters }),
      })

      const payload = (await response.json()) as { error?: string; inserted?: number; updated?: number }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر رفع ملف Excel")
      }

      setMessage({ type: "success", text: `تم استيراد ملف Excel بنجاح. تمت إضافة ${payload.inserted ?? 0} وتحديث ${payload.updated ?? 0}.` })
      await loadData()
    })
  }

  function openEditDialog(supporter: SupporterRecord) {
    setEditingSupporter({
      id: supporter.id.replace(`${supporter.source}:`, ""),
      source: supporter.source,
      name: supporter.name,
      accountType: supporter.accountType,
      phone: supporter.phone,
      email: supporter.email ?? "",
    })
  }

  function handleSaveEdit() {
    if (!editingSupporter) {
      return
    }

    runAction(async () => {
      const response = await fetch("/api/admin/supporters", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingSupporter),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر تحديث بيانات الداعم")
      }

      setMessage({ type: "success", text: "تم تحديث بيانات الداعم" })
      setEditingSupporter(null)
      await loadData()
    })
  }

  function triggerExcelPicker(target: DashboardTab) {
    if (target === "accounts") {
      accountsExcelInputRef.current?.click()
      return
    }

    databaseExcelInputRef.current?.click()
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
      <input
        ref={accountsExcelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            handleExcelImport(file)
          }
          event.currentTarget.value = ""
        }}
      />
      <input
        ref={databaseExcelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            handleExcelImport(file)
          }
          event.currentTarget.value = ""
        }}
      />

      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h1 className="text-2xl font-bold text-foreground">الداعمون</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          إضافة داعمين يدويًا أو عبر Excel، إدارة بياناتهم من نفس الصفحة، وتصفح القاعدة بترقيم واضح مع إمكانية التصدير إلى Excel.
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
            <p className="text-xs text-muted-foreground">الداعمون من الحسابات</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{data.stats.registered}</p>
          </CardContent>
        </Card>
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardContent className="p-5 text-right">
            <p className="text-xs text-muted-foreground">الداعمون المضافون يدويًا</p>
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

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)} className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[1.5rem] bg-white/90 p-2">
          <TabsTrigger value="accounts" className="rounded-xl px-4 py-2">حسابات الداعمين</TabsTrigger>
          <TabsTrigger value="database" className="rounded-xl px-4 py-2">قاعدة بيانات الداعمين</TabsTrigger>
        </TabsList>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-white/80 bg-white/95 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => exportRowsToExcel(
                activeTab === "accounts" ? "supporters-accounts.xlsx" : "supporters-database.xlsx",
                filteredSupporters.map((supporter) => ({
                  الاسم: supporter.name,
                  "نوع الحساب": accountTypeLabel(supporter.accountType),
                  "رقم الجوال": supporter.phone,
                  "البريد الإلكتروني": supporter.email ?? "",
                })),
              )}
            >
              <Download className="h-4 w-4" />
              تصدير Excel
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => triggerExcelPicker(activeTab)}>
              <Upload className="h-4 w-4" />
              رفع Excel
            </Button>
          </div>

          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input className="pr-10 text-right" placeholder="بحث بالاسم أو النوع أو الجوال أو البريد" value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
        </div>

        <TabsContent value="accounts" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>إضافة داعم يدويًا</CardTitle>
                <CardDescription>يمكنك إدخال داعم جديد يدويًا، أو استخدام رفع Excel لإضافة مجموعة دفعة واحدة.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-right">
                  <Label htmlFor="supporter-name">اسم الداعم</Label>
                  <Input id="supporter-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2 text-right">
                  <Label>نوع الحساب</Label>
                  <Select value={form.accountType} onValueChange={(value) => setForm((current) => ({ ...current, accountType: value as SupporterAccountType }))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر نوع الحساب" />
                    </SelectTrigger>
                    <SelectContent>
                      {accountTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="supporter-phone">رقم الجوال</Label>
                  <Input id="supporter-phone" dir="ltr" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="supporter-email">البريد الإلكتروني</Label>
                  <Input id="supporter-email" dir="ltr" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="اختياري" />
                </div>
                <div className="flex justify-start">
                  <Button type="button" className="rounded-xl" disabled={isPending} onClick={handleAddManualSupporter}>
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    إضافة
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>حسابات الداعمين</CardTitle>
                <CardDescription>يعرض الجدول 50 داعمًا في كل صفحة، مع ترقيم تلقائي عند زيادة العدد.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="text-sm text-muted-foreground">
                    {filteredSupporters.length === 0 ? "لا توجد نتائج" : `${accountsPagination.startIndex + 1}–${accountsPagination.endIndex} من ${filteredSupporters.length}`}
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    50 داعم لكل صفحة
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">نوع الحساب</TableHead>
                      <TableHead className="text-right">رقم الجوال</TableHead>
                      <TableHead className="text-right">البريد الإلكتروني</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountsPagination.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد بيانات مطابقة.</TableCell>
                      </TableRow>
                    ) : (
                      accountsPagination.rows.map((supporter) => (
                        <TableRow key={supporter.id}>
                          <TableCell className="text-right font-medium text-foreground">{supporter.name}</TableCell>
                          <TableCell className="text-right"><Badge variant="secondary">{accountTypeLabel(supporter.accountType)}</Badge></TableCell>
                          <TableCell className="text-right" dir="ltr">{supporter.phone}</TableCell>
                          <TableCell className="text-right" dir="ltr">{supporter.email ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => openEditDialog(supporter)} aria-label={`تعديل ${supporter.name}`}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                <PaginationSection currentPage={accountsPagination.page} totalPages={accountsPagination.totalPages} onPageChange={setAccountsPage} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>قاعدة بيانات الداعمين</CardTitle>
              <CardDescription>هذه الصفحة تعرض الجدول فقط بدون نموذج يدوي، مع رفع Excel وتصفح 100 داعم في كل صفحة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/60 bg-muted/10 px-4 py-3">
                <div className="text-sm text-muted-foreground">
                  {filteredSupporters.length === 0 ? "لا توجد نتائج" : `${databasePagination.startIndex + 1}–${databasePagination.endIndex} من ${filteredSupporters.length}`}
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  100 داعم لكل صفحة
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">نوع الحساب</TableHead>
                    <TableHead className="text-right">رقم الجوال</TableHead>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {databasePagination.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد بيانات مطابقة.</TableCell>
                    </TableRow>
                  ) : (
                    databasePagination.rows.map((supporter) => (
                      <TableRow key={supporter.id}>
                        <TableCell className="text-right font-medium text-foreground">{supporter.name}</TableCell>
                        <TableCell className="text-right"><Badge variant="outline">{accountTypeLabel(supporter.accountType)}</Badge></TableCell>
                        <TableCell className="text-right" dir="ltr">{supporter.phone}</TableCell>
                        <TableCell className="text-right" dir="ltr">{supporter.email ?? "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="ghost" size="icon" className="rounded-xl" onClick={() => openEditDialog(supporter)} aria-label={`تعديل ${supporter.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              <PaginationSection currentPage={databasePagination.page} totalPages={databasePagination.totalPages} onPageChange={setDatabasePage} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(editingSupporter)} onOpenChange={(open) => !open && setEditingSupporter(null)}>
        {editingSupporter ? (
          <DialogContent className="sm:max-w-xl">
            <DialogHeader className="text-right">
              <DialogTitle>تعديل بيانات الداعم</DialogTitle>
              <DialogDescription>
                {editingSupporter.source === "registered" ? "هذا الداعم مرتبط بحساب داخل الموقع، ويمكن تعديل بيانات الحساب الأساسية من هنا." : "يمكنك تعديل بيانات الداعم اليدوي ثم حفظها مباشرة."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2 md:grid-cols-2">
              <div className="space-y-2 text-right md:col-span-2">
                <Label htmlFor="edit-supporter-name">اسم الداعم</Label>
                <Input id="edit-supporter-name" value={editingSupporter.name} onChange={(event) => setEditingSupporter((current) => current ? { ...current, name: event.target.value } : null)} />
              </div>
              <div className="space-y-2 text-right">
                <Label>نوع الحساب</Label>
                <Select
                  value={editingSupporter.accountType}
                  onValueChange={(value) => setEditingSupporter((current) => current ? { ...current, accountType: value as SupporterAccountType } : null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر نوع الحساب" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 text-right">
                <Label htmlFor="edit-supporter-phone">رقم الجوال</Label>
                <Input id="edit-supporter-phone" dir="ltr" value={editingSupporter.phone} onChange={(event) => setEditingSupporter((current) => current ? { ...current, phone: event.target.value } : null)} />
              </div>
              <div className="space-y-2 text-right md:col-span-2">
                <Label htmlFor="edit-supporter-email">البريد الإلكتروني</Label>
                <Input id="edit-supporter-email" dir="ltr" value={editingSupporter.email} onChange={(event) => setEditingSupporter((current) => current ? { ...current, email: event.target.value } : null)} placeholder="اختياري" />
              </div>
              <div className="md:col-span-2 text-xs text-muted-foreground text-right">
                المصدر: {sourceLabel(editingSupporter.source)}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" className="rounded-xl" disabled={isPending} onClick={handleSaveEdit}>
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  )
}
