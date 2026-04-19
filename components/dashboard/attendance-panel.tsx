"use client"

import Link from "next/link"
import { AlertCircle, BriefcaseBusiness, CheckCircle2, LoaderCircle } from "lucide-react"
import { useEffect, useState, useTransition } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  formatDate,
  formatTime,
  formatWorkedHours,
  getWeekdayLabel,
  toSaudiDateInputValue,
  toSaudiTimeInputValue,
  type AdministrativeDashboardData,
} from "@/lib/administrative-services"

type AttendancePanelProps = {
  data: AdministrativeDashboardData
  onRefresh: () => Promise<void>
  compact?: boolean
}

type Coordinates = {
  latitude: number
  longitude: number
}

function getInitialPermissionForm() {
  const fromTime = toSaudiTimeInputValue(new Date())
  const toTime = toSaudiTimeInputValue(new Date(Date.now() + 60 * 60 * 1000))

  return {
    subject: "استئذان سريع",
    details: "استئذان عاجل",
    requestDate: toSaudiDateInputValue(new Date()),
    fromTime,
    toTime,
  }
}

export function AttendancePanel({ data, onRefresh, compact = false }: AttendancePanelProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  useEffect(() => {
    let currentSaudiDate = toSaudiDateInputValue(new Date())

    const interval = window.setInterval(() => {
      const nextSaudiDate = toSaudiDateInputValue(new Date())
      if (nextSaudiDate === currentSaudiDate) {
        return
      }

      currentSaudiDate = nextSaudiDate
      setFeedback(null)
      void onRefresh()
    }, 30000)

    return () => window.clearInterval(interval)
  }, [onRefresh])

  async function getCurrentCoordinates() {
    return new Promise<Coordinates>((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("المتصفح الحالي لا يدعم خدمات الموقع"))
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          })
        },
        () => reject(new Error("تعذر قراءة موقعك الحالي. تأكد من منح إذن الموقع للمتصفح")),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      )
    })
  }

  function runRequest(task: () => Promise<void>) {
    setFeedback(null)
    startTransition(async () => {
      try {
        await task()
      } catch (error) {
        setFeedback({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
      }
    })
  }

  function handleClock(eventType: "clock_in" | "clock_out") {
    runRequest(async () => {
      const coordinates = await getCurrentCoordinates()
      const response = await fetch("/api/admin/administrative-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clock_attendance",
          eventType,
          coordinates,
        }),
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر تنفيذ العملية")
      }

      setFeedback({ type: "success", text: eventType === "clock_in" ? "تم تسجيل الحضور بنجاح" : "تم تسجيل الانصراف بنجاح" })
      await onRefresh()
    })
  }

  function handleQuickPermissionRequest() {
    const quickForm = getInitialPermissionForm()

    runRequest(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_request",
          requestType: "permission",
          subject: quickForm.subject,
          details: quickForm.details,
          requestDate: quickForm.requestDate,
          fromTime: quickForm.fromTime,
          toTime: quickForm.toTime,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر تسجيل الاستئذان")
      }

      setFeedback({ type: "success", text: "تم إرسال الاستئذان السريع مباشرة" })
      await onRefresh()
    })
  }

  const todayRecord = data.todayAttendance
  const hasClockedIn = Boolean(todayRecord?.clockInAt)
  const hasClockedOut = Boolean(todayRecord?.clockOutAt)
  const canClockIn = data.workLocation.isConfigured && !hasClockedIn
  const canClockOut = data.workLocation.isConfigured && hasClockedIn && !hasClockedOut
  const attendanceAction = canClockIn ? "clock_in" : canClockOut ? "clock_out" : null
  const attendanceButtonLabel = !hasClockedIn ? "تسجيل حضور" : !hasClockedOut ? "تسجيل انصراف" : "اكتمل تسجيل اليوم"
  const showPermissionButton = hasClockedIn && !hasClockedOut

  return (
    <div className="space-y-4">
      {feedback ? (
        <Alert className={feedback.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{feedback.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
        <CardHeader>
          <CardTitle>{compact ? "التحضير اليومي" : "تسجيل الحضور والانصراف"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!data.workLocation.isConfigured ? (
            <Alert variant="destructive" className="rounded-[1.25rem] text-right">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>لم يتم تفعيل موقع التحضير</AlertTitle>
              <AlertDescription>لن يتمكن الموظفون من تسجيل الحضور حتى يحدد المدير موقع العمل ونطاقه المسموح.</AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-[1.25rem] border border-primary/20 bg-primary/5 p-4 text-right">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary" className="rounded-full">{data.workLocation.radiusMeters} متر</Badge>
                <div>
                  <p className="font-semibold text-foreground">{data.workLocation.name}</p>
                  <p className="text-sm text-muted-foreground">{data.workLocation.address}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button"
              className="rounded-xl"
              disabled={isPending || !attendanceAction}
              onClick={() => attendanceAction && handleClock(attendanceAction)}
            >
              {attendanceButtonLabel}
            </Button>
            {showPermissionButton ? (
              <Button type="button" variant="outline" className="rounded-xl" onClick={handleQuickPermissionRequest} disabled={isPending}>
                <BriefcaseBusiness className="h-4 w-4" />
                تسجيل استئذان
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
        <CardHeader>
          <CardTitle>السجل الأسبوعي</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اليوم</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">أول حضور</TableHead>
                <TableHead className="text-right">آخر انصراف</TableHead>
                <TableHead className="text-right">عدد ساعات العمل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.weeklyAttendance.map((entry) => (
                <TableRow key={entry.workDate}>
                  <TableCell className="text-right font-medium">{getWeekdayLabel(entry.workDate)}</TableCell>
                  <TableCell className="text-right">{formatDate(entry.workDate)}</TableCell>
                  <TableCell className="text-right">{formatTime(entry.firstClockInAt)}</TableCell>
                  <TableCell className="text-right">{formatTime(entry.lastClockOutAt)}</TableCell>
                  <TableCell className="text-right font-medium text-foreground">{formatWorkedHours(entry.workedMinutes)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
