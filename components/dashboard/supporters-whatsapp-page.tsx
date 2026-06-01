"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, FileSpreadsheet, LoaderCircle, MessageSquareText, QrCode, RefreshCcw, Save, Send, Users } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { WhatsAppQrDialog } from "@/components/dashboard/whatsapp-qr-dialog"
import type { SupporterRecord, SupportersDashboardData } from "@/lib/supporters"
import { type WhatsAppWorkerStatus } from "@/lib/whatsapp-config"

type RecipientSource = SupporterRecord["source"] | "excel" | "saved"

type RecipientOption = {
  key: string
  name: string
  phone: string
  email: string | null
  source: RecipientSource
}

type SavedRecipientList = {
  id: string
  name: string
  createdAt: string
  recipients: Array<{
    name: string
    phone: string
  }>
}

const WHATSAPP_PICKED_PHONES_STORAGE_KEY = "supporters-whatsapp-picked-phones"

function normalizePhoneInput(rawPhone: string) {
  const latinDigits = rawPhone
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d+]/g, "")

  if (latinDigits.startsWith("00966")) {
    return `+${latinDigits.slice(2)}`
  }

  if (latinDigits.startsWith("966")) {
    return `+${latinDigits}`
  }

  if (latinDigits.startsWith("05") && latinDigits.length === 10) {
    return `+966${latinDigits.slice(1)}`
  }

  if (latinDigits.startsWith("5") && latinDigits.length === 9) {
    return `+966${latinDigits}`
  }

  return latinDigits.startsWith("+") ? latinDigits : `+${latinDigits}`
}

function isClientPhoneValid(phone: string) {
  return /^\+\d{9,15}$/.test(phone)
}

async function loadXlsx() {
  return import("xlsx")
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

function parseRecipientsFromExcel(file: File) {
  return new Promise<Array<{ name: string; phone: string }>>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        const XLSX = await loadXlsx()
        const workbook = XLSX.read(event.target?.result, { type: "array" })
        const firstSheetName = workbook.SheetNames[0]
        const firstSheet = workbook.Sheets[firstSheetName]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" })

        const parsedRows = rows
          .map((row) => {
            const name = readExcelValue(row, ["name", "full_name", "الاسم", "اسم الداعم", "اسم المستلم"])
            const phone = normalizePhoneInput(readExcelValue(row, ["phone", "mobile", "رقم الجوال", "الجوال", "الهاتف"]))

            return {
              name: name || phone,
              phone,
            }
          })
          .filter((row) => row.phone && isClientPhoneValid(row.phone))

        if (parsedRows.length === 0) {
          reject(new Error("لم يتم العثور على أرقام صالحة داخل ملف Excel"))
          return
        }

        resolve(Array.from(new Map(parsedRows.map((row) => [row.phone, row])).values()))
      } catch {
        reject(new Error("تعذر قراءة ملف Excel. تأكد من صحة الملف والأعمدة."))
      }
    }

    reader.onerror = () => reject(new Error("تعذر فتح ملف Excel"))
    reader.readAsArrayBuffer(file)
  })
}

function personalizeMessage(template: string, recipient: Pick<RecipientOption, "name" | "phone">) {
  return template.replace(/\{\{\s*name\s*\}\}/gi, recipient.name || recipient.phone)
}

function getConnectionBadge(status: WhatsAppWorkerStatus | null) {
  if (!status) {
    return { label: "جاري التحقق", tone: "secondary" as const }
  }

  if (status.workerOnline && status.ready && status.authenticated && status.status === "connected") {
    return { label: "متصل", tone: "default" as const }
  }

  if (status.qrAvailable) {
    return { label: "بانتظار المسح", tone: "secondary" as const }
  }

  return { label: "غير متصل", tone: "outline" as const }
}

export function SupportersWhatsAppPage() {
  const [data, setData] = useState<SupportersDashboardData | null>(null)
  const [status, setStatus] = useState<WhatsAppWorkerStatus | null>(null)
  const [savedLists, setSavedLists] = useState<SavedRecipientList[]>([])
  const [query, setQuery] = useState("")
  const [message, setMessage] = useState("")
  const [selectedPhones, setSelectedPhones] = useState<string[]>([])
  const [customRecipients, setCustomRecipients] = useState<RecipientOption[]>([])
  const [selectedSavedListId, setSelectedSavedListId] = useState("")
  const [savedListName, setSavedListName] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isSavingList, setIsSavingList] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const excelInputRef = useRef<HTMLInputElement>(null)

  async function loadSavedLists() {
    const response = await fetch("/api/whatsapp/lists", { cache: "no-store" })
    const payload = (await response.json()) as { error?: string; lists?: SavedRecipientList[] }

    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر تحميل القوائم المحفوظة")
    }

    setSavedLists(payload.lists ?? [])
  }

  async function loadPageData() {
    setIsLoading(true)
    try {
      const [supportersResponse, statusResponse] = await Promise.all([
        fetch("/api/admin/supporters", { cache: "no-store" }),
        fetch("/api/whatsapp/status", { cache: "no-store" }),
      ])

      const supportersPayload = (await supportersResponse.json()) as SupportersDashboardData & { error?: string }
      const statusPayload = (await statusResponse.json()) as WhatsAppWorkerStatus & { error?: string }

      if (!supportersResponse.ok) {
        throw new Error(supportersPayload.error ?? "تعذر تحميل الداعمين")
      }

      if (!statusResponse.ok) {
        throw new Error(statusPayload.error ?? "تعذر تحميل حالة واتساب")
      }

      setData(supportersPayload)
      setStatus(statusPayload)

      try {
        await loadSavedLists()
      } catch (error) {
        setFeedback({ type: "error", text: error instanceof Error ? error.message : "تعذر تحميل القوائم المحفوظة" })
      }
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "تعذر تحميل الصفحة" })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPageData()
  }, [])

  useEffect(() => {
    function consumePickedPhones() {
      try {
        const rawValue = window.localStorage.getItem(WHATSAPP_PICKED_PHONES_STORAGE_KEY)
        if (!rawValue) {
          return
        }

        const parsedPhones = JSON.parse(rawValue)
        if (Array.isArray(parsedPhones)) {
          const nextPhones = parsedPhones.map((phone) => String(phone || "").trim()).filter(Boolean)
          if (nextPhones.length > 0) {
            setSelectedPhones((current) => Array.from(new Set([...current, ...nextPhones])))
            setFeedback({ type: "success", text: `تم استيراد ${nextPhones.length} رقم من صفحة إدارة الداعمين.` })
          }
        }

        window.localStorage.removeItem(WHATSAPP_PICKED_PHONES_STORAGE_KEY)
      } catch {
        window.localStorage.removeItem(WHATSAPP_PICKED_PHONES_STORAGE_KEY)
      }
    }

    consumePickedPhones()
    window.addEventListener("focus", consumePickedPhones)

    return () => {
      window.removeEventListener("focus", consumePickedPhones)
    }
  }, [])

  const supporterRecipients = useMemo<RecipientOption[]>(() => {
    return (data?.supporters ?? []).map((supporter) => ({
      key: supporter.id,
      name: supporter.name,
      phone: supporter.phone,
      email: supporter.email,
      source: supporter.source,
    }))
  }, [data])

  const availableRecipients = useMemo<RecipientOption[]>(() => {
    const recipientsByPhone = new Map<string, RecipientOption>()

    for (const recipient of supporterRecipients) {
      recipientsByPhone.set(recipient.phone, recipient)
    }

    for (const recipient of customRecipients) {
      if (!recipientsByPhone.has(recipient.phone)) {
        recipientsByPhone.set(recipient.phone, recipient)
      }
    }

    return Array.from(recipientsByPhone.values())
  }, [customRecipients, supporterRecipients])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredRecipients = useMemo(() => {
    if (!normalizedQuery) {
      return availableRecipients
    }

    return availableRecipients.filter((recipient) => {
      const haystack = [recipient.name, recipient.phone, recipient.email ?? ""].join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [availableRecipients, normalizedQuery])

  const selectedRecipients = useMemo(() => {
    const recipientsByPhone = new Map(availableRecipients.map((recipient) => [recipient.phone, recipient]))
    return selectedPhones.map((phone) => recipientsByPhone.get(phone)).filter(Boolean) as RecipientOption[]
  }, [availableRecipients, selectedPhones])

  const connectionBadge = getConnectionBadge(status)
  const canSend = Boolean(message.trim() && selectedRecipients.length > 0 && status?.workerOnline && status.ready && status.authenticated && status.status === "connected")

  function mergeCustomRecipients(entries: Array<{ name: string; phone: string; source: RecipientSource }>) {
    setCustomRecipients((current) => {
      const recipientsByPhone = new Map(current.map((recipient) => [recipient.phone, recipient]))

      for (const entry of entries) {
        const normalizedPhone = normalizePhoneInput(entry.phone)
        if (!isClientPhoneValid(normalizedPhone)) {
          continue
        }

        recipientsByPhone.set(normalizedPhone, {
          key: `${entry.source}:${normalizedPhone}`,
          name: entry.name.trim() || normalizedPhone,
          phone: normalizedPhone,
          email: null,
          source: entry.source,
        })
      }

      return Array.from(recipientsByPhone.values())
    })
  }

  function toggleRecipientSelection(phone: string, checked: boolean) {
    setSelectedPhones((current) => checked ? Array.from(new Set([...current, phone])) : current.filter((entry) => entry !== phone))
  }

  function toggleSelectAllFiltered(checked: boolean) {
    if (checked) {
      setSelectedPhones((current) => Array.from(new Set([...current, ...filteredRecipients.map((recipient) => recipient.phone)])))
      return
    }

    setSelectedPhones((current) => current.filter((entry) => !filteredRecipients.some((recipient) => recipient.phone === entry)))
  }

  async function handleExcelImport(file: File) {
    try {
      const recipients = await parseRecipientsFromExcel(file)
      mergeCustomRecipients(recipients.map((recipient) => ({ ...recipient, source: "excel" as const })))
      setSelectedPhones((current) => Array.from(new Set([...current, ...recipients.map((recipient) => recipient.phone)])))
      setFeedback({ type: "success", text: `تم استيراد ${recipients.length} رقم من ملف Excel.` })
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "تعذر قراءة ملف Excel" })
    }
  }

  async function handleSaveCurrentSelection() {
    if (!savedListName.trim()) {
      setFeedback({ type: "error", text: "اكتب اسمًا للقائمة قبل حفظها." })
      return
    }

    if (selectedRecipients.length === 0) {
      setFeedback({ type: "error", text: "اختر أرقامًا أولًا ثم احفظها كقائمة." })
      return
    }

    try {
      setIsSavingList(true)
      const response = await fetch("/api/whatsapp/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: savedListName,
          recipients: selectedRecipients.map((recipient) => ({ name: recipient.name, phone: recipient.phone })),
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر حفظ القائمة")
      }

      await loadSavedLists()
      setSavedListName("")
      setFeedback({ type: "success", text: "تم حفظ القائمة بنجاح." })
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "تعذر حفظ القائمة" })
    } finally {
      setIsSavingList(false)
    }
  }

  function handleApplySavedList() {
    const selectedList = savedLists.find((list) => list.id === selectedSavedListId)
    if (!selectedList) {
      setFeedback({ type: "error", text: "اختر قائمة محفوظة أولًا." })
      return
    }

    mergeCustomRecipients(selectedList.recipients.map((recipient) => ({ ...recipient, source: "saved" as const })))
    setSelectedPhones(
      Array.from(
        new Set(
          selectedList.recipients
            .map((recipient) => normalizePhoneInput(recipient.phone))
            .filter((phone) => isClientPhoneValid(phone)),
        ),
      ),
    )
    setFeedback({ type: "success", text: `تم تحميل قائمة ${selectedList.name}.` })
  }

  async function handleSend() {
    if (!canSend) {
      return
    }

    try {
      setIsSending(true)
      setFeedback(null)

      const recipients = selectedRecipients.map((recipient) => ({
        phoneNumber: recipient.phone,
        message: personalizeMessage(message, recipient),
      }))

      const response = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, recipients }),
      })

      const payload = await response.json() as { error?: string; queuedCount?: number; invalidPhoneCount?: number; missingPhoneCount?: number }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر إضافة الرسائل إلى طابور واتساب")
      }

      setFeedback({
        type: "success",
        text: `تمت إضافة ${payload.queuedCount ?? 0} رسالة للطابور.${(payload.invalidPhoneCount || payload.missingPhoneCount) ? ` تم تجاوز ${Number(payload.invalidPhoneCount || 0) + Number(payload.missingPhoneCount || 0)} سجل غير صالح.` : ""}`,
      })
    } catch (error) {
      setFeedback({ type: "error", text: error instanceof Error ? error.message : "تعذر إرسال الرسائل" })
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <section className="space-y-6 text-right">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center justify-end gap-3">
              <Badge variant={connectionBadge.tone}>{connectionBadge.label}</Badge>
              <h1 className="text-2xl font-bold text-foreground">الإرسال الجماعي عبر الواتس</h1>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              اختر المستلمين من إدارة الداعمين أو من ملف Excel، واحفظ أي مجموعة كقائمة جاهزة. يمكنك استخدام `{{name}}` لإدراج اسم المستلم تلقائيًا داخل الرسالة.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button asChild type="button" variant="outline" className="rounded-2xl">
              <Link href="/dashboard/supporters">
                <ArrowRight className="h-4 w-4" />
                الرجوع للمتبرعين
              </Link>
            </Button>
            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => void loadPageData()}>
              <RefreshCcw className="h-4 w-4" />
              تحديث
            </Button>
            <Button type="button" className="rounded-2xl" onClick={() => setIsQrOpen(true)}>
              <QrCode className="h-4 w-4" />
              ربط واتساب
            </Button>
          </div>
        </div>
      </div>

      {feedback ? (
        <Alert className={feedback.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          <AlertTitle>{feedback.type === "success" ? "تمت العملية" : "يوجد تنبيه"}</AlertTitle>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center justify-end gap-2">
              <MessageSquareText className="h-5 w-5 text-primary" />
              الرسالة
            </CardTitle>
            <CardDescription className="text-right">كل مستلم سيأخذ الرسالة مع استبدال `{{name}}` باسمه إذا استخدمت المتغير.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                <div className="text-sm text-muted-foreground">إجمالي المختارين</div>
                <div className="mt-2 text-2xl font-black text-foreground">{selectedPhones.length}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                <div className="text-sm text-muted-foreground">المتاح في الفلتر</div>
                <div className="mt-2 text-2xl font-black text-foreground">{filteredRecipients.length}</div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
                <div className="text-sm text-muted-foreground">حالة الربط</div>
                <div className="mt-2 flex justify-end">
                  <Badge variant={connectionBadge.tone}>{connectionBadge.label}</Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1fr,1fr]">
              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => excelInputRef.current?.click()}>
                    <FileSpreadsheet className="h-4 w-4" />
                    الرفع من Excel
                  </Button>
                  <Button asChild type="button" variant="outline" className="rounded-2xl">
                    <Link href="/dashboard/supporters?picker=whatsapp">
                      <Users className="h-4 w-4" />
                      من إدارة الداعمين
                    </Link>
                  </Button>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  ارفع ملفًا يحوي الاسم والجوال، أو انتقل إلى صفحة إدارة الداعمين وحدد الأرقام التي تريدها ثم أعدها هنا.
                </p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr,180px]">
                  <Input value={savedListName} onChange={(event) => setSavedListName(event.target.value)} placeholder="اسم القائمة الجديدة" className="text-right" />
                  <Button type="button" variant="outline" className="rounded-2xl" disabled={isSavingList} onClick={() => void handleSaveCurrentSelection()}>
                    {isSavingList ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    حفظ المحددين
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,150px]">
                  <Select value={selectedSavedListId} onValueChange={setSelectedSavedListId}>
                    <SelectTrigger className="w-full text-right [&>span]:text-right">
                      <SelectValue placeholder="اختر قائمة محفوظة" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>{`${list.name} (${list.recipients.length})`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" className="rounded-2xl" disabled={!selectedSavedListId} onClick={handleApplySavedList}>
                    تحميل القائمة
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supporters-whatsapp-message">نص الرسالة</Label>
              <Textarea
                id="supporters-whatsapp-message"
                rows={9}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="مثال: السلام عليكم {{name}}، نود تزويدك بتحديث جديد عن برامج الجمعية..."
                className="min-h-52 text-right"
              />
            </div>

            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm leading-7 text-muted-foreground">
              <p>معاينة لأول مستلم:</p>
              <p className="mt-2 font-semibold text-foreground">
                {selectedRecipients[0] ? personalizeMessage(message || "", selectedRecipients[0]) || "اكتب الرسالة لتظهر المعاينة هنا." : "اختر رقمًا واحدًا على الأقل لتظهر المعاينة هنا."}
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="button" className="rounded-2xl" disabled={!canSend || isSending} onClick={() => void handleSend()}>
                {isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isSending ? "جاري الإضافة إلى الطابور" : "إرسال الرسائل"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardHeader>
            <CardTitle className="flex items-center justify-end gap-2">
              <Users className="h-5 w-5 text-primary" />
              قائمة المستلمين
            </CardTitle>
            <CardDescription className="text-right">البحث يعمل على الأرقام المرفوعة من Excel، والقوائم المحفوظة، والداعمين الموجودين داخل النظام.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="supporters-whatsapp-search">البحث</Label>
              <Input id="supporters-whatsapp-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو الجوال أو البريد" className="text-right" />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
              <div className="text-sm text-muted-foreground">{selectedPhones.length} محدد</div>
              <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <span>تحديد كل النتائج</span>
                <Checkbox
                  checked={filteredRecipients.length > 0 && filteredRecipients.every((recipient) => selectedPhones.includes(recipient.phone))}
                  onCheckedChange={(checked) => toggleSelectAllFiltered(Boolean(checked))}
                />
              </label>
            </div>

            <ScrollArea className="h-[520px] rounded-2xl border border-border/60">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الجوال</TableHead>
                    <TableHead className="text-right">المصدر</TableHead>
                    <TableHead className="text-right">تحديد</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecipients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">لا توجد نتائج مطابقة.</TableCell>
                    </TableRow>
                  ) : filteredRecipients.map((recipient) => (
                    <TableRow key={recipient.key}>
                      <TableCell className="text-right font-medium">{recipient.name}</TableCell>
                      <TableCell className="text-right" dir="ltr">{recipient.phone}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{recipient.source === "registered" ? "حساب موقع" : recipient.source === "manual" ? "يدوي" : recipient.source === "excel" ? "Excel" : "قائمة محفوظة"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Checkbox checked={selectedPhones.includes(recipient.phone)} onCheckedChange={(checked) => toggleRecipientSelection(recipient.phone, Boolean(checked))} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void handleExcelImport(file)
          }
          event.currentTarget.value = ""
        }}
      />

      <WhatsAppQrDialog open={isQrOpen} onOpenChange={setIsQrOpen} initialStatus={status} />
    </section>
  )
}