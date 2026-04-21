"use client"

import { AlertCircle, CheckCircle2, LoaderCircle, Wallet } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import {
  administrativeRequestTypeValues,
  calculateAge,
  calculateLeaveDays,
  formatDate,
  getAdministrativeRequestStatusLabel,
  getAdministrativeRequestTypeLabel,
  getGenderLabel,
  getLeaveAllocationTypeLabel,
  getMaritalStatusLabel,
  type AdministrativeDashboardData,
  type AdministrativeRequestRecord,
  type LeaveAllocationType,
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
  subject: "",
  details: "",
  amountRequested: "",
  startDate: "",
  endDate: "",
  requestDate: "",
  fromTime: "",
  toTime: "",
  leaveAllocationType: "leave_balance" as LeaveAllocationType,
}

const rtlInputClassName = "text-right [&::placeholder]:text-right"
const rtlLabelClassName = "block text-right"
const rtlSelectTriggerClassName = "w-full flex-row-reverse text-right [&>span]:text-right"
const rtlDatePickerClassName = "flex-row-reverse text-right [&>span]:text-right"

function getStatusVariant(status: AdministrativeRequestRecord["status"]) {
  if (status === "approved") return "default"
  if (status === "rejected") return "destructive"
  if (status === "cancelled") return "outline"
  return "secondary"
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

function RecordSummaryCard({ title, summary, hint }: { title: string; summary: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 text-right">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm font-medium leading-7 text-foreground">{summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

export function AdministrativeRequestsDashboard({ initialTab = "submit", attendanceOnly = false }: { initialTab?: string; attendanceOnly?: boolean } = {}) {
  const [data, setData] = useState<AdministrativeDashboardData | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [requestForm, setRequestForm] = useState(initialRequestForm)
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [balanceForm, setBalanceForm] = useState({
    leaveQuotaDays: "0",
    allowanceTotalDays: "0",
    permissionQuotaCount: "0",
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
    setSelectedAccountId((current) => current || payload.currentUserId)
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const selectedAccount = useMemo(
    () => data?.accounts.find((account) => account.userId === selectedAccountId) ?? null,
    [data?.accounts, selectedAccountId],
  )

  useEffect(() => {
    if (!selectedAccount) {
      return
    }

    setBalanceForm({
      leaveQuotaDays: String(selectedAccount.leaveBalance.leaveQuotaDays),
      allowanceTotalDays: String(selectedAccount.leaveBalance.allowanceTotalDays),
      permissionQuotaCount: String(selectedAccount.leaveBalance.permissionQuotaCount),
    })
  }, [selectedAccount])

  const pendingReviewRequests = useMemo(
    () => data?.reviewableRequests.filter((request) => request.status === "pending") ?? [],
    [data?.reviewableRequests],
  )

  async function submitRequest() {
    setMessage(null)
    setError(null)

    const response = await fetch("/api/admin/administrative-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_request",
        requestType: requestForm.requestType,
        subject: requestForm.subject,
        details: requestForm.details,
        amountRequested: requestForm.amountRequested ? Number(requestForm.amountRequested) : null,
        startDate: requestForm.startDate,
        endDate: requestForm.endDate,
        requestDate: requestForm.requestDate,
        fromTime: requestForm.fromTime,
        toTime: requestForm.toTime,
        leaveAllocationType: requestForm.requestType === "leave" ? requestForm.leaveAllocationType : undefined,
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
  const allowanceRemaining = data.leaveBalance.allowanceTotalDays - data.leaveBalance.allowanceUsedDays
  const permissionRemaining = data.leaveBalance.permissionQuotaCount - data.leaveBalance.permissionUsedCount
  const requestedLeaveDays = requestForm.startDate && requestForm.endDate ? calculateLeaveDays(requestForm.startDate, requestForm.endDate) : 0

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
    internal: "المعاملات الداخلية",
    profile: "الملف الوظيفي",
    employment: "السجل الوظيفي",
    leave: "سجلات الإجازات",
    reviews: "طلبات الموظفين",
  }

  const pageDescriptionByTab: Record<string, string> = {
    submit: "تقديم الطلبات الإدارية ومتابعة حالتها واعتمادها من مدير النظام عند الحاجة.",
    internal: "مساحة مستقلة للمعاملات الداخلية ضمن قسم الخدمات الإدارية.",
    profile: "استعراض بيانات الحساب الوظيفية الأساسية من صفحة مستقلة.",
    employment: "عرض سجل إنشاء الحساب ونوعه والجهة التي قامت بإنشائه.",
    leave: "عرض أرصدة الإجازات والأذونات وأيام السماحية وإدارتها حسب الصلاحية.",
    reviews: "اعتماد أو رفض الطلبات التي رفعها الموظفون من صفحة تقديم طلب.",
  }

  return (
    <section className="space-y-6 text-right">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h1 className="text-2xl font-bold text-foreground">{pageTitleByTab[initialTab] ?? "الطلبات الإدارية"}</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {pageDescriptionByTab[initialTab] ?? "تقديم الطلبات الإدارية ومتابعة حالتها من قسم مستقل داخل لوحة التحكم."}
        </p>
      </div>

      {message ? (
        <Alert className="rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>تم تنفيذ العملية</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>يوجد تنبيه</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={initialTab} className="gap-4">

        <TabsContent value="submit" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>تقديم طلب</CardTitle>
                <CardDescription>اختر نوع الطلب ثم أكمل البيانات الخاصة به قبل الإرسال.</CardDescription>
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
                    </SelectContent>
                  </Select>
                </div>

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
                      <Label className={rtlLabelClassName}>الخصم من</Label>
                      <Select value={requestForm.leaveAllocationType} onValueChange={(value) => setRequestForm((current) => ({ ...current, leaveAllocationType: value as LeaveAllocationType }))}>
                        <SelectTrigger className={rtlSelectTriggerClassName}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="leave_balance">رصيد الإجازات</SelectItem>
                          <SelectItem value="allowance">أيام السماحية</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 text-right">
                      <Label htmlFor="request-start-date" className={rtlLabelClassName}>من تاريخ</Label>
                      <DatePickerField id="request-start-date" value={requestForm.startDate} onChange={(value) => setRequestForm((current) => ({ ...current, startDate: value }))} placeholder="اختر تاريخ البداية" className={rtlDatePickerClassName} />
                    </div>
                    <div className="space-y-2 text-right">
                      <Label htmlFor="request-end-date" className={rtlLabelClassName}>إلى تاريخ</Label>
                      <DatePickerField id="request-end-date" value={requestForm.endDate} onChange={(value) => setRequestForm((current) => ({ ...current, endDate: value }))} placeholder="اختر تاريخ النهاية" className={rtlDatePickerClassName} />
                    </div>
                    <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 text-right">
                      <p className="text-xs text-muted-foreground">عدد الأيام المحتسبة</p>
                      <p className="mt-2 text-xl font-bold text-primary">{requestedLeaveDays}</p>
                    </div>
                  </>
                ) : null}

                {requestForm.requestType === "permission" ? (
                  <>
                    <div className="space-y-2 text-right">
                      <Label htmlFor="request-date" className={rtlLabelClassName}>تاريخ الإذن</Label>
                      <DatePickerField id="request-date" value={requestForm.requestDate} onChange={(value) => setRequestForm((current) => ({ ...current, requestDate: value }))} placeholder="اختر تاريخ الإذن" className={rtlDatePickerClassName} />
                    </div>
                    <div className="space-y-2 text-right">
                      <Label htmlFor="request-from-time" className={rtlLabelClassName}>من الساعة</Label>
                      <Input id="request-from-time" type="time" value={requestForm.fromTime} onChange={(event) => setRequestForm((current) => ({ ...current, fromTime: event.target.value }))} className={rtlInputClassName} />
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

            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>سجلات الطلبات</CardTitle>
                <CardDescription>تظهر هنا طلباتك السابقة مع حالة كل طلب وإمكانية إلغاء الطلبات التي لم يتم الرد عليها.</CardDescription>
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
                              {request.requestType === "leave" ? <p className="text-xs text-muted-foreground">{getLeaveAllocationTypeLabel(request.leaveAllocationType)}</p> : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right"><Badge variant={getStatusVariant(request.status)}>{getAdministrativeRequestStatusLabel(request.status)}</Badge></TableCell>
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
          </div>

          {data.isManager ? (
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>طلبات بانتظار اعتماد مدير النظام</CardTitle>
                <CardDescription>يمكنك اعتماد أو رفض الطلبات من هنا. عند اعتماد الإجازات والأذونات سيتم خصمها من الرصيد تلقائيًا.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">التفاصيل</TableHead>
                      <TableHead className="text-right">الإجراء</TableHead>
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
                          <TableCell className="text-right">{request.requesterName}</TableCell>
                          <TableCell className="text-right">{getAdministrativeRequestTypeLabel(request.requestType)}</TableCell>
                          <TableCell className="text-right">{request.subject}</TableCell>
                          <TableCell className="max-w-[280px] whitespace-normal text-right text-sm text-muted-foreground">
                            {request.details}
                            {request.requestType === "leave" && request.startDate && request.endDate ? (
                              <p className="mt-2 text-xs">من {formatDate(request.startDate)} إلى {formatDate(request.endDate)}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" className="rounded-lg" disabled={isPending} onClick={() => handleRequestAction({ action: "review_request", requestId: request.id, decision: "approved" }, "تم اعتماد الطلب")}>اعتماد</Button>
                              <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={isPending} onClick={() => handleRequestAction({ action: "review_request", requestId: request.id, decision: "rejected" }, "تم رفض الطلب")}>رفض</Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
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
              <CardHeader>
                <CardTitle>طلبات الموظفين</CardTitle>
                <CardDescription>يمكنك اعتماد أو رفض الطلبات من هنا. عند اعتماد الإجازات والأذونات سيتم خصمها من الرصيد تلقائيًا.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الموظف</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">التفاصيل</TableHead>
                      <TableHead className="text-right">الإجراء</TableHead>
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
                          <TableCell className="text-right">{request.requesterName}</TableCell>
                          <TableCell className="text-right">{getAdministrativeRequestTypeLabel(request.requestType)}</TableCell>
                          <TableCell className="text-right">{request.subject}</TableCell>
                          <TableCell className="max-w-[280px] whitespace-normal text-right text-sm text-muted-foreground">
                            {request.details}
                            {request.requestType === "leave" && request.startDate && request.endDate ? (
                              <p className="mt-2 text-xs">من {formatDate(request.startDate)} إلى {formatDate(request.endDate)}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" className="rounded-lg" disabled={isPending} onClick={() => handleRequestAction({ action: "review_request", requestId: request.id, decision: "approved" }, "تم اعتماد الطلب")}>اعتماد</Button>
                              <Button type="button" size="sm" variant="outline" className="rounded-lg" disabled={isPending} onClick={() => handleRequestAction({ action: "review_request", requestId: request.id, decision: "rejected" }, "تم رفض الطلب")}>رفض</Button>
                            </div>
                          </TableCell>
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
                  summary={`المستخدم ${data.leaveBalance.leaveTakenDays} يوم، والمتبقي ${leaveRemaining} يوم`}
                  hint="ملخص رصيد الإجازات المستخدم والمتبقي."
                />
                <RecordSummaryCard
                  title="سجل الإذونات"
                  summary={`المستخدم ${data.leaveBalance.permissionUsedCount} إذن، والمتبقي ${permissionRemaining} إذن`}
                  hint="ملخص الأذونات المعتمدة والمتاحة."
                />
                <RecordSummaryCard
                  title="سجل الإنذارات"
                  summary="لا توجد إنذارات مسجلة حاليًا"
                  hint="سيظهر هنا أي إنذار وظيفي عند ربطه بالنظام."
                />
                <RecordSummaryCard
                  title="سجل الطلبات"
                  summary={`إجمالي الطلبات المسجلة: ${data.myRequests.length}`}
                  hint="يشمل الطلبات الإدارية المرفوعة من هذا الحساب."
                />
                <RecordSummaryCard
                  title="سجل المسائلات"
                  summary="لا توجد مسائلات مسجلة حاليًا"
                  hint="سيظهر هنا سجل المسائلات عند تفعيل هذا الجزء."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leave" className="space-y-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>سجلات الإجازات</CardTitle>
              <CardDescription>ملخص الرصيد الأساسي والمستخدم والمتبقي للإجازات والأذونات وأيام السماحية.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <BalanceMetric label="رصيد الإجازات" value={data.leaveBalance.leaveQuotaDays} hint="الأصل الممنوح من مدير النظام" />
              <BalanceMetric label="الإجازات من الرصيد" value={data.leaveBalance.leaveTakenDays} hint="المستخدم فعليًا من رصيد الإجازات" />
              <BalanceMetric label="المتبقي من رصيد الإجازات" value={leaveRemaining} hint="المتاح لطلبات الإجازة القادمة" />
              <BalanceMetric label="إجمالي أيام السماحية" value={data.leaveBalance.allowanceTotalDays} hint="الرصيد الإجمالي لأيام السماحية" />
              <BalanceMetric label="الأيام المستخدمة من السماحية" value={data.leaveBalance.allowanceUsedDays} hint="المستخدم فعليًا من أيام السماحية" />
              <BalanceMetric label="المتبقي من أيام السماحية" value={allowanceRemaining} hint="المتاح من أيام السماحية" />
              <BalanceMetric label="رصيد الأذونات" value={data.leaveBalance.permissionQuotaCount} hint="عدد الأذونات المسموح بها" />
              <BalanceMetric label="الأذونات المستخدمة" value={data.leaveBalance.permissionUsedCount} hint="الطلبات المعتمدة والمخصومة" />
              <BalanceMetric label="المتبقي من الأذونات" value={permissionRemaining} hint="المتاح لطلبات الإذن القادمة" />
            </CardContent>
          </Card>

          {data.isManager ? (
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>إدارة الأرصدة الأساسية</CardTitle>
                <CardDescription>هذه الأدوات تظهر لمدير النظام فقط لتحديد أصل رصيد الإجازات والسماحية والأذونات لكل حساب.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2 text-right xl:col-span-4">
                  <Label className={rtlLabelClassName}>الحساب المستهدف</Label>
                  <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className={rtlSelectTriggerClassName}><SelectValue /></SelectTrigger>
                    <SelectContent>
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
                  <Label htmlFor="allowance-total" className={rtlLabelClassName}>إجمالي أيام السماحية</Label>
                  <Input id="allowance-total" type="number" min="0" value={balanceForm.allowanceTotalDays} onChange={(event) => setBalanceForm((current) => ({ ...current, allowanceTotalDays: event.target.value }))} className={rtlInputClassName} />
                </div>
                <div className="space-y-2 text-right">
                  <Label htmlFor="permission-quota" className={rtlLabelClassName}>رصيد الأذونات</Label>
                  <Input id="permission-quota" type="number" min="0" value={balanceForm.permissionQuotaCount} onChange={(event) => setBalanceForm((current) => ({ ...current, permissionQuotaCount: event.target.value }))} className={rtlInputClassName} />
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    className="rounded-xl"
                    disabled={isPending || !selectedAccount}
                    onClick={() =>
                      handleRequestAction(
                        {
                          action: "update_balance",
                          userId: selectedAccount?.userId,
                          leaveQuotaDays: Number(balanceForm.leaveQuotaDays) || 0,
                          allowanceTotalDays: Number(balanceForm.allowanceTotalDays) || 0,
                          permissionQuotaCount: Number(balanceForm.permissionQuotaCount) || 0,
                        },
                        "تم تحديث الأرصدة الأساسية",
                      )
                    }
                  >
                    <Wallet className="h-4 w-4" />
                    حفظ الرصيد
                  </Button>
                </div>

                {selectedAccount ? (
                  <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-4 text-right xl:col-span-4">
                    <p className="text-sm font-semibold text-foreground">ملخص الحساب المحدد: {selectedAccount.name}</p>
                    <p className="mt-2 text-sm text-muted-foreground">المتبقي من الإجازات: {selectedAccount.leaveBalance.leaveQuotaDays - selectedAccount.leaveBalance.leaveTakenDays} يوم</p>
                    <p className="mt-1 text-sm text-muted-foreground">المتبقي من أيام السماحية: {selectedAccount.leaveBalance.allowanceTotalDays - selectedAccount.leaveBalance.allowanceUsedDays} يوم</p>
                    <p className="mt-1 text-sm text-muted-foreground">المتبقي من الأذونات: {selectedAccount.leaveBalance.permissionQuotaCount - selectedAccount.leaveBalance.permissionUsedCount}</p>
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
