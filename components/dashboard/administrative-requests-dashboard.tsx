"use client"

import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import {
  administrativeRequestTypeValues,
  calculateAge,
  calculateLeaveDays,
  formatDate,
  getAdministrativeRequestStatusLabel,
  getAdministrativeRequestTypeLabel,
  getGenderLabel,
  getMaritalStatusLabel,
  type AdministrativeDashboardData,
  type AdministrativeRequestRecord,
} from "@/lib/administrative-services"
import { AttendancePanel } from "@/components/dashboard/attendance-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

const initialRequestForm = {
  requestType: "leave" as (typeof administrativeRequestTypeValues)[number],
  targetUserId: "",
  subject: "",
  details: "",
  amountRequested: "",
  startDate: "",
  endDate: "",
  requestDate: "",
  fromTime: "",
  toTime: "",
}

const rtlInputClassName = "text-right [&::placeholder]:text-right"
const rtlLabelClassName = "block text-right"
const rtlSelectTriggerClassName = "w-full text-right [&>span]:text-right"
const rtlDatePickerClassName = "flex-row-reverse text-right [&>span]:text-right"
const allEmployeesValue = "all_accounts"

function getStatusVariant(status: AdministrativeRequestRecord["status"]) {
  if (status === "approved") return "default"
  if (status === "rejected") return "destructive"
  if (status === "cancelled") return "outline"
  return "secondary"
}

function getRequestStatusText(request: AdministrativeRequestRecord) {
  if (request.requestType === "internal_transaction" && request.status === "approved") {
    return "تم الإرسال"
  }

  return getAdministrativeRequestStatusLabel(request.status)
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value || "-"}</p>
    </div>
  )
}

function BalanceMetric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4 text-right shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function CompactBalanceMetric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-right">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function RecordSummaryCard({ title, summary, hint }: { title: string; summary: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 text-right">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm font-medium leading-7 text-foreground">{summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function getTimeRangeMinutes(fromTime: string | null, toTime: string | null) {
  if (!fromTime || !toTime) {
    return 0
  }

  const fromMatch = fromTime.match(/^(\d{1,2}):(\d{2})/)
  const toMatch = toTime.match(/^(\d{1,2}):(\d{2})/)
  if (!fromMatch || !toMatch) {
    return 0
  }

  const fromMinutes = Number(fromMatch[1]) * 60 + Number(fromMatch[2])
  const toMinutes = Number(toMatch[1]) * 60 + Number(toMatch[2])
  return Number.isNaN(fromMinutes) || Number.isNaN(toMinutes) || toMinutes <= fromMinutes ? 0 : toMinutes - fromMinutes
}

function formatMinutesLabel(value: number) {
  return `${value} دقيقة`
}

type EmploymentSectionKey = "attendance" | "requests" | "leave" | "permissions" | "warnings" | "interrogations"

const employmentSectionItems: Array<{ key: EmploymentSectionKey; label: string }> = [
  { key: "attendance", label: "الحضور" },
  { key: "interrogations", label: "سجل المسائلات" },
  { key: "requests", label: "سجل الطلبات" },
  { key: "leave", label: "سجل الإجازات" },
  { key: "permissions", label: "سجل الإذونات" },
  { key: "warnings", label: "سجل الإنذارات" },
]

function EmploymentSectionButtons({ value, onChange }: { value: EmploymentSectionKey; onChange: (value: EmploymentSectionKey) => void }) {
  return (
    <div className="flex w-full flex-wrap justify-start gap-2" dir="rtl">
      {employmentSectionItems.map((item) => (
        <Button
          key={item.key}
          type="button"
          variant={value === item.key ? "default" : "outline"}
          className="rounded-xl"
          onClick={() => onChange(item.key)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
}

function EmptyEmploymentTable({ message }: { message: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">البيان</TableHead>
          <TableHead className="text-right">القيمة</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={2} className="py-8 text-center text-muted-foreground">{message}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

function formatTimeOrDash(value: string | null) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function EmploymentRecordsTable({
  section,
  requests,
  attendanceRecords,
  leaveBalance,
}: {
  section: EmploymentSectionKey
  requests: AdministrativeRequestRecord[]
  attendanceRecords: AdministrativeDashboardData["attendanceHistory"]
  leaveBalance: AdministrativeDashboardData["leaveBalance"]
}) {
  if (section === "attendance") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">التاريخ</TableHead>
            <TableHead className="text-right">الحضور</TableHead>
            <TableHead className="text-right">الانصراف</TableHead>
            <TableHead className="text-right">عدد الساعات</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">الملاحظة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendanceRecords.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد سجلات حضور لهذا الموظف.</TableCell>
            </TableRow>
          ) : (
            attendanceRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="text-right">{formatDate(record.workDate)}</TableCell>
                <TableCell className="text-right">{formatTimeOrDash(record.clockInAt)}</TableCell>
                <TableCell className="text-right">{formatTimeOrDash(record.clockOutAt)}</TableCell>
                <TableCell className="text-right">{record.workedMinutes > 0 ? formatMinutesLabel(record.workedMinutes) : "-"}</TableCell>
                <TableCell className="text-right"><Badge variant={record.status === "present" ? "default" : "secondary"}>{record.status === "present" ? "مكتمل" : "غير مكتمل"}</Badge></TableCell>
                <TableCell className="max-w-[320px] whitespace-normal text-right text-sm text-muted-foreground">{record.notes || "-"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    )
  }

  if (section === "requests") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">النوع</TableHead>
            <TableHead className="text-right">العنوان</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">التاريخ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">لا توجد طلبات مسجلة لهذا الموظف.</TableCell>
            </TableRow>
          ) : (
            requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="text-right">{getAdministrativeRequestTypeLabel(request.requestType)}</TableCell>
                <TableCell className="text-right">
                  <div className="space-y-1">
                    <p>{request.subject}</p>
                    {request.requestType === "internal_transaction" && request.targetUserName ? <p className="text-xs text-muted-foreground">إلى: {request.targetUserName}</p> : null}
                  </div>
                </TableCell>
                <TableCell className="text-right"><Badge variant={getStatusVariant(request.status)}>{getRequestStatusText(request)}</Badge></TableCell>
                <TableCell className="text-right">{formatDate(request.createdAt)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    )
  }

  if (section === "leave") {
    const leaveRequests = requests.filter((request) => request.requestType === "leave")
    const leaveRemaining = leaveBalance.leaveQuotaDays - leaveBalance.leaveTakenDays

    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">العنوان</TableHead>
              <TableHead className="text-right">المدة</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">التاريخ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaveRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">لا توجد إجازات مسجلة لهذا الموظف.</TableCell>
              </TableRow>
            ) : (
              leaveRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="text-right">{request.subject}</TableCell>
                  <TableCell className="text-right">{request.startDate && request.endDate ? `${calculateLeaveDays(request.startDate, request.endDate)} يوم` : "-"}</TableCell>
                  <TableCell className="text-right"><Badge variant={getStatusVariant(request.status)}>{getAdministrativeRequestStatusLabel(request.status)}</Badge></TableCell>
                  <TableCell className="text-right">{formatDate(request.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="grid gap-3 md:grid-cols-1">
          <CompactBalanceMetric label="المتبقي من رصيد الإجازات" value={leaveRemaining} hint="المتاح لطلبات الإجازة القادمة." />
        </div>
      </div>
    )
  }

  if (section === "permissions") {
    const permissionRequests = requests.filter((request) => request.requestType === "permission")
    const permissionRemaining = leaveBalance.permissionQuotaMinutes - leaveBalance.permissionUsedMinutes

    return (
      <div className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">العنوان</TableHead>
              <TableHead className="text-right">المدة</TableHead>
              <TableHead className="text-right">من</TableHead>
              <TableHead className="text-right">إلى</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">التاريخ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {permissionRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد أذونات مسجلة لهذا الموظف.</TableCell>
              </TableRow>
            ) : (
              permissionRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell className="text-right">{request.subject}</TableCell>
                  <TableCell className="text-right">{formatMinutesLabel(getTimeRangeMinutes(request.fromTime, request.toTime))}</TableCell>
                  <TableCell className="text-right">{formatTimeOrDash(request.fromTime)}</TableCell>
                  <TableCell className="text-right">{formatTimeOrDash(request.toTime)}</TableCell>
                  <TableCell className="text-right"><Badge variant={getStatusVariant(request.status)}>{getAdministrativeRequestStatusLabel(request.status)}</Badge></TableCell>
                  <TableCell className="text-right">{formatDate(request.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="grid gap-3 md:grid-cols-1">
          <CompactBalanceMetric label="المتبقي من دقائق الاستئذان" value={permissionRemaining} hint="المتاح لطلبات الاستئذان القادمة بالدقائق." />
        </div>
      </div>
    )
  }

  if (section === "warnings") {
    const warningRecords = attendanceRecords.filter((record) => record.status === "incomplete" || Boolean(record.notes))

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">التاريخ</TableHead>
            <TableHead className="text-right">الحالة</TableHead>
            <TableHead className="text-right">الدخول</TableHead>
            <TableHead className="text-right">الخروج</TableHead>
            <TableHead className="text-right">الملاحظة</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {warningRecords.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد إنذارات فعلية مسجلة لهذا الموظف.</TableCell>
            </TableRow>
          ) : (
            warningRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell className="text-right">{formatDate(record.workDate)}</TableCell>
                <TableCell className="text-right"><Badge variant="destructive">{record.status === "incomplete" ? "سجل حضور ناقص" : "ملاحظة إدارية"}</Badge></TableCell>
                <TableCell className="text-right">{formatTimeOrDash(record.clockInAt)}</TableCell>
                <TableCell className="text-right">{formatTimeOrDash(record.clockOutAt)}</TableCell>
                <TableCell className="max-w-[320px] whitespace-normal text-right text-sm text-muted-foreground">{record.notes || "لا يوجد تسجيل دخول أو خروج مكتمل لهذا اليوم."}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    )
  }

  const interrogationRecords = requests.filter((request) => request.status === "rejected" || request.status === "cancelled")

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">النوع</TableHead>
          <TableHead className="text-right">العنوان</TableHead>
          <TableHead className="text-right">الحالة</TableHead>
          <TableHead className="text-right">سبب الإجراء</TableHead>
          <TableHead className="text-right">تاريخ الإجراء</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {interrogationRecords.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد مسائلات فعلية مسجلة لهذا الموظف.</TableCell>
          </TableRow>
        ) : (
          interrogationRecords.map((request) => (
            <TableRow key={request.id}>
              <TableCell className="text-right">{getAdministrativeRequestTypeLabel(request.requestType)}</TableCell>
              <TableCell className="text-right">{request.subject}</TableCell>
              <TableCell className="text-right"><Badge variant={getStatusVariant(request.status)}>{getAdministrativeRequestStatusLabel(request.status)}</Badge></TableCell>
              <TableCell className="max-w-[320px] whitespace-normal text-right text-sm text-muted-foreground">{request.rejectionReason || request.details || "تم إلغاء الطلب بدون ملاحظة إضافية."}</TableCell>
              <TableCell className="text-right">{formatDate(request.reviewedAt ?? request.createdAt)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

export function AdministrativeRequestsDashboard({ initialTab = "submit", attendanceOnly = false }: { initialTab?: string; attendanceOnly?: boolean } = {}) {
  const [data, setData] = useState<AdministrativeDashboardData | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [requestForm, setRequestForm] = useState(() => ({
    ...initialRequestForm,
    requestType: initialTab === "internal" ? "internal_transaction" : initialRequestForm.requestType,
  }))
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [employmentSection, setEmploymentSection] = useState<EmploymentSectionKey>("interrogations")
  const [balanceForm, setBalanceForm] = useState({
    leaveQuotaDays: "0",
    lateQuotaMinutes: "0",
    permissionQuotaMinutes: "0",
    workStartTime: "08:00",
  })

  async function loadData() {
    setLoading(true)
    setError(null)

    const response = await fetch("/api/admin/administrative-requests", { cache: "no-store" })
    const payload = (await response.json()) as AdministrativeDashboardData & { error?: string }

    if (!response.ok) {
      setError(payload.error ?? "تعذر تحميل بيانات الطلبات الإدارية")
      setLoading(false)
      return
    }

    setData(payload)
    setRequestForm((current) => ({
      ...current,
      targetUserId: current.targetUserId || payload.internalRecipients[0]?.userId || "",
    }))
    setSelectedAccountId((current) => current || (initialTab === "balances" ? allEmployeesValue : payload.currentUserId))
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (initialTab !== "reviews") {
      return
    }

    void (async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_review_requests_seen" }),
      })

      if (response.ok) {
        window.dispatchEvent(new Event("dashboard-badges-changed"))
      }
    })()
  }, [initialTab])

  const selectedAccount = useMemo(
    () => selectedAccountId === allEmployeesValue ? null : data?.accounts.find((account) => account.userId === selectedAccountId) ?? null,
    [data?.accounts, selectedAccountId],
  )

  useEffect(() => {
    const sourceAccount = selectedAccountId === allEmployeesValue
      ? data?.accounts[0] ?? null
      : selectedAccount

    if (!sourceAccount) {
      return
    }

    setBalanceForm({
      leaveQuotaDays: String(sourceAccount.leaveBalance.leaveQuotaDays),
      lateQuotaMinutes: String(sourceAccount.leaveBalance.lateQuotaMinutes),
      permissionQuotaMinutes: String(sourceAccount.leaveBalance.permissionQuotaMinutes),
      workStartTime: sourceAccount.leaveBalance.workStartTime,
    })
  }, [data?.accounts, selectedAccount, selectedAccountId])

  const pendingReviewRequests = useMemo(
    () => data?.reviewableRequests.filter((request) => request.status === "pending") ?? [],
    [data?.reviewableRequests],
  )

  const isEmploymentManagerView = initialTab === "employment_records"

  const managerSelectedAccount = useMemo(() => {
    if (!data) {
      return null
    }

    return data.accounts.find((account) => account.userId === selectedAccountId) ?? data.accounts[0] ?? null
  }, [data, selectedAccountId])

  const managerEmploymentRequests = useMemo(() => {
    if (!data || !managerSelectedAccount) {
      return []
    }

    return data.reviewableRequests.filter((request) => request.requesterId === managerSelectedAccount.userId)
  }, [data, managerSelectedAccount])

  const managerEmploymentAttendance = useMemo(() => {
    if (!data || !managerSelectedAccount) {
      return []
    }

    return data.allAttendanceHistory.filter((record) => record.userId === managerSelectedAccount.userId)
  }, [data, managerSelectedAccount])

  const employmentViewLeaveBalance = data?.leaveBalance ?? {
    userId: "",
    leaveQuotaDays: 0,
    leaveTakenDays: 0,
    lateQuotaMinutes: 0,
    lateUsedMinutes: 0,
    permissionQuotaMinutes: 0,
    permissionUsedMinutes: 0,
  }
  const employmentViewLeaveRemaining = employmentViewLeaveBalance.leaveQuotaDays - employmentViewLeaveBalance.leaveTakenDays
  const employmentViewPermissionRemaining = employmentViewLeaveBalance.permissionQuotaMinutes - employmentViewLeaveBalance.permissionUsedMinutes
  const employmentViewLateRemaining = employmentViewLeaveBalance.lateQuotaMinutes - employmentViewLeaveBalance.lateUsedMinutes
  const employmentViewWarningCount = (data?.attendanceHistory ?? []).filter((record) => record.status === "incomplete" || Boolean(record.notes)).length
  const employmentViewInterrogationCount = (data?.myRequests ?? []).filter((request) => request.status === "rejected" || request.status === "cancelled").length

  async function submitRequest() {
    setMessage(null)
    setError(null)

    const response = await fetch("/api/admin/administrative-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_request",
        requestType: requestForm.requestType,
        targetUserId: requestForm.requestType === "internal_transaction" ? requestForm.targetUserId : undefined,
        subject: requestForm.subject,
        details: requestForm.details,
        amountRequested: requestForm.amountRequested ? Number(requestForm.amountRequested) : null,
        startDate: requestForm.startDate,
        endDate: requestForm.endDate,
        requestDate: requestForm.requestDate,
        fromTime: requestForm.fromTime,
        toTime: requestForm.toTime,
      }),
    })

    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(payload.error ?? "تعذر إرسال الطلب")
      return
    }

    setRequestForm(initialRequestForm)
    setMessage("تم إرسال الطلب بنجاح")
    await loadData()
  }

  function handleCreateRequest() {
    startTransition(async () => {
      await submitRequest()
    })
  }

  function handleRequestAction(body: Record<string, unknown>, successMessage: string) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? "تعذر تنفيذ العملية")
        return
      }

      setMessage(successMessage)
      await loadData()
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
      <Alert variant="destructive" className="rounded-[1.5rem] border-white/80 bg-white/95 text-right shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>تعذر تحميل القسم</AlertTitle>
        <AlertDescription>{error ?? "حدث خطأ غير متوقع أثناء تجهيز خدمات الطلبات الإدارية."}</AlertDescription>
      </Alert>
    )
  }

  const age = calculateAge(data.profile.birthDate)
  const leaveRemaining = data.leaveBalance.leaveQuotaDays - data.leaveBalance.leaveTakenDays
  const permissionRemaining = data.leaveBalance.permissionQuotaMinutes - data.leaveBalance.permissionUsedMinutes
  const lateRemaining = data.leaveBalance.lateQuotaMinutes - data.leaveBalance.lateUsedMinutes
  const requestedLeaveDays = requestForm.startDate && requestForm.endDate ? calculateLeaveDays(requestForm.startDate, requestForm.endDate) : 0
  const isInternalTransactionRequest = requestForm.requestType === "internal_transaction"
  const activeTab = initialTab

  if (attendanceOnly) {
    return (
      <section className="space-y-6 text-right">
        {error ? (
          <Alert variant="destructive" className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>يوجد تنبيه</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <AttendancePanel data={data} onRefresh={loadData} compact />
      </section>
    )
  }

  const pageTitleByTab: Record<string, string> = {
    submit: "الطلبات الإدارية",
    my_requests: "طلباتي",
    profile: "الملف الوظيفي",
    employment: "السجل الوظيفي",
    balances: "الإجازات والأذونات",
    reviews: "طلبات الموظفين",
    employment_records: "سجلات الموظفين",
  }

  const pageDescriptionByTab: Record<string, string> = {
    submit: "تقديم الطلبات الإدارية ومتابعة حالتها واعتمادها من مدير النظام عند الحاجة.",
    my_requests: "متابعة الطلبات التي رفعتها وحالة كل طلب بحسب قرار المدير من صفحة مستقلة.",
    profile: "استعراض بيانات الحساب الوظيفية الأساسية من صفحة مستقلة.",
    employment: "عرض سجل إنشاء الحساب ونوعه والجهة التي قامت بإنشائه.",
    balances: "إدارة الأرصدة الأساسية للإجازات والأذونات وأيام السماحية من صفحة مستقلة.",
    reviews: "اعتماد أو رفض الطلبات التي رفعها الموظفون من صفحة تقديم طلب.",
    employment_records: "استعراض سجل كل موظف عبر اختيار اسمه والانتقال بين أنواع السجلات المختلفة.",
  }

  if (initialTab === "employment") {
    return (
      <section className="space-y-6 text-right">
        {message ? (
          <Alert className="rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>تم تنفيذ العملية</AlertTitle>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>يوجد تنبيه</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardHeader>
            <CardTitle>السجل الوظيفي</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EmploymentSectionButtons value={employmentSection} onChange={setEmploymentSection} />
            <EmploymentRecordsTable
              section={employmentSection}
              requests={data.myRequests}
              attendanceRecords={data.attendanceHistory}
              leaveBalance={employmentViewLeaveBalance}
            />
          </CardContent>
        </Card>
      </section>
    )
  }

  if (initialTab === "my_requests") {
    return (
      <section className="space-y-6 text-right">
        {message ? (
          <Alert className="rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>تم تنفيذ العملية</AlertTitle>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>يوجد تنبيه</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardHeader className="items-end text-right">
            <CardTitle className="w-full text-right">سجل الطلبات</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.myRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد طلبات حتى الآن.</TableCell>
                  </TableRow>
                ) : (
                  data.myRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="text-right">{getAdministrativeRequestTypeLabel(request.requestType)}</TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{request.subject}</p>
                          {request.requestType === "internal_transaction" && request.targetUserName ? <p className="text-xs text-muted-foreground">إلى: {request.targetUserName}</p> : null}
                          {request.requestType === "permission" ? <p className="text-xs text-muted-foreground">{formatMinutesLabel(getTimeRangeMinutes(request.fromTime, request.toTime))}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right"><Badge variant={getStatusVariant(request.status)}>{getRequestStatusText(request)}</Badge></TableCell>
                      <TableCell className="text-right">{formatDate(request.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {request.canCancel ? (
                          <Button type="button" variant="outline" size="sm" className="rounded-lg" disabled={isPending} onClick={() => handleRequestAction({ action: "cancel_request", requestId: request.id }, "تم إلغاء الطلب")}>إلغاء</Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    )
  }

  if (initialTab === "employment_records") {
    return (
      <section className="space-y-6 text-right">
        {message ? (
          <Alert className="rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>تم تنفيذ العملية</AlertTitle>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>يوجد تنبيه</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!data.isManager ? (
          <Alert variant="destructive" className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>ليس لديك صلاحية</AlertTitle>
            <AlertDescription>هذه الصفحة مخصصة لمدير النظام فقط.</AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="space-y-4">
              <div className="max-w-md space-y-2 text-right">
                <Label className={rtlLabelClassName}>اختر الموظف</Label>
                <Select value={managerSelectedAccount?.userId ?? ""} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className={rtlSelectTriggerClassName}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {data.accounts.map((account) => (
                      <SelectItem key={account.userId} value={account.userId}>{account.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <EmploymentSectionButtons value={employmentSection} onChange={setEmploymentSection} />
            </div>

            <div className="mt-6">
              {managerSelectedAccount ? (
                <EmploymentRecordsTable
                  section={employmentSection}
                  requests={managerEmploymentRequests}
                  attendanceRecords={managerEmploymentAttendance}
                  leaveBalance={managerSelectedAccount.leaveBalance}
                />
              ) : (
                <EmptyEmploymentTable message="لا توجد حسابات متاحة لعرض السجلات." />
              )}
            </div>
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="space-y-6 text-right">
      {initialTab !== "balances" && initialTab !== "submit" && initialTab !== "reviews" ? (
        <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <h1 className="text-2xl font-bold text-foreground">{pageTitleByTab[initialTab] ?? "الطلبات الإدارية"}</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {pageDescriptionByTab[initialTab] ?? "تقديم الطلبات الإدارية ومتابعة حالتها من قسم مستقل داخل لوحة التحكم."}
          </p>
        </div>
      ) : null}

      {message ? (
        <Alert className="rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>تم تنفيذ العملية</AlertTitle>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>يوجد تنبيه</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={activeTab} className="gap-4">

        <TabsContent value="submit" className="space-y-4">
          <div className="grid gap-4">
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>تقديم طلب</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 text-right md:col-span-2">
                  <Label className={rtlLabelClassName}>نوع الطلب</Label>
                  <Select value={requestForm.requestType} onValueChange={(value) => setRequestForm((current) => ({ ...current, requestType: value as typeof current.requestType }))}>
                    <SelectTrigger className={rtlSelectTriggerClassName}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leave">طلب إجازة</SelectItem>
                      <SelectItem value="permission">طلب إذن</SelectItem>
                      <SelectItem value="financial">طلب مالي</SelectItem>
                      <SelectItem value="general">طلب عام</SelectItem>
                      <SelectItem value="internal_transaction">معاملة داخلية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {requestForm.requestType === "internal_transaction" ? (
                  <div className="space-y-2 text-right md:col-span-2">
                    <Label className={rtlLabelClassName}>الموظف المستلم</Label>
                    <Select value={requestForm.targetUserId} onValueChange={(value) => setRequestForm((current) => ({ ...current, targetUserId: value }))}>
                      <SelectTrigger className={rtlSelectTriggerClassName}><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                      <SelectContent>
                        {data.internalRecipients.map((employee) => (
                          <SelectItem key={employee.userId} value={employee.userId}>{employee.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-2 text-right md:col-span-2">
                  <Label htmlFor="request-subject" className={rtlLabelClassName}>عنوان الطلب</Label>
                  <Input id="request-subject" value={requestForm.subject} onChange={(event) => setRequestForm((current) => ({ ...current, subject: event.target.value }))} className={rtlInputClassName} />
                </div>

                <div className="space-y-2 text-right md:col-span-2">
                  <Label htmlFor="request-details" className={rtlLabelClassName}>تفاصيل الطلب</Label>
                  <Textarea id="request-details" value={requestForm.details} onChange={(event) => setRequestForm((current) => ({ ...current, details: event.target.value }))} className={`min-h-28 ${rtlInputClassName}`} />
                </div>

                {requestForm.requestType === "leave" ? (
                  <>
                    <div className="space-y-2 text-right">
                      <Label htmlFor="request-start-date" className={rtlLabelClassName}>من تاريخ</Label>
                      <DatePickerField id="request-start-date" value={requestForm.startDate} onChange={(value) => setRequestForm((current) => ({ ...current, startDate: value }))} placeholder="اختر تاريخ البداية" className={rtlDatePickerClassName} />
                    </div>
                    <div className="space-y-2 text-right">
                      <Label htmlFor="request-end-date" className={rtlLabelClassName}>إلى تاريخ</Label>
                      <DatePickerField id="request-end-date" value={requestForm.endDate} onChange={(value) => setRequestForm((current) => ({ ...current, endDate: value }))} placeholder="اختر تاريخ النهاية" className={rtlDatePickerClassName} />
                    </div>
                  </>
                ) : null}

                {requestForm.requestType === "permission" ? (
                  <>
                    <div className="space-y-2 text-right">
                      <Label htmlFor="request-from-time" className={rtlLabelClassName}>من الساعة</Label>
                      <Input id="request-from-time" type="time" value={requestForm.fromTime} onChange={(event) => setRequestForm((current) => ({ ...current, fromTime: event.target.value }))} className={rtlInputClassName} />
                    </div>
                    <div className="space-y-2 text-right">
                      <Label htmlFor="request-date" className={rtlLabelClassName}>تاريخ الإذن</Label>
                      <DatePickerField id="request-date" value={requestForm.requestDate} onChange={(value) => setRequestForm((current) => ({ ...current, requestDate: value }))} placeholder="اختر تاريخ الإذن" className={rtlDatePickerClassName} />
                    </div>
                    <div className="space-y-2 text-right">
                      <Label htmlFor="request-to-time" className={rtlLabelClassName}>إلى الساعة</Label>
                      <Input id="request-to-time" type="time" value={requestForm.toTime} onChange={(event) => setRequestForm((current) => ({ ...current, toTime: event.target.value }))} className={rtlInputClassName} />
                    </div>
                  </>
                ) : null}

                {requestForm.requestType === "financial" ? (
                  <div className="space-y-2 text-right md:col-span-2">
                    <Label htmlFor="request-amount" className={rtlLabelClassName}>المبلغ المطلوب</Label>
                    <Input id="request-amount" type="number" min="0" value={requestForm.amountRequested} onChange={(event) => setRequestForm((current) => ({ ...current, amountRequested: event.target.value }))} className={rtlInputClassName} />
                  </div>
                ) : null}
              </CardContent>
              <div className="px-6 pb-6">
                <Button type="button" className="rounded-xl" onClick={handleCreateRequest} disabled={isPending}>
                  {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  إرسال الطلب
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          {!data.isManager ? (
            <Alert variant="destructive" className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>ليس لديك صلاحية</AlertTitle>
              <AlertDescription>هذه الصفحة مخصصة لمدير النظام لاعتماد أو رفض طلبات الموظفين.</AlertDescription>
            </Alert>
          ) : (
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الإجراء</TableHead>
                        <TableHead className="text-right">التفاصيل</TableHead>
                        <TableHead className="text-right">العنوان</TableHead>
                        <TableHead className="text-right">النوع</TableHead>
                        <TableHead className="text-right">الموظف</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingReviewRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد طلبات معلقة حاليًا.</TableCell>
                      </TableRow>
                    ) : (
                      pendingReviewRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" className="rounded-lg" disabled={isPending} onClick={() => handleRequestAction({ action: "review_request", requestId: request.id, decision: "approved" }, "تم اعتماد الطلب")}>اعتماد</Button>
                              <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={isPending} onClick={() => handleRequestAction({ action: "review_request", requestId: request.id, decision: "rejected" }, "تم رفض الطلب")}>رفض</Button>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[280px] whitespace-normal text-right text-sm text-muted-foreground">
                            {request.details}
                            {request.requestType === "leave" && request.startDate && request.endDate ? (
                              <p className="mt-2 text-xs">من {formatDate(request.startDate)} إلى {formatDate(request.endDate)}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">{request.subject}</TableCell>
                          <TableCell className="text-right">{getAdministrativeRequestTypeLabel(request.requestType)}</TableCell>
                          <TableCell className="text-right">{request.requesterName}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="internal">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>المعاملات الداخلية</CardTitle>
              <CardDescription>هذا القسم جهزته كمساحة مستقلة حتى نربطه لاحقًا بسير العمل الذي ستشرحه.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <InfoField label="المقترح الأول" value="تعريف أنواع المعاملات الداخلية" />
              <InfoField label="المقترح الثاني" value="تحديد دورة الاعتماد والتحويل بين الجهات" />
              <InfoField label="المقترح الثالث" value="إضافة مرفقات، أرقام معاملات، وإشعارات متابعة" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>الملف الوظيفي</CardTitle>
              <CardDescription>البيانات الأساسية للحساب الإداري وتفاصيله الوظيفية.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <InfoField label="الاسم" value={data.currentUserName} />
              <InfoField label="المسمى الوظيفي" value={data.currentUserTitle} />
              <InfoField label="رقم الهوية" value={data.profile.nationalId} />
              <InfoField label="تاريخ الميلاد" value={formatDate(data.profile.birthDate)} />
              <InfoField label="العمر" value={String(age ?? "-")} />
              <InfoField label="النوع" value={getGenderLabel(data.profile.gender)} />
              <InfoField label="الحالة الاجتماعية" value={getMaritalStatusLabel(data.profile.maritalStatus)} />
              <InfoField label="الرتبة الوظيفية" value={data.profile.jobRank} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>السجل الوظيفي</CardTitle>
              <CardDescription>يوضح سجل إنشاء الحساب ونوعه والجهة التي قامت بإنشائه.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <InfoField label="تاريخ الإنشاء" value={formatDate(data.employmentRecord.createdAt)} />
                <InfoField label="نوع الحساب" value={data.employmentRecord.accountType} />
                <InfoField label="من أنشأ الحساب" value={data.employmentRecord.createdByName ?? "النظام"} />
                <InfoField label="المسمى الوظيفي" value={data.employmentRecord.jobTitle} />
                <InfoField label="الرتبة الوظيفية" value={data.employmentRecord.jobRank} />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <RecordSummaryCard
                  title="سجل الإجازات"
                  summary={`المتبقي ${employmentViewLeaveRemaining} يوم`}
                  hint="ملخص مختصر للمتبقي من رصيد الإجازات."
                />
                <RecordSummaryCard
                  title="سجل الإذونات"
                  summary={`المتبقي ${formatMinutesLabel(employmentViewPermissionRemaining)}`}
                  hint="ملخص مختصر للمتبقي من دقائق الاستئذان."
                />
                <RecordSummaryCard
                  title="سجل التأخير"
                  summary={`المتبقي ${formatMinutesLabel(employmentViewLateRemaining)}`}
                  hint="ملخص مختصر للمتبقي من دقائق التأخير المسموح بها."
                />
                <RecordSummaryCard
                  title="سجل الإنذارات"
                  summary={employmentViewWarningCount > 0 ? `إجمالي السجلات ${employmentViewWarningCount}` : "لا توجد إنذارات مسجلة حاليًا"}
                  hint="ملخص سريع للإنذارات والملاحظات الإدارية."
                />
                <RecordSummaryCard
                  title="سجل الطلبات"
                  summary={`إجمالي الطلبات المسجلة: ${data.myRequests.length}`}
                  hint="يشمل الطلبات الإدارية المرفوعة من هذا الحساب."
                />
                <RecordSummaryCard
                  title="سجل المسائلات"
                  summary={employmentViewInterrogationCount > 0 ? `إجمالي السجلات ${employmentViewInterrogationCount}` : "لا توجد مسائلات مسجلة حاليًا"}
                  hint="ملخص سريع للمسائلات والطلبات المرفوضة أو الملغاة."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="space-y-4">
          {data.isManager ? (
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>إدارة الأرصدة الأساسية</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="space-y-2 text-right xl:col-span-4">
                  <Label className={rtlLabelClassName}>الحساب المستهدف</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className={rtlSelectTriggerClassName}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={allEmployeesValue}>جميع الموظفين</SelectItem>
                      {data.accounts.map((account) => (
                        <SelectItem key={account.userId} value={account.userId}>{account.name} - {account.jobTitle}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 text-right">
                  <Label htmlFor="leave-quota" className={rtlLabelClassName}>رصيد الإجازات الأساسي</Label>
                  <Input id="leave-quota" type="number" min="0" value={balanceForm.leaveQuotaDays} onChange={(event) => setBalanceForm((current) => ({ ...current, leaveQuotaDays: event.target.value }))} className={rtlInputClassName} />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="permission-quota" className={rtlLabelClassName}>دقائق الاستئذان المسموحة</Label>
                  <Input id="permission-quota" type="number" min="0" value={balanceForm.permissionQuotaMinutes} onChange={(event) => setBalanceForm((current) => ({ ...current, permissionQuotaMinutes: event.target.value }))} className={rtlInputClassName} />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="late-quota" className={rtlLabelClassName}>دقائق التأخير المسموحة</Label>
                  <Input id="late-quota" type="number" min="0" value={balanceForm.lateQuotaMinutes} onChange={(event) => setBalanceForm((current) => ({ ...current, lateQuotaMinutes: event.target.value }))} className={rtlInputClassName} />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="work-start-time" className={rtlLabelClassName}>بداية الدوام من الساعة</Label>
                  <Input id="work-start-time" type="time" value={balanceForm.workStartTime} onChange={(event) => setBalanceForm((current) => ({ ...current, workStartTime: event.target.value }))} className={rtlInputClassName} />
                </div>
                <div className="flex items-end justify-start">
                  <Button
                    type="button"
                    className="rounded-xl"
                    disabled={isPending || (!selectedAccount && selectedAccountId !== allEmployeesValue)}
                    onClick={() =>
                      handleRequestAction(
                        {
                          action: "update_balance",
                          userId: selectedAccountId === allEmployeesValue ? allEmployeesValue : selectedAccount?.userId,
                          leaveQuotaDays: Number(balanceForm.leaveQuotaDays) || 0,
                          lateQuotaMinutes: Number(balanceForm.lateQuotaMinutes) || 0,
                          permissionQuotaMinutes: Number(balanceForm.permissionQuotaMinutes) || 0,
                          workStartTime: balanceForm.workStartTime,
                        },
                        selectedAccountId === allEmployeesValue ? "تم تحديث الأرصدة الأساسية لجميع الموظفين" : "تم تحديث الأرصدة الأساسية",
                      )
                    }
                  >
                    حفظ
                  </Button>
                </div>

                {selectedAccount ? (
                  <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-4 text-right xl:col-span-4">
                    <p className="text-sm font-semibold text-foreground">ملخص الحساب المحدد: {selectedAccount.name}</p>
                    <p className="mt-2 text-sm text-muted-foreground">المتبقي من الإجازات: {selectedAccount.leaveBalance.leaveQuotaDays - selectedAccount.leaveBalance.leaveTakenDays} يوم</p>
                    <p className="mt-1 text-sm text-muted-foreground">المتبقي من دقائق الاستئذان: {formatMinutesLabel(selectedAccount.leaveBalance.permissionQuotaMinutes - selectedAccount.leaveBalance.permissionUsedMinutes)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">المتبقي من دقائق التأخير: {formatMinutesLabel(selectedAccount.leaveBalance.lateQuotaMinutes - selectedAccount.leaveBalance.lateUsedMinutes)}</p>
                    <p className="mt-1 text-sm text-muted-foreground">بداية الدوام: {selectedAccount.leaveBalance.workStartTime}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  )
}
