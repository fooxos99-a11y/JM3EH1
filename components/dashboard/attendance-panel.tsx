"use client"

import Link from "next/link"
import { AlertCircle, BriefcaseBusiness, CheckCircle2, LoaderCircle, LogIn, LogOut, MapPin } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import { WorkLocationMapPicker } from "@/components/dashboard/work-location-map-picker"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
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

const defaultRiyadhCoordinates: Coordinates = {
  latitude: 24.7136,
  longitude: 46.6753,
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
  const [advancedPermissionOpen, setAdvancedPermissionOpen] = useState(false)
  const [permissionForm, setPermissionForm] = useState(getInitialPermissionForm)
  const [locationForm, setLocationForm] = useState({
    name: data.workLocation.name,
    address: data.workLocation.address,
    radiusMeters: data.workLocation.radiusMeters,
    latitude: data.workLocation.latitude ?? defaultRiyadhCoordinates.latitude,
    longitude: data.workLocation.longitude ?? defaultRiyadhCoordinates.longitude,
    googleMapsUrl: data.workLocation.googleMapsUrl,
  })

  useEffect(() => {
    setLocationForm({
      name: data.workLocation.name,
      address: data.workLocation.address,
      radiusMeters: data.workLocation.radiusMeters,
      latitude: data.workLocation.latitude ?? defaultRiyadhCoordinates.latitude,
      longitude: data.workLocation.longitude ?? defaultRiyadhCoordinates.longitude,
      googleMapsUrl: data.workLocation.googleMapsUrl,
    })
  }, [data.workLocation])

  useEffect(() => {
    let currentSaudiDate = toSaudiDateInputValue(new Date())

    const interval = window.setInterval(() => {
      const nextSaudiDate = toSaudiDateInputValue(new Date())
      if (nextSaudiDate === currentSaudiDate) {
        return
      }

      currentSaudiDate = nextSaudiDate
      setFeedback(null)
      setPermissionForm(getInitialPermissionForm())
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

  function handlePermissionRequest() {
    runRequest(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_request",
          requestType: "permission",
          subject: permissionForm.subject.trim() || "استئذان",
          details: permissionForm.details,
          requestDate: permissionForm.requestDate,
          fromTime: permissionForm.fromTime,
          toTime: permissionForm.toTime,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر تسجيل الاستئذان")
      }

      setFeedback({ type: "success", text: "تم تسجيل الاستئذان بنجاح" })
      setPermissionForm(getInitialPermissionForm())
      setAdvancedPermissionOpen(false)
      await onRefresh()
    })
  }

  function handleQuickPermissionRequest() {
    const quickForm = getInitialPermissionForm()
    setPermissionForm(quickForm)

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
      setPermissionForm(getInitialPermissionForm())
      await onRefresh()
    })
  }

  function handleSaveLocation() {
    runRequest(async () => {
      const response = await fetch("/api/admin/administrative-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure_work_location",
          name: locationForm.name,
          address: locationForm.address,
          latitude: locationForm.latitude,
          longitude: locationForm.longitude,
          radiusMeters: locationForm.radiusMeters,
          googleMapsUrl:
            locationForm.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${locationForm.latitude},${locationForm.longitude}`,
        }),
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر حفظ موقع العمل")
      }

      setFeedback({ type: "success", text: "تم حفظ موقع العمل ونطاق الحضور" })
      await onRefresh()
    })
  }

  const todayRecord = data.todayAttendance
  const canClockIn = data.workLocation.isConfigured && !todayRecord?.clockInAt
  const canClockOut = data.workLocation.isConfigured && Boolean(todayRecord?.clockInAt) && !todayRecord?.clockOutAt
  const attendanceAction = canClockIn ? "clock_in" : canClockOut ? "clock_out" : null
  const attendanceButtonLabel = canClockIn ? "تسجيل حضور" : canClockOut ? "تسجيل انصراف" : "اكتمل تسجيل اليوم"
  const attendanceSummary = todayRecord?.clockOutAt
    ? `عدد ساعات عمل اليوم: ${formatWorkedHours(todayRecord.workedMinutes)}`
    : todayRecord?.clockInAt
      ? `تم تسجيل الحضور الساعة: ${formatTime(todayRecord.clockInAt)}`
      : "لم يتم تسجيل حضور اليوم بعد"

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
          <CardDescription>يعتمد التسجيل على موقعك الحالي، ويتحول زر الحضور تلقائيًا إلى زر انصراف عند تسجيل بداية الدوام.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 px-5 py-4 text-right">
            <p className="text-xs text-muted-foreground">ملخص اليوم</p>
            <p className="mt-2 text-lg font-bold text-foreground">{attendanceSummary}</p>
            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>{formatDate(toSaudiDateInputValue(new Date()))}</span>
              <span>•</span>
              <span>الحضور: {formatTime(todayRecord?.clockInAt ?? null)}</span>
              <span>•</span>
              <span>الانصراف: {formatTime(todayRecord?.clockOutAt ?? null)}</span>
            </div>
          </div>

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

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              className="rounded-xl"
              disabled={isPending || !attendanceAction}
              onClick={() => attendanceAction && handleClock(attendanceAction)}
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : attendanceAction === "clock_out" ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
              {attendanceButtonLabel}
            </Button>
            <Button type="button" variant="outline" className="rounded-xl" onClick={handleQuickPermissionRequest} disabled={isPending}>
              <BriefcaseBusiness className="h-4 w-4" />
              تسجيل استئذان
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            {data.isManager ? (
              <Button asChild variant="ghost" className="rounded-xl px-0 text-primary hover:text-primary">
                <Link href="/dashboard/preparation-history">سجل التحضير الكامل</Link>
              </Button>
            ) : <span />}
            <Button type="button" variant="ghost" className="rounded-xl px-0 text-muted-foreground hover:text-foreground" onClick={() => setAdvancedPermissionOpen((current) => !current)}>
              {advancedPermissionOpen ? "إخفاء النموذج التفصيلي" : "تحتاج استئذانًا بتفاصيل أكثر؟"}
            </Button>
          </div>

          {advancedPermissionOpen ? (
            <div className="grid gap-4 rounded-[1.5rem] border border-border/60 bg-muted/10 p-4 md:grid-cols-2">
              <div className="space-y-2 text-right md:col-span-2">
                <Label htmlFor="permission-subject">عنوان الاستئذان</Label>
                <Input id="permission-subject" value={permissionForm.subject} onChange={(event) => setPermissionForm((current) => ({ ...current, subject: event.target.value }))} />
              </div>
              <div className="space-y-2 text-right md:col-span-2">
                <Label htmlFor="permission-details">التفاصيل</Label>
                <Textarea id="permission-details" rows={3} value={permissionForm.details} onChange={(event) => setPermissionForm((current) => ({ ...current, details: event.target.value }))} />
              </div>
              <div className="space-y-2 text-right">
                <Label htmlFor="permission-date">تاريخ الاستئذان</Label>
                <Input id="permission-date" type="date" value={permissionForm.requestDate} onChange={(event) => setPermissionForm((current) => ({ ...current, requestDate: event.target.value }))} />
              </div>
              <div className="space-y-2 text-right">
                <Label htmlFor="permission-from-time">من الساعة</Label>
                <Input id="permission-from-time" type="time" value={permissionForm.fromTime} onChange={(event) => setPermissionForm((current) => ({ ...current, fromTime: event.target.value }))} />
              </div>
              <div className="space-y-2 text-right">
                <Label htmlFor="permission-to-time">إلى الساعة</Label>
                <Input id="permission-to-time" type="time" value={permissionForm.toTime} onChange={(event) => setPermissionForm((current) => ({ ...current, toTime: event.target.value }))} />
              </div>
              <div className="flex items-end justify-start">
                <Button type="button" className="rounded-xl" disabled={isPending} onClick={handlePermissionRequest}>
                  {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  إرسال الاستئذان
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
        <CardHeader>
          <CardTitle>السجل الأسبوعي</CardTitle>
          <CardDescription>يعرض الأسبوع الحالي فقط من الأحد إلى السبت حسب توقيت السعودية.</CardDescription>
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

      {data.isManager ? (
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardHeader>
            <CardTitle>إعداد موقع العمل</CardTitle>
            <CardDescription>مدير النظام فقط يمكنه تحديد الموقع عبر Google Maps وتعديل النطاق المسموح لتسجيل الحضور والانصراف.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-right">
                <Label htmlFor="work-location-name">اسم الموقع</Label>
                <Input id="work-location-name" value={locationForm.name} onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2 text-right">
                <Label htmlFor="work-location-address">العنوان</Label>
                <Input id="work-location-address" value={locationForm.address} onChange={(event) => setLocationForm((current) => ({ ...current, address: event.target.value }))} />
              </div>
            </div>

            <WorkLocationMapPicker
              value={{ latitude: locationForm.latitude, longitude: locationForm.longitude }}
              radiusMeters={locationForm.radiusMeters}
              onChange={(coordinates) => setLocationForm((current) => ({ ...current, ...coordinates }))}
            />

            <div className="space-y-3 rounded-[1.5rem] border border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-primary">{locationForm.radiusMeters} متر</span>
                <div className="text-right">
                  <p className="font-semibold text-foreground">نطاق الحضور المسموح</p>
                  <p className="text-xs text-muted-foreground">اسحب المؤشر لتعديل نصف القطر المسموح به للموظفين.</p>
                </div>
              </div>
              <Slider value={[locationForm.radiusMeters]} min={50} max={1000} step={10} onValueChange={([value]) => setLocationForm((current) => ({ ...current, radiusMeters: value }))} />
            </div>

            <div className="space-y-2 text-right">
              <Label htmlFor="work-location-google-url">رابط Google Maps</Label>
              <Input id="work-location-google-url" value={locationForm.googleMapsUrl} onChange={(event) => setLocationForm((current) => ({ ...current, googleMapsUrl: event.target.value }))} placeholder="https://www.google.com/maps/..." />
            </div>

            <div className="flex justify-start">
              <Button type="button" className="rounded-xl" onClick={handleSaveLocation} disabled={isPending}>
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                حفظ موقع العمل
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
