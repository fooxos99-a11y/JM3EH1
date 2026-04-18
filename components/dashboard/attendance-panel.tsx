"use client"

import { AlertCircle, CheckCircle2, Clock3, History, LoaderCircle, LogIn, LogOut, MapPin } from "lucide-react"
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
import {
  formatDate,
  formatDateTime,
  formatTime,
  formatWorkedHours,
  toSaudiDateInputValue,
  type AdministrativeDashboardData,
} from "@/lib/administrative-services"

type AttendancePanelProps = {
  data: AdministrativeDashboardData
  onRefresh: () => Promise<void>
}

type Coordinates = {
  latitude: number
  longitude: number
}

const defaultRiyadhCoordinates: Coordinates = {
  latitude: 24.7136,
  longitude: 46.6753,
}

export function AttendancePanel({ data, onRefresh }: AttendancePanelProps) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [filterDate, setFilterDate] = useState("")
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

  const filteredHistory = useMemo(() => {
    if (!filterDate) {
      return data.attendanceHistory
    }

    return data.attendanceHistory.filter((record) => record.workDate === filterDate)
  }, [data.attendanceHistory, filterDate])

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
  const todayStateLabel = !todayRecord
    ? "لم يتم تسجيل الحضور اليوم"
    : todayRecord.clockOutAt
      ? "اكتمل حضور اليوم"
      : "تم تسجيل الحضور وبانتظار الانصراف"
  const canClockIn = data.workLocation.isConfigured && !todayRecord?.clockInAt
  const canClockOut = data.workLocation.isConfigured && Boolean(todayRecord?.clockInAt) && !todayRecord?.clockOutAt

  return (
    <div className="space-y-4">
      {feedback ? (
        <Alert className={feedback.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{feedback.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardHeader>
            <CardTitle>تسجيل الحضور والانصراف</CardTitle>
            <CardDescription>يعتمد التسجيل على موقعك الحالي، ولا يتم القبول إلا داخل نطاق موقع العمل المحدد من المدير.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                <p className="text-xs text-muted-foreground">حالة اليوم</p>
                <p className="mt-2 font-semibold text-foreground">{todayStateLabel}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                <p className="text-xs text-muted-foreground">أول حضور اليوم</p>
                <p className="mt-2 font-semibold text-foreground">{formatTime(todayRecord?.clockInAt ?? null)}</p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                <p className="text-xs text-muted-foreground">آخر انصراف اليوم</p>
                <p className="mt-2 font-semibold text-foreground">{formatTime(todayRecord?.clockOutAt ?? null)}</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button type="button" className="rounded-xl" disabled={isPending || !canClockIn} onClick={() => handleClock("clock_in")}>
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                تسجيل الحضور
              </Button>
              <Button type="button" variant="outline" className="rounded-xl" disabled={isPending || !canClockOut} onClick={() => handleClock("clock_out")}>
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                تسجيل الانصراف
              </Button>
              <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setHistoryOpen((current) => !current)}>
                <History className="h-4 w-4" />
                عرض سجلات الحضور
              </Button>
            </div>

            {!data.workLocation.isConfigured ? (
              <Alert variant="destructive" className="rounded-[1.25rem] text-right">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>لم يتم تفعيل موقع العمل</AlertTitle>
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
          </CardContent>
        </Card>

        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardHeader>
            <CardTitle>السجل اليومي</CardTitle>
            <CardDescription>تفاصيل حضور اليوم الحالي حسب توقيت السعودية.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-right">
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <p className="text-xs text-muted-foreground">تاريخ اليوم</p>
              <p className="mt-2 font-semibold text-foreground">{formatDate(toSaudiDateInputValue(new Date()))}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">الحضور</p>
              <p className="mt-2 text-lg font-bold text-foreground">{formatDateTime(todayRecord?.clockInAt ?? null)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">الانصراف</p>
              <p className="mt-2 text-lg font-bold text-foreground">{formatDateTime(todayRecord?.clockOutAt ?? null)}</p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
              <p className="text-xs text-muted-foreground">صافي ساعات العمل</p>
              <p className="mt-2 text-lg font-bold text-primary">{formatWorkedHours(todayRecord?.workedMinutes ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
        <CardHeader>
          <CardTitle>السجل الأسبوعي</CardTitle>
          <CardDescription>يلخص أول حضور وآخر انصراف وصافي ساعات العمل خلال آخر 7 أيام.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">اليوم</TableHead>
                <TableHead className="text-right">أول حضور</TableHead>
                <TableHead className="text-right">آخر انصراف</TableHead>
                <TableHead className="text-right">عدد ساعات العمل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.weeklyAttendance.map((entry) => (
                <TableRow key={entry.workDate}>
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

      {historyOpen ? (
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardHeader>
            <CardTitle>سجلات الحضور الكاملة</CardTitle>
            <CardDescription>يمكنك اختيار تاريخ ميلادي معين لمعرفة هل كنت حاضرًا، ومتى سجلت الحضور والانصراف، وصافي ساعات العمل.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end justify-end gap-3">
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => setFilterDate("")}>إزالة الفلتر</Button>
              <div className="w-full max-w-xs space-y-2 text-right">
                <Label htmlFor="attendance-filter-date">تصفية حسب التاريخ الميلادي</Label>
                <Input id="attendance-filter-date" type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">الحضور</TableHead>
                  <TableHead className="text-right">الانصراف</TableHead>
                  <TableHead className="text-right">صافي ساعات العمل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد سجلات مطابقة.</TableCell>
                  </TableRow>
                ) : (
                  filteredHistory.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-right">{formatDate(record.workDate)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={record.clockOutAt ? "default" : "secondary"}>{record.clockOutAt ? "مكتمل" : "غير مكتمل"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatDateTime(record.clockInAt)}</TableCell>
                      <TableCell className="text-right">{formatDateTime(record.clockOutAt)}</TableCell>
                      <TableCell className="text-right font-medium text-foreground">{formatWorkedHours(record.workedMinutes)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

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
