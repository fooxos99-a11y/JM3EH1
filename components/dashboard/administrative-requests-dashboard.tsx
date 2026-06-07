"use client"

import dynamic from "next/dynamic"
import { AlertCircle, CheckCircle2, LoaderCircle, Plus, Trash2 } from "lucide-react"
import { memo, useEffect, useMemo, useState, useTransition } from "react"

import {
  administrativeRequestTypeValues,
  calculateAge,
  calculateLeaveDays,
  formatDate,
  getDateKeysBetween,
  getAdministrativeRequestStatusLabel,
  getAdministrativeRequestTypeLabel,
  getGenderLabel,
  getMaritalStatusLabel,
  type AdministrativeDashboardData,
  type AdministrativeRequestRecord,
  type EmployeeLeaveTypeBalance,
} from "@/lib/administrative-services"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

const AttendancePanel = dynamic(() => import("@/components/dashboard/attendance-panel").then((module) => module.AttendancePanel))

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
  leaveTypeBalanceId: "",
}

const rtlInputClassName = "text-right [&::placeholder]:text-right"
const rtlLabelClassName = "block text-right"
const rtlSelectTriggerClassName = "w-full text-right [&>span]:text-right"
const rtlDatePickerClassName = "flex-row-reverse text-right [&>span]:text-right"
const allEmployeesValue = "all_accounts"
const emptyLeaveTypes: EmployeeLeaveTypeBalance[] = []
const weekdayOptions = [
  { value: 0, label: "الأحد" },
  { value: 1, label: "الاثنين" },
  { value: 2, label: "الثلاثاء" },
  { value: 3, label: "الأربعاء" },
  { value: 4, label: "الخميس" },
  { value: 5, label: "الجمعة" },
  { value: 6, label: "السبت" },
]
const attendancePeriodDayOptions = [
  { value: "all_days", label: "جميع الأيام" },
  ...weekdayOptions.map((weekday) => ({ value: String(weekday.value), label: weekday.label })),
]
const defaultTemplateWeekdays = weekdayOptions.map((weekday) => weekday.value)

function getAttendancePeriodWeekdayValue(weekdays: number[]) {
  const uniqueWeekdays = Array.from(new Set(weekdays)).sort((left, right) => left - right)

  if (uniqueWeekdays.length === weekdayOptions.length) {
    return "all_days"
  }

  return String(uniqueWeekdays[0] ?? 0)
}

function createAttendancePeriodFormEntry(startTime = "08:00", endTime = "16:00") {
  return {
    weekday: "all_days",
    startTime,
    endTime,
  }
}

function expandWeeklyPeriods(entries: Array<{ weekday: string; startTime: string; endTime: string }>) {
  return entries.flatMap((entry) => {
    const weekdays = entry.weekday === "all_days"
      ? weekdayOptions.map((weekday) => weekday.value)
      : [Number(entry.weekday)]

    return weekdays.map((weekday) => ({
      weekday,
      startTime: entry.startTime,
      endTime: entry.endTime,
    }))
  })
}

function normalizeTemplateWeekdays(weekdays: number[]) {
  const normalized = Array.from(new Set(weekdays))
    .filter((weekday) => weekdayOptions.some((option) => option.value === weekday))
    .sort((left, right) => left - right)

  return normalized.length > 0 ? normalized : [...defaultTemplateWeekdays]
}

function createSchedulePeriodFormEntry(startTime = "08:00", endTime = "16:00") {
  return {
    weekdays: [...defaultTemplateWeekdays],
    startTime,
    endTime,
  }
}

function expandSchedulePeriods(entries: Array<{ weekdays: number[]; startTime: string; endTime: string }>) {
  return entries.flatMap((entry) =>
    normalizeTemplateWeekdays(entry.weekdays).map((weekday) => ({
      weekday,
      startTime: entry.startTime,
      endTime: entry.endTime,
    })),
  )
}

function createInitialScheduleForm() {
  return {
    templateId: null as string | null,
    name: "",
    description: "",
    lateQuotaMinutes: "0",
    permissionQuotaMinutes: "0",
    workStartTime: "08:00",
    workEndTime: "16:00",
    periods: [] as Array<{ weekdays: number[]; startTime: string; endTime: string }>,
  }
}

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

const InfoField = memo(function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value || "-"}</p>
    </div>
  )
})

const BalanceMetric = memo(function BalanceMetric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-white p-4 text-right shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
})

const CompactBalanceMetric = memo(function CompactBalanceMetric({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-4 text-right">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
      <p className="mt-2 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
})

const WeekdayCheckboxGroup = memo(function WeekdayCheckboxGroup({
  value,
  onChange,
}: {
  value: number[]
  onChange: (value: number[]) => void
}) {
  const selectedWeekdays = normalizeTemplateWeekdays(value)

  function toggleWeekday(weekday: number, checked: boolean) {
    if (checked) {
      onChange(normalizeTemplateWeekdays([...selectedWeekdays, weekday]))
      return
    }

    const nextValue = selectedWeekdays.filter((entry) => entry !== weekday)
    onChange(nextValue.length > 0 ? nextValue : selectedWeekdays)
  }

  return (
    <div className="flex flex-wrap justify-end gap-2 rounded-2xl border border-border/60 bg-muted/10 px-3 py-2">
      {weekdayOptions.map((weekday) => {
        const isChecked = selectedWeekdays.includes(weekday.value)

        return (
          <label key={weekday.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30">
            <span>{weekday.label}</span>
            <Checkbox checked={isChecked} onCheckedChange={(checked) => toggleWeekday(weekday.value, checked === true)} />
          </label>
        )
      })}
    </div>
  )
})

const RecordSummaryCard = memo(function RecordSummaryCard({ title, summary, hint }: { title: string; summary: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 text-right">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm font-medium leading-7 text-foreground">{summary}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
})

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

function formatCurrencyLabel(value: number) {
  return `${value.toLocaleString("ar-SA", { minimumFractionDigits: value % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} ريال`
}

function getLeaveTypesSummary(leaveTypes: EmployeeLeaveTypeBalance[]) {
  if (leaveTypes.length === 0) {
    return "لا توجد أنواع إجازات مضافة بعد"
  }

  return leaveTypes.map((leaveType) => `${leaveType.name}: ${leaveType.allowedDays} يوم`).join("، ")
}

function getLeaveDaysExcludingOfficialHolidays(startDate: string, endDate: string, officialHolidayRanges: Array<{ startDate: string; endDate: string }>) {
  const holidayDateSet = new Set(officialHolidayRanges.flatMap((holiday) => getDateKeysBetween(holiday.startDate, holiday.endDate)))
  return getDateKeysBetween(startDate, endDate).filter((dateKey) => !holidayDateSet.has(dateKey)).length
}

function getCurrentMonthLabel() {
  return new Intl.DateTimeFormat("ar-SA", {
    month: "long",
    year: "numeric",
  }).format(new Date())
}

function getTimeInputMinutes(value: string) {
  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null
  }

  return hours * 60 + minutes
}

function getDerivedWeeklyRequiredMinutes(startTime: string, endTime: string, templatePeriods?: Array<{ startTime: string; endTime: string }> | null, fallbackMinutes = 0) {
  if (templatePeriods && templatePeriods.length > 0) {
    const totalTemplateMinutes = templatePeriods.reduce((total, period) => {
      const startMinutes = getTimeInputMinutes(period.startTime)
      const endMinutes = getTimeInputMinutes(period.endTime)
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return total
      }

      return total + (endMinutes - startMinutes)
    }, 0)

    return totalTemplateMinutes > 0 ? totalTemplateMinutes : fallbackMinutes
  }

  const startMinutes = getTimeInputMinutes(startTime)
  const endMinutes = getTimeInputMinutes(endTime)
  if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
    return fallbackMinutes
  }

  return (endMinutes - startMinutes) * 5
}

function getHourlyDeductionAmount(monthlySalary: number, weeklyRequiredMinutes: number) {
  if (monthlySalary <= 0 || weeklyRequiredMinutes <= 0) {
    return 0
  }

  const averageMonthlyMinutes = Math.round((weeklyRequiredMinutes * 52) / 12)
  if (averageMonthlyMinutes <= 0) {
    return 0
  }

  return Number(((monthlySalary * 60) / averageMonthlyMinutes).toFixed(2))
}

function getTemplateLeaveQuotaDays(leaveTypes: Array<{ allowedDays: string }>) {
  return leaveTypes.reduce((total, leaveType) => total + (Number(leaveType.allowedDays) || 0), 0)
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

const EmploymentSectionButtons = memo(function EmploymentSectionButtons({ value, onChange }: { value: EmploymentSectionKey; onChange: (value: EmploymentSectionKey) => void }) {
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
})

const EmptyEmploymentTable = memo(function EmptyEmploymentTable({ message }: { message: string }) {
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
})

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

const EmploymentRecordsTable = memo(function EmploymentRecordsTable({
  section,
  requests,
  attendanceRecords,
  leaveBalance,
  officialHolidays,
}: {
  section: EmploymentSectionKey
  requests: AdministrativeRequestRecord[]
  attendanceRecords: AdministrativeDashboardData["attendanceHistory"]
  leaveBalance: AdministrativeDashboardData["leaveBalance"]
  officialHolidays: AdministrativeDashboardData["officialHolidays"]
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
                    {request.requestType === "leave" && request.leaveTypeName ? <p className="text-xs text-muted-foreground">نوع الإجازة: {request.leaveTypeName}</p> : null}
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
                  <TableCell className="text-right">
                    <div className="space-y-1">
                      <p>{request.subject}</p>
                      {request.leaveTypeName ? <p className="text-xs text-muted-foreground">{request.leaveTypeName}</p> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{request.startDate && request.endDate ? `${getLeaveDaysExcludingOfficialHolidays(request.startDate, request.endDate, officialHolidays)} يوم` : "-"}</TableCell>
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
})

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
    monthlySalary: "0",
    weeklyRequiredMinutes: "0",
    lateGraceMinutes: "0",
    scheduleTemplateId: "",
    workStartTime: "08:00",
    workEndTime: "16:00",
  })
  const [scheduleForm, setScheduleForm] = useState(createInitialScheduleForm)
  const [scheduleBaseWeekdays, setScheduleBaseWeekdays] = useState<number[]>([...defaultTemplateWeekdays])
  const [isGlobalBalancesDialogOpen, setIsGlobalBalancesDialogOpen] = useState(false)
  const [globalBalancesForm, setGlobalBalancesForm] = useState({
    lateQuotaMinutes: "0",
    permissionQuotaMinutes: "0",
    lateGraceMinutes: "0",
  })
  const [leaveTypesForm, setLeaveTypesForm] = useState<Array<{ id?: string; name: string; allowedDays: string; usedDays: number }>>([])
  const [isLeaveTypesDialogOpen, setIsLeaveTypesDialogOpen] = useState(false)
  const [officialHolidayForm, setOfficialHolidayForm] = useState({
    holidayId: null as string | null,
    name: "",
    startDate: "",
    endDate: "",
  })
  const [isOfficialHolidaysDialogOpen, setIsOfficialHolidaysDialogOpen] = useState(false)
  const [baseAttendanceWeekday, setBaseAttendanceWeekday] = useState<string>("all_days")
  const [attendancePeriodsForm, setAttendancePeriodsForm] = useState<Array<{ id?: string; weekday: string; startTime: string; endTime: string }>>([])

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
    setRequestForm((current) => {
      const nextTargetUserId = current.targetUserId || payload.internalRecipients[0]?.userId || ""
      const nextLeaveTypeBalanceId = current.leaveTypeBalanceId || payload.leaveTypeBalances[0]?.id || ""

      if (current.targetUserId === nextTargetUserId && current.leaveTypeBalanceId === nextLeaveTypeBalanceId) {
        return current
      }

      return {
        ...current,
        targetUserId: nextTargetUserId,
        leaveTypeBalanceId: nextLeaveTypeBalanceId,
      }
    })
    setSelectedAccountId((current) => current || (initialTab === "balances" ? payload.accounts[0]?.userId ?? allEmployeesValue : payload.currentUserId))
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

  useEffect(() => {
    function handleOpenOfficialHolidays() {
      setIsOfficialHolidaysDialogOpen(true)
    }

    function handleOpenLeaveTypes() {
      setIsLeaveTypesDialogOpen(true)
    }

    function handleOpenGlobalBalances() {
      setIsGlobalBalancesDialogOpen(true)
    }

    window.addEventListener("administrative-requests-open-official-holidays", handleOpenOfficialHolidays)
    window.addEventListener("administrative-requests-open-leave-types", handleOpenLeaveTypes)
    window.addEventListener("administrative-requests-open-global-balances", handleOpenGlobalBalances)

    return () => {
      window.removeEventListener("administrative-requests-open-official-holidays", handleOpenOfficialHolidays)
      window.removeEventListener("administrative-requests-open-leave-types", handleOpenLeaveTypes)
      window.removeEventListener("administrative-requests-open-global-balances", handleOpenGlobalBalances)
    }
  }, [])

  const selectedAccount = useMemo(
    () => selectedAccountId === allEmployeesValue ? null : data?.accounts.find((account) => account.userId === selectedAccountId) ?? null,
    [data?.accounts, selectedAccountId],
  )
  const isBulkBalanceMode = selectedAccountId === allEmployeesValue
  const globalBalancesSourceAccount = useMemo(
    () => data?.accounts.find((account) => account.userId === data.currentUserId) ?? data?.accounts[0] ?? null,
    [data?.accounts, data?.currentUserId],
  )
  const currentUserLeaveTypes = useMemo(
    () => data?.leaveTypeBalances ?? emptyLeaveTypes,
    [data?.leaveTypeBalances],
  )
  const currentUserLeaveTypeIds = useMemo(
    () => currentUserLeaveTypes.map((leaveType) => leaveType.id),
    [currentUserLeaveTypes],
  )
  const firstCurrentUserLeaveTypeId = currentUserLeaveTypeIds[0] ?? ""
  const currentUserLeaveTypeIdsKey = useMemo(() => currentUserLeaveTypeIds.join("|"), [currentUserLeaveTypeIds])

  useEffect(() => {
    const sourceAccount = selectedAccountId === allEmployeesValue
      ? data?.accounts[0] ?? null
      : selectedAccount

    if (!sourceAccount) {
      return
    }

    setBalanceForm((current) => {
      const nextForm = {
        leaveQuotaDays: String(sourceAccount.leaveBalance.leaveQuotaDays),
        lateQuotaMinutes: String(sourceAccount.leaveBalance.lateQuotaMinutes),
        permissionQuotaMinutes: String(sourceAccount.leaveBalance.permissionQuotaMinutes),
        monthlySalary: String(sourceAccount.leaveBalance.monthlySalary),
        weeklyRequiredMinutes: String(sourceAccount.leaveBalance.weeklyRequiredMinutes),
        lateGraceMinutes: String(sourceAccount.leaveBalance.lateGraceMinutes),
        scheduleTemplateId: sourceAccount.leaveBalance.scheduleTemplateId ?? "",
        workStartTime: sourceAccount.leaveBalance.workStartTime,
        workEndTime: sourceAccount.leaveBalance.workEndTime,
      }

      if (
        current.leaveQuotaDays === nextForm.leaveQuotaDays
        && current.lateQuotaMinutes === nextForm.lateQuotaMinutes
        && current.permissionQuotaMinutes === nextForm.permissionQuotaMinutes
        && current.monthlySalary === nextForm.monthlySalary
        && current.weeklyRequiredMinutes === nextForm.weeklyRequiredMinutes
        && current.lateGraceMinutes === nextForm.lateGraceMinutes
        && current.scheduleTemplateId === nextForm.scheduleTemplateId
        && current.workStartTime === nextForm.workStartTime
        && current.workEndTime === nextForm.workEndTime
      ) {
        return current
      }

      return nextForm
    })
  }, [data?.accounts, selectedAccount, selectedAccountId])

  useEffect(() => {
    if (!globalBalancesSourceAccount) {
      setGlobalBalancesForm((current) => (
        current.lateQuotaMinutes === "0" && current.permissionQuotaMinutes === "0"
          ? current
          : { lateQuotaMinutes: "0", permissionQuotaMinutes: "0" }
      ))
      setLeaveTypesForm((current) => current.length === 0 ? current : [])
      return
    }

    setGlobalBalancesForm((current) => {
      const nextForm = {
        lateQuotaMinutes: String(globalBalancesSourceAccount.leaveBalance.lateQuotaMinutes),
        permissionQuotaMinutes: String(globalBalancesSourceAccount.leaveBalance.permissionQuotaMinutes),
        lateGraceMinutes: String(globalBalancesSourceAccount.leaveBalance.lateGraceMinutes),
      }

      if (
        current.lateQuotaMinutes === nextForm.lateQuotaMinutes
        && current.permissionQuotaMinutes === nextForm.permissionQuotaMinutes
        && current.lateGraceMinutes === nextForm.lateGraceMinutes
      ) {
        return current
      }

      return nextForm
    })

    setLeaveTypesForm((current) => {
      const nextLeaveTypes = globalBalancesSourceAccount.leaveTypeBalances.map((leaveType) => ({
        id: leaveType.id,
        name: leaveType.name,
        allowedDays: String(leaveType.allowedDays),
        usedDays: leaveType.usedDays,
      }))

      if (
        current.length === nextLeaveTypes.length
        && current.every((entry, index) => (
          entry.id === nextLeaveTypes[index]?.id
          && entry.name === nextLeaveTypes[index]?.name
          && entry.allowedDays === nextLeaveTypes[index]?.allowedDays
          && entry.usedDays === nextLeaveTypes[index]?.usedDays
        ))
      ) {
        return current
      }

      return nextLeaveTypes
    })
  }, [globalBalancesSourceAccount])

  useEffect(() => {
    if (!selectedAccount) {
      setBaseAttendanceWeekday((current) => current === "all_days" ? current : "all_days")
      setAttendancePeriodsForm((current) => current.length === 0 ? current : [])
      return
    }

    const groupedPeriods = Array.from(
      selectedAccount.attendancePeriodOverrides
        .filter((override) => override.overrideDate === null && override.weekday !== null && !override.isRemoved)
        .reduce((groups, override) => {
          const key = `${override.startTime}-${override.endTime}`
          const existingGroup = groups.get(key)

          if (existingGroup) {
            existingGroup.weekdays.push(override.weekday!)
            return groups
          }

          groups.set(key, {
            id: override.id,
            startTime: override.startTime,
            endTime: override.endTime,
            weekdays: [override.weekday!],
          })

          return groups
        }, new Map<string, { id: string; startTime: string; endTime: string; weekdays: number[] }>())
        .values(),
    )

    const basePeriodIndex = groupedPeriods.findIndex((period) => (
      period.startTime === selectedAccount.leaveBalance.workStartTime
      && period.endTime === selectedAccount.leaveBalance.workEndTime
    ))
    const basePeriod = basePeriodIndex >= 0 ? groupedPeriods[basePeriodIndex] : null
    const nextBaseAttendanceWeekday = basePeriod ? getAttendancePeriodWeekdayValue(basePeriod.weekdays) : "all_days"

    setBaseAttendanceWeekday((current) => current === nextBaseAttendanceWeekday ? current : nextBaseAttendanceWeekday)

    setAttendancePeriodsForm((current) => {
      const nextPeriods = groupedPeriods
        .filter((_, index) => index !== basePeriodIndex)
        .map((period) => ({
          id: period.id,
          weekday: getAttendancePeriodWeekdayValue(period.weekdays),
          startTime: period.startTime,
          endTime: period.endTime,
        }))

      if (
        current.length === nextPeriods.length
        && current.every((period, index) => (
          period.id === nextPeriods[index]?.id
          && period.weekday === nextPeriods[index]?.weekday
          && period.startTime === nextPeriods[index]?.startTime
          && period.endTime === nextPeriods[index]?.endTime
        ))
      ) {
        return current
      }

      return nextPeriods
    })
  }, [selectedAccount])

  useEffect(() => {
    if (requestForm.requestType !== "leave") {
      return
    }

    const hasSelectedLeaveType = Boolean(requestForm.leaveTypeBalanceId) && currentUserLeaveTypeIds.includes(requestForm.leaveTypeBalanceId)
    const nextLeaveTypeBalanceId = hasSelectedLeaveType ? requestForm.leaveTypeBalanceId : firstCurrentUserLeaveTypeId

    if (requestForm.leaveTypeBalanceId === nextLeaveTypeBalanceId) {
      return
    }

    setRequestForm((current) => {
      if (current.requestType !== "leave") {
        return current
      }

      const nextLeaveTypeBalanceIdForCurrent = current.leaveTypeBalanceId && currentUserLeaveTypeIds.includes(current.leaveTypeBalanceId)
        ? current.leaveTypeBalanceId
        : firstCurrentUserLeaveTypeId

      if (current.leaveTypeBalanceId === nextLeaveTypeBalanceIdForCurrent) {
        return current
      }

      return {
        ...current,
        leaveTypeBalanceId: nextLeaveTypeBalanceIdForCurrent,
      }
    })
  }, [currentUserLeaveTypeIds, currentUserLeaveTypeIdsKey, firstCurrentUserLeaveTypeId, requestForm.leaveTypeBalanceId, requestForm.requestType])

  useEffect(() => {
    if (!data?.scheduleTemplates.length) {
      setScheduleBaseWeekdays((current) => current.length === defaultTemplateWeekdays.length ? current : [...defaultTemplateWeekdays])
      setScheduleForm(createInitialScheduleForm())
      return
    }

    setScheduleForm((current) => {
      const templateId = current.templateId ?? data.scheduleTemplates[0]?.id ?? null
      const sourceTemplate = data.scheduleTemplates.find((template) => template.id === templateId)

      if (!sourceTemplate) {
        setScheduleBaseWeekdays((current) => current.length === defaultTemplateWeekdays.length ? current : [...defaultTemplateWeekdays])
        return createInitialScheduleForm()
      }

      const groupedPeriods = Array.from(
        sourceTemplate.periods.reduce((groups, period) => {
          const key = `${period.startTime}-${period.endTime}`
          const existingGroup = groups.get(key)

          if (existingGroup) {
            existingGroup.weekdays.push(period.weekday)
            return groups
          }

          groups.set(key, {
            startTime: period.startTime,
            endTime: period.endTime,
            weekdays: [period.weekday],
          })

          return groups
        }, new Map<string, { startTime: string; endTime: string; weekdays: number[] }>()).values(),
      )

      const basePeriodIndex = groupedPeriods.findIndex((period) => (
        period.startTime === sourceTemplate.workStartTime
        && period.endTime === sourceTemplate.workEndTime
      ))
      const basePeriod = basePeriodIndex >= 0 ? groupedPeriods[basePeriodIndex] : null
      const nextScheduleBaseWeekdays = normalizeTemplateWeekdays(basePeriod?.weekdays ?? defaultTemplateWeekdays)
      setScheduleBaseWeekdays((current) => (
        current.length === nextScheduleBaseWeekdays.length
        && current.every((weekday, index) => weekday === nextScheduleBaseWeekdays[index])
      ) ? current : nextScheduleBaseWeekdays)

      return {
        templateId: sourceTemplate.id,
        name: sourceTemplate.name,
        description: sourceTemplate.description,
        lateQuotaMinutes: String(sourceTemplate.lateQuotaMinutes),
        permissionQuotaMinutes: String(sourceTemplate.permissionQuotaMinutes),
        workStartTime: sourceTemplate.workStartTime,
        workEndTime: sourceTemplate.workEndTime,
        periods: groupedPeriods
          .filter((_, index) => index !== basePeriodIndex)
          .map((period) => ({
            weekdays: normalizeTemplateWeekdays(period.weekdays),
            startTime: period.startTime,
            endTime: period.endTime,
          })),
      }
    })
  }, [data?.scheduleTemplates])

  const pendingReviewRequests = useMemo(
    () => data?.reviewableRequests.filter((request) => request.status === "pending") ?? [],
    [data?.reviewableRequests],
  )

  const selectedScheduleTemplate = useMemo(
    () => data?.scheduleTemplates.find((template) => template.id === balanceForm.scheduleTemplateId) ?? null,
    [balanceForm.scheduleTemplateId, data?.scheduleTemplates],
  )
  const selectedAccountPeriodOverrides = selectedAccount?.attendancePeriodOverrides ?? []
  const derivedWeeklyRequiredMinutes = useMemo(
    () => getDerivedWeeklyRequiredMinutes(
      balanceForm.workStartTime,
      balanceForm.workEndTime,
      selectedScheduleTemplate?.periods ?? null,
      Number(balanceForm.weeklyRequiredMinutes) || 0,
    ),
    [balanceForm.weeklyRequiredMinutes, balanceForm.workEndTime, balanceForm.workStartTime, selectedScheduleTemplate?.periods],
  )
  const hourlyDeductionAmount = useMemo(
    () => getHourlyDeductionAmount(Number(balanceForm.monthlySalary) || 0, derivedWeeklyRequiredMinutes),
    [balanceForm.monthlySalary, derivedWeeklyRequiredMinutes],
  )
  const currentMonthLabel = useMemo(() => getCurrentMonthLabel(), [])
  const scheduleFormWeeklyRequiredMinutes = useMemo(
    () => getDerivedWeeklyRequiredMinutes(
      scheduleForm.workStartTime,
      scheduleForm.workEndTime,
      expandSchedulePeriods([
        {
          weekdays: scheduleBaseWeekdays,
          startTime: scheduleForm.workStartTime,
          endTime: scheduleForm.workEndTime,
        },
        ...scheduleForm.periods.map((period) => ({
          weekdays: period.weekdays,
          startTime: period.startTime,
          endTime: period.endTime,
        })),
      ]),
      0,
    ),
    [scheduleBaseWeekdays, scheduleForm.periods, scheduleForm.workEndTime, scheduleForm.workStartTime],
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

    return data.allRequests.filter((request) => request.requesterId === managerSelectedAccount.userId)
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
    monthlySalary: 0,
    weeklyRequiredMinutes: 0,
    lateGraceMinutes: 0,
    scheduleTemplateId: null,
    workStartTime: "08:00",
    workEndTime: "16:00",
  }
  const employmentViewLeaveRemaining = employmentViewLeaveBalance.leaveQuotaDays - employmentViewLeaveBalance.leaveTakenDays
  const employmentViewPermissionRemaining = employmentViewLeaveBalance.permissionQuotaMinutes - employmentViewLeaveBalance.permissionUsedMinutes
  const employmentViewLateRemaining = employmentViewLeaveBalance.lateQuotaMinutes - employmentViewLeaveBalance.lateUsedMinutes
  const employmentViewWarningCount = (data?.attendanceHistory ?? []).filter((record) => record.status === "incomplete" || Boolean(record.notes)).length
  const employmentViewInterrogationCount = (data?.myRequests ?? []).filter((request) => request.status === "rejected" || request.status === "cancelled").length
  const globalLeaveQuotaDays = leaveTypesForm.reduce((total, leaveType) => total + (Number(leaveType.allowedDays) || 0), 0)

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
        leaveTypeBalanceId: requestForm.requestType === "leave" ? requestForm.leaveTypeBalanceId || undefined : undefined,
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

  function loadTemplateIntoForm(templateId: string | null) {
    if (!templateId) {
      setScheduleBaseWeekdays([...defaultTemplateWeekdays])
      setScheduleForm(createInitialScheduleForm())
      return
    }

    const template = data?.scheduleTemplates.find((entry) => entry.id === templateId)
    if (!template) {
      setScheduleBaseWeekdays([...defaultTemplateWeekdays])
      setScheduleForm(createInitialScheduleForm())
      return
    }

    const groupedPeriods = Array.from(
      template.periods.reduce((groups, period) => {
        const key = `${period.startTime}-${period.endTime}`
        const existingGroup = groups.get(key)

        if (existingGroup) {
          existingGroup.weekdays.push(period.weekday)
          return groups
        }

        groups.set(key, {
          startTime: period.startTime,
          endTime: period.endTime,
          weekdays: [period.weekday],
        })

        return groups
      }, new Map<string, { startTime: string; endTime: string; weekdays: number[] }>()).values(),
    )

    const basePeriodIndex = groupedPeriods.findIndex((period) => (
      period.startTime === template.workStartTime
      && period.endTime === template.workEndTime
    ))
    const basePeriod = basePeriodIndex >= 0 ? groupedPeriods[basePeriodIndex] : null
    setScheduleBaseWeekdays(normalizeTemplateWeekdays(basePeriod?.weekdays ?? defaultTemplateWeekdays))

    setScheduleForm({
      templateId: template.id,
      name: template.name,
      description: template.description,
      lateQuotaMinutes: String(template.lateQuotaMinutes),
      permissionQuotaMinutes: String(template.permissionQuotaMinutes),
      workStartTime: template.workStartTime,
      workEndTime: template.workEndTime,
      periods: groupedPeriods
        .filter((_, index) => index !== basePeriodIndex)
        .map((period) => ({
          weekdays: normalizeTemplateWeekdays(period.weekdays),
          startTime: period.startTime,
          endTime: period.endTime,
        })),
    })
  }

  function applyScheduleTemplateToBalanceForm(templateId: string) {
    if (templateId === "no_template") {
      setBalanceForm((current) => ({ ...current, scheduleTemplateId: "" }))
      return
    }

    const template = data?.scheduleTemplates.find((entry) => entry.id === templateId)
    if (!template) {
      setBalanceForm((current) => ({ ...current, scheduleTemplateId: templateId }))
      return
    }

    setBalanceForm({
      leaveQuotaDays: String(template.leaveQuotaDays),
      lateQuotaMinutes: String(template.lateQuotaMinutes),
      permissionQuotaMinutes: String(template.permissionQuotaMinutes),
      monthlySalary: String(template.monthlySalary),
      weeklyRequiredMinutes: String(template.weeklyRequiredMinutes),
      lateGraceMinutes: String(template.lateGraceMinutes),
      scheduleTemplateId: template.id,
      workStartTime: template.workStartTime,
      workEndTime: template.workEndTime,
    })
  }

  function handleSaveScheduleTemplate() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_schedule_template",
          templateId: scheduleForm.templateId,
          name: scheduleForm.name,
          description: scheduleForm.description,
          lateQuotaMinutes: Number(scheduleForm.lateQuotaMinutes) || 0,
          permissionQuotaMinutes: Number(scheduleForm.permissionQuotaMinutes) || 0,
          weeklyRequiredMinutes: scheduleFormWeeklyRequiredMinutes,
          workStartTime: scheduleForm.workStartTime,
          workEndTime: scheduleForm.workEndTime,
          periods: expandSchedulePeriods([
            {
              weekdays: scheduleBaseWeekdays,
              startTime: scheduleForm.workStartTime,
              endTime: scheduleForm.workEndTime,
            },
            ...scheduleForm.periods,
          ]),
        }),
      })

      const payload = (await response.json()) as { error?: string; templateId?: string }
      if (!response.ok) {
        setError(payload.error ?? "تعذر حفظ قالب الدوام")
        return
      }

      if (payload.templateId) {
        setScheduleForm((current) => ({ ...current, templateId: payload.templateId ?? current.templateId }))
      }

      setMessage("تم حفظ قالب الدوام")
      await loadData()
    })
  }

  function handleDeleteScheduleTemplate() {
    if (!scheduleForm.templateId) {
      return
    }

    setMessage(null)
    setError(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_schedule_template",
          templateId: scheduleForm.templateId,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? "تعذر حذف قالب الدوام")
        return
      }

      setMessage("تم حذف قالب الدوام")
      setScheduleForm(createInitialScheduleForm())
      await loadData()
    })
  }

  function handleSaveGlobalBalances() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_general_balances",
          lateQuotaMinutes: Number(globalBalancesForm.lateQuotaMinutes) || 0,
          permissionQuotaMinutes: Number(globalBalancesForm.permissionQuotaMinutes) || 0,
          lateGraceMinutes: Number(globalBalancesForm.lateGraceMinutes) || 0,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? "تعذر حفظ الأرصدة العامة")
        return
      }

      setMessage("تم حفظ الأرصدة العامة لجميع الموظفين")
      setIsGlobalBalancesDialogOpen(false)
      await loadData()
    })
  }

  function handleSaveGlobalLeaveTypes() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_general_balances",
          leaveQuotaDays: globalLeaveQuotaDays,
          leaveTypes: leaveTypesForm.map((leaveType) => ({
            id: leaveType.id,
            name: leaveType.name,
            allowedDays: Number(leaveType.allowedDays) || 0,
          })),
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? "تعذر حفظ أنواع الإجازات")
        return
      }

      setMessage("تم حفظ أنواع الإجازات العامة")
      setIsLeaveTypesDialogOpen(false)
      await loadData()
    })
  }

  function handleSaveOfficialHoliday() {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_official_holiday",
          holidayId: officialHolidayForm.holidayId,
          name: officialHolidayForm.name,
          startDate: officialHolidayForm.startDate,
          endDate: officialHolidayForm.endDate,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? "تعذر حفظ الإجازة الرسمية")
        return
      }

      setMessage("تم حفظ الإجازة الرسمية")
      setOfficialHolidayForm({ holidayId: null, name: "", startDate: "", endDate: "" })
      await loadData()
    })
  }

  function handleDeleteOfficialHoliday(holidayId: string) {
    setMessage(null)
    setError(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_official_holiday", holidayId }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(payload.error ?? "تعذر حذف الإجازة الرسمية")
        return
      }

      setMessage("تم حذف الإجازة الرسمية")
      await loadData()
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
  const requestedLeaveDays = requestForm.startDate && requestForm.endDate
    ? getLeaveDaysExcludingOfficialHolidays(requestForm.startDate, requestForm.endDate, data.officialHolidays)
    : 0
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
    balances: "إعدادات الحضور",
    reviews: "طلبات الموظفين",
    employment_records: "سجلات الموظفين",
  }

  const pageDescriptionByTab: Record<string, string> = {
    submit: "تقديم الطلبات الإدارية ومتابعة حالتها واعتمادها من مدير النظام عند الحاجة.",
    my_requests: "متابعة الطلبات التي رفعتها وحالة كل طلب بحسب قرار المدير من صفحة مستقلة.",
    profile: "استعراض بيانات الحساب الوظيفية الأساسية من صفحة مستقلة.",
    employment: "عرض سجل إنشاء الحساب ونوعه والجهة التي قامت بإنشائه.",
    balances: "إدارة قوالب الدوام والأرصدة العامة والإجازات الرسمية من صفحة مستقلة.",
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
              officialHolidays={data.officialHolidays}
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
                          {request.requestType === "leave" && request.leaveTypeName ? <p className="text-xs text-muted-foreground">نوع الإجازة: {request.leaveTypeName}</p> : null}
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
                  officialHolidays={data.officialHolidays}
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
                    <div className="space-y-2 text-right md:col-span-2">
                      <Label className={rtlLabelClassName}>نوع الإجازة</Label>
                      <Select value={requestForm.leaveTypeBalanceId || "no_leave_type"} onValueChange={(value) => setRequestForm((current) => ({ ...current, leaveTypeBalanceId: value === "no_leave_type" ? "" : value }))}>
                        <SelectTrigger className={rtlSelectTriggerClassName}><SelectValue placeholder="اختر نوع الإجازة" /></SelectTrigger>
                        <SelectContent>
                          {currentUserLeaveTypes.length === 0 ? (
                            <SelectItem value="no_leave_type">لا توجد أنواع إجازات مضافة</SelectItem>
                          ) : currentUserLeaveTypes.map((leaveType) => (
                            <SelectItem key={leaveType.id} value={leaveType.id}>{leaveType.name} - {leaveType.allowedDays - leaveType.usedDays} يوم متبقي</SelectItem>
                          ))}
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
                    {requestForm.startDate && requestForm.endDate ? (
                      <div className="text-right text-xs text-muted-foreground md:col-span-2">
                        الأيام المحتسبة من الرصيد بعد استثناء الإجازات الرسمية: {requestedLeaveDays} يوم
                      </div>
                    ) : null}
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
            <>
            <Accordion type="single" collapsible className="rounded-[1.5rem] border border-white/80 bg-white/95">
              <AccordionItem value="schedule-templates" className="overflow-hidden rounded-[1.5rem] border-none">
                <AccordionTrigger className="flex-row-reverse px-6 py-5 text-right hover:no-underline [&_svg]:shrink-0">
                  <div className="text-right">
                    <p className="text-lg font-semibold text-foreground">قوالب الدوام</p>
                    <p className="mt-1 text-sm text-muted-foreground">أنشئ القوالب الخاصة بالأيام والفترات فقط، ثم اربط القالب بالموظف من صفحة إدارة الموظفين.</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6">
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 text-right md:col-span-2">
                    <Label className={rtlLabelClassName}>القالب</Label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setScheduleForm(createInitialScheduleForm())}>
                        <Plus className="h-4 w-4" />
                        قالب جديد
                      </Button>
                      <Select value={scheduleForm.templateId ?? "new_template"} onValueChange={(value) => loadTemplateIntoForm(value === "new_template" ? null : value)}>
                        <SelectTrigger className="w-full md:max-w-sm text-right [&>span]:text-right"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new_template">قالب جديد</SelectItem>
                          {(data.scheduleTemplates ?? []).map((template) => (
                            <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2 text-right">
                    <Label className={rtlLabelClassName}>اسم القالب</Label>
                    <Input value={scheduleForm.name} onChange={(event) => setScheduleForm((current) => ({ ...current, name: event.target.value }))} className={rtlInputClassName} />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label className={rtlLabelClassName}>الوصف</Label>
                    <Textarea value={scheduleForm.description} onChange={(event) => setScheduleForm((current) => ({ ...current, description: event.target.value }))} className={`min-h-24 ${rtlInputClassName}`} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-2" dir="rtl">
                  <div className="space-y-2 text-right">
                    <Label className={rtlLabelClassName}>دقائق الاستئذان المسموحة</Label>
                    <Input type="number" min="0" value={scheduleForm.permissionQuotaMinutes} onChange={(event) => setScheduleForm((current) => ({ ...current, permissionQuotaMinutes: event.target.value }))} className={rtlInputClassName} />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label className={rtlLabelClassName}>دقائق التأخير المسموحة</Label>
                    <Input type="number" min="0" value={scheduleForm.lateQuotaMinutes} onChange={(event) => setScheduleForm((current) => ({ ...current, lateQuotaMinutes: event.target.value }))} className={rtlInputClassName} />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[180px,180px,minmax(0,1fr)]" dir="rtl">
                  <div className="space-y-2 text-right">
                    <Label className={rtlLabelClassName}>بداية الدوام من</Label>
                    <Input type="time" value={scheduleForm.workStartTime} onChange={(event) => setScheduleForm((current) => ({ ...current, workStartTime: event.target.value }))} className={rtlInputClassName} />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label className={rtlLabelClassName}>نهاية الدوام إلى</Label>
                    <Input type="time" value={scheduleForm.workEndTime} onChange={(event) => setScheduleForm((current) => ({ ...current, workEndTime: event.target.value }))} className={rtlInputClassName} />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label className={rtlLabelClassName}>الأيام</Label>
                    <WeekdayCheckboxGroup value={scheduleBaseWeekdays} onChange={setScheduleBaseWeekdays} />
                  </div>
                </div>

                {scheduleForm.periods.length > 0 ? (
                  <div className="space-y-4">
                    {scheduleForm.periods.map((period, index) => (
                      <div key={`${period.startTime}-${period.endTime}-${index}`} className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                        <div className="grid gap-4 xl:grid-cols-[180px,180px,minmax(0,1fr),auto]" dir="rtl">
                        <div className="space-y-2 text-right">
                            <Label className={rtlLabelClassName}>بداية الدوام من</Label>
                            <Input type="time" value={period.startTime} onChange={(event) => setScheduleForm((current) => ({ ...current, periods: current.periods.map((entry, periodIndex) => periodIndex === index ? { ...entry, startTime: event.target.value } : entry) }))} className={rtlInputClassName} />
                        </div>
                        <div className="space-y-2 text-right">
                            <Label className={rtlLabelClassName}>نهاية الدوام إلى</Label>
                            <Input type="time" value={period.endTime} onChange={(event) => setScheduleForm((current) => ({ ...current, periods: current.periods.map((entry, periodIndex) => periodIndex === index ? { ...entry, endTime: event.target.value } : entry) }))} className={rtlInputClassName} />
                        </div>
                        <div className="space-y-2 text-right">
                            <Label className={rtlLabelClassName}>الأيام</Label>
                            <WeekdayCheckboxGroup
                              value={period.weekdays}
                              onChange={(value) => setScheduleForm((current) => ({
                                ...current,
                                periods: current.periods.map((entry, periodIndex) => periodIndex === index ? { ...entry, weekdays: value } : entry),
                              }))}
                            />
                        </div>
                        <div className="flex items-end justify-end">
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setScheduleForm((current) => ({ ...current, periods: current.periods.filter((_, periodIndex) => periodIndex !== index) }))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex justify-start">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setScheduleForm((current) => ({
                      ...current,
                      periods: [...current.periods, createSchedulePeriodFormEntry(current.workStartTime, current.workEndTime)],
                    }))}
                  >
                    <Plus className="h-4 w-4" />
                    إضافة فترة
                  </Button>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  {scheduleForm.templateId ? (
                    <Button type="button" variant="outline" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" disabled={isPending} onClick={handleDeleteScheduleTemplate}>
                      <Trash2 className="h-4 w-4" />
                      حذف القالب
                    </Button>
                  ) : null}
                  <Button type="button" className="rounded-xl" disabled={isPending || !scheduleForm.name.trim()} onClick={handleSaveScheduleTemplate}>
                    <Plus className="h-4 w-4" />
                    {scheduleForm.templateId ? "حفظ التعديلات" : "إضافة القالب"}
                  </Button>
                </div>
              </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Dialog open={isGlobalBalancesDialogOpen} onOpenChange={setIsGlobalBalancesDialogOpen}>
              <DialogContent className="max-w-2xl text-right" showCloseButton={false}>
                <DialogHeader className="space-y-2 text-right">
                  <DialogTitle>إدارة الأرصدة</DialogTitle>
                  <DialogDescription>حدّث الإعدادات العامة التي تطبق على جميع الموظفين، بينما تُدار أنواع الإجازات من النافذة المستقلة.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3" dir="rtl">
                    <div className="space-y-2 text-right">
                      <Label className={`${rtlLabelClassName} whitespace-nowrap`}>دقائق الاستئذان المسموحة</Label>
                      <Input type="number" min="0" value={globalBalancesForm.permissionQuotaMinutes} onChange={(event) => setGlobalBalancesForm((current) => ({ ...current, permissionQuotaMinutes: event.target.value }))} className={rtlInputClassName} />
                    </div>
                    <div className="space-y-2 text-right">
                      <Label className={rtlLabelClassName}>دقائق التأخير المسموحة</Label>
                      <Input type="number" min="0" value={globalBalancesForm.lateQuotaMinutes} onChange={(event) => setGlobalBalancesForm((current) => ({ ...current, lateQuotaMinutes: event.target.value }))} className={rtlInputClassName} />
                    </div>
                    <div className="space-y-2 text-right">
                      <Label className={rtlLabelClassName}>سماحية التأخير</Label>
                      <Input type="number" min="0" value={globalBalancesForm.lateGraceMinutes} onChange={(event) => setGlobalBalancesForm((current) => ({ ...current, lateGraceMinutes: event.target.value }))} className={rtlInputClassName} />
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-3">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsGlobalBalancesDialogOpen(false)}>
                      إغلاق
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl"
                      disabled={isPending || leaveTypesForm.some((leaveType) => !leaveType.name.trim())}
                      onClick={handleSaveGlobalBalances}
                    >
                      حفظ الأرصدة
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isLeaveTypesDialogOpen} onOpenChange={setIsLeaveTypesDialogOpen}>
              <DialogContent className="max-w-3xl text-right" showCloseButton={false}>
                <DialogHeader className="space-y-2 text-right">
                  <DialogTitle>أنواع الإجازات</DialogTitle>
                  <DialogDescription>أضف أنواع الإجازات العامة وعدد الأيام المعتمدة لكل نوع لجميع الموظفين.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="flex justify-start">
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => setLeaveTypesForm((current) => [...current, { name: "", allowedDays: "0", usedDays: 0 }])}
                    >
                      <Plus className="h-4 w-4" />
                      إضافة نوع إجازة
                    </Button>
                  </div>

                  <ScrollArea className="max-h-[420px] rounded-2xl border border-border/60 bg-muted/10">
                    <div className="space-y-3 p-4">
                      {leaveTypesForm.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-white p-6 text-center text-sm text-muted-foreground">
                          لا توجد أنواع إجازات عامة مضافة حتى الآن.
                        </div>
                      ) : leaveTypesForm.map((leaveType, index) => (
                        <div key={leaveType.id ?? `new-${index}`} className="grid gap-3 rounded-2xl border border-border/60 bg-white p-4 md:grid-cols-[1fr,160px,auto]" dir="rtl">
                          <div className="space-y-2 text-right">
                            <Label className={rtlLabelClassName}>اسم الإجازة</Label>
                            <Input
                              value={leaveType.name}
                              onChange={(event) => setLeaveTypesForm((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))}
                              className={rtlInputClassName}
                            />
                          </div>
                          <div className="space-y-2 text-right">
                            <Label className={rtlLabelClassName}>عدد الأيام</Label>
                            <Input
                              type="number"
                              min="0"
                              value={leaveType.allowedDays}
                              onChange={(event) => setLeaveTypesForm((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, allowedDays: event.target.value } : entry))}
                              className={rtlInputClassName}
                            />
                          </div>
                          <div className="flex items-end justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setLeaveTypesForm((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  <div className="flex flex-wrap justify-end gap-3">
                    <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsLeaveTypesDialogOpen(false)}>
                      إغلاق
                    </Button>
                    <Button
                      type="button"
                      className="rounded-xl"
                      disabled={isPending || leaveTypesForm.some((leaveType) => !leaveType.name.trim())}
                      onClick={handleSaveGlobalLeaveTypes}
                    >
                      حفظ أنواع الإجازات
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={isOfficialHolidaysDialogOpen} onOpenChange={setIsOfficialHolidaysDialogOpen}>
              <DialogContent className="max-w-5xl text-right" showCloseButton={false}>
                <DialogHeader className="space-y-2 text-right">
                  <DialogTitle>الإجازات الرسمية</DialogTitle>
                  <DialogDescription>رتّب الإجازات الرسمية بشكل أوضح، وأدرج كل فترة مع تاريخ البداية والنهاية ضمن قائمة سهلة للمراجعة والتعديل.</DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]" dir="rtl">
                  <div className="space-y-4 rounded-[1.75rem] border border-border/60 bg-muted/10 p-5">
                    <div className="space-y-1 text-right">
                      <p className="text-base font-semibold text-foreground">{officialHolidayForm.holidayId ? "تعديل إجازة رسمية" : "إضافة إجازة رسمية"}</p>
                      <p className="text-sm text-muted-foreground">أدخل اسم الإجازة وحدد نطاقها الزمني، ثم احفظها لتظهر في القائمة.</p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2 text-right">
                        <Label className={rtlLabelClassName}>اسم الإجازة</Label>
                        <Input value={officialHolidayForm.name} onChange={(event) => setOfficialHolidayForm((current) => ({ ...current, name: event.target.value }))} className={rtlInputClassName} />
                      </div>
                      <div className="space-y-2 text-right">
                        <Label className={rtlLabelClassName}>من تاريخ</Label>
                        <DatePickerField value={officialHolidayForm.startDate} onChange={(value) => setOfficialHolidayForm((current) => ({ ...current, startDate: value }))} placeholder="اختر تاريخ البداية" className={`${rtlDatePickerClassName} w-full`} />
                      </div>
                      <div className="space-y-2 text-right">
                        <Label className={rtlLabelClassName}>إلى تاريخ</Label>
                        <DatePickerField value={officialHolidayForm.endDate} onChange={(value) => setOfficialHolidayForm((current) => ({ ...current, endDate: value }))} placeholder="اختر تاريخ النهاية" className={`${rtlDatePickerClassName} w-full`} />
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap justify-end gap-3">
                      {officialHolidayForm.holidayId ? (
                        <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOfficialHolidayForm({ holidayId: null, name: "", startDate: "", endDate: "" })}>
                          إلغاء التعديل
                        </Button>
                      ) : null}
                      <Button type="button" className="rounded-xl" disabled={isPending || !officialHolidayForm.name.trim() || !officialHolidayForm.startDate || !officialHolidayForm.endDate} onClick={handleSaveOfficialHoliday}>
                        <Plus className="h-4 w-4" />
                        {officialHolidayForm.holidayId ? "حفظ التعديل" : "إضافة إجازة رسمية"}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[1.75rem] border border-border/60 bg-white">
                    <div className="border-b border-border/60 px-5 py-4 text-right">
                      <p className="text-base font-semibold text-foreground">قائمة الإجازات الرسمية</p>
                      <p className="mt-1 text-sm text-muted-foreground">راجع الفترات الحالية أو عدّل أي إجازة مباشرة من القائمة.</p>
                    </div>
                    <ScrollArea className="max-h-[520px]">
                      <div className="space-y-3 p-4">
                        {data.officialHolidays.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                            لا توجد إجازات رسمية مضافة حاليًا.
                          </div>
                        ) : data.officialHolidays.map((holiday) => (
                          <div key={holiday.id} className="rounded-2xl border border-border/60 bg-muted/10 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="text-right">
                                <p className="text-base font-semibold text-foreground">{holiday.name}</p>
                                <div className="mt-2 flex flex-wrap justify-end gap-2 text-xs text-muted-foreground">
                                  <span className="rounded-full bg-white px-3 py-1">من {formatDate(holiday.startDate)}</span>
                                  <span className="rounded-full bg-white px-3 py-1">إلى {formatDate(holiday.endDate)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button type="button" variant="ghost" className="rounded-xl" disabled={isPending} onClick={() => setOfficialHolidayForm({ holidayId: holiday.id, name: holiday.name, startDate: holiday.startDate, endDate: holiday.endDate })}>
                                  تعديل
                                </Button>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700" disabled={isPending} onClick={() => handleDeleteOfficialHoliday(holiday.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            </>
          ) : null}
        </TabsContent>
      </Tabs>
    </section>
  )
}
