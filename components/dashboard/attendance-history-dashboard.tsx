"use client"

import { AlertCircle, LoaderCircle, MapPin } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import { WorkLocationMapPicker } from "@/components/dashboard/work-location-map-picker"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatTime, formatWorkedHours, type AttendanceRecord, type WorkLocationSettings } from "@/lib/administrative-services"

const defaultRiyadhCoordinates = {
  latitude: 24.7136,
  longitude: 46.6753,
}

function buildGoogleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

function parseCoordinatesFromGoogleMapsUrl(url: string) {
  const normalizedUrl = url.trim()

  if (!normalizedUrl) {
    return null
  }

  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&]center=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  ]

  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern)
    if (!match) {
      continue
    }

    const latitude = Number.parseFloat(match[1])
    const longitude = Number.parseFloat(match[2])

    if (!Number.isNaN(latitude) && !Number.isNaN(longitude)) {
      return { latitude, longitude }
    }
  }

  return null
}

type AttendanceHistoryPayload = {
  workLocation: WorkLocationSettings
  records: AttendanceRecord[]
  summary: {
    totalRecords: number
    presentToday: number
    incompleteToday: number
  }
}

export function AttendanceHistoryDashboard({ canConfigureLocation }: { canConfigureLocation: boolean }) {
  const [payload, setPayload] = useState<AttendanceHistoryPayload | null>(null)
  const [selectedUserName, setSelectedUserName] = useState("all")
  const [selectedDate, setSelectedDate] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [locationForm, setLocationForm] = useState({
    name: "",
    address: "",
    radiusMeters: 100,
    latitude: defaultRiyadhCoordinates.latitude,
    longitude: defaultRiyadhCoordinates.longitude,
    googleMapsUrl: "",
  })

  useEffect(() => {
    let ignore = false

    async function loadHistory() {
      setIsLoading(true)
      setError(null)

      const response = await fetch("/api/admin/attendance-history", { cache: "no-store" })
      const nextPayload = (await response.json()) as AttendanceHistoryPayload & { error?: string }

      if (!response.ok) {
        if (!ignore) {
          setError(nextPayload.error ?? "تعذر تحميل السجل الكامل")
          setIsLoading(false)
        }
        return
      }

      if (!ignore) {
        setPayload(nextPayload)
        setIsLoading(false)
      }
    }

    void loadHistory()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!payload) {
      return
    }

    setLocationForm({
      name: payload.workLocation.name,
      address: payload.workLocation.address,
      radiusMeters: payload.workLocation.radiusMeters,
      latitude: payload.workLocation.latitude ?? defaultRiyadhCoordinates.latitude,
      longitude: payload.workLocation.longitude ?? defaultRiyadhCoordinates.longitude,
      googleMapsUrl: payload.workLocation.googleMapsUrl,
    })
  }, [payload])

  function reloadHistory() {
    setIsLoading(true)
    setError(null)

    return fetch("/api/admin/attendance-history", { cache: "no-store" })
      .then(async (response) => {
        const nextPayload = (await response.json()) as AttendanceHistoryPayload & { error?: string }

        if (!response.ok) {
          throw new Error(nextPayload.error ?? "تعذر تحميل السجل الكامل")
        }

        setPayload(nextPayload)
        setIsLoading(false)
      })
      .catch((nextError) => {
        setError(nextError instanceof Error ? nextError.message : "تعذر تحميل السجل الكامل")
        setIsLoading(false)
      })
  }

  function handleSaveLocation() {
    setFeedback(null)
    startTransition(async () => {
      try {
        const parsedCoordinates = parseCoordinatesFromGoogleMapsUrl(locationForm.googleMapsUrl)
        const latitude = parsedCoordinates?.latitude ?? locationForm.latitude
        const longitude = parsedCoordinates?.longitude ?? locationForm.longitude
        const name = locationForm.name.trim() || payload?.workLocation.name || "موقع العمل الرئيسي"
        const address = locationForm.address.trim() || (locationForm.googleMapsUrl.trim() ? "تم تحديد الموقع عبر الرابط" : "")

        const response = await fetch("/api/admin/administrative-requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "configure_work_location",
            name,
            address,
            latitude,
            longitude,
            radiusMeters: locationForm.radiusMeters,
            googleMapsUrl: locationForm.googleMapsUrl || buildGoogleMapsUrl(latitude, longitude),
          }),
        })

        const result = (await response.json()) as { error?: string }
        if (!response.ok) {
          throw new Error(result.error ?? "تعذر حفظ موقع العمل")
        }

        setFeedback({ type: "success", text: "تم حفظ موقع التحضير بنجاح" })
        await reloadHistory()
      } catch (nextError) {
        setFeedback({ type: "error", text: nextError instanceof Error ? nextError.message : "تعذر حفظ موقع العمل" })
      }
    })
  }

  const employeeOptions = useMemo(() => {
    if (!payload) {
      return []
    }

    return Array.from(new Set(payload.records.map((record) => record.userName))).sort((left, right) => left.localeCompare(right, "ar"))
  }, [payload])

  const filteredRecords = useMemo(() => {
    if (!payload) {
      return []
    }

    return payload.records.filter((record) => {
      const matchesUser = selectedUserName === "all" || record.userName === selectedUserName
      const matchesDate = !selectedDate || record.workDate === selectedDate
      return matchesUser && matchesDate
    })
  }, [payload, selectedDate, selectedUserName])

  function handleMapLocationChange(coordinates: { latitude: number; longitude: number }) {
    setLocationForm((current) => ({
      ...current,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      googleMapsUrl: buildGoogleMapsUrl(coordinates.latitude, coordinates.longitude),
    }))
  }

  function handleGoogleMapsUrlChange(nextUrl: string) {
    const parsedCoordinates = parseCoordinatesFromGoogleMapsUrl(nextUrl)

    setLocationForm((current) => ({
      ...current,
      googleMapsUrl: nextUrl,
      latitude: parsedCoordinates?.latitude ?? current.latitude,
      longitude: parsedCoordinates?.longitude ?? current.longitude,
    }))
  }

  return (
    <section className="space-y-6">
      {feedback ? (
        <Alert className={feedback.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          {feedback.type === "success" ? <MapPin className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <AlertTitle>{feedback.type === "success" ? "تم تنفيذ العملية" : "تعذر تنفيذ العملية"}</AlertTitle>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
          <AlertTitle>تعذر تحميل البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
          <div className="space-y-2 text-right">
            <Label>الموظف</Label>
            <Select value={selectedUserName} onValueChange={setSelectedUserName}>
              <SelectTrigger className="w-full text-right">
                <SelectValue placeholder="اختر الموظف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الموظفين</SelectItem>
                {employeeOptions.map((employeeName) => (
                  <SelectItem key={employeeName} value={employeeName}>{employeeName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 text-right">
            <Label htmlFor="attendance-history-date">التاريخ</Label>
            <DatePickerField id="attendance-history-date" value={selectedDate} onChange={setSelectedDate} className="text-right" placeholder="اختر التاريخ" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : (
            filteredRecords.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الموظف</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">الحضور</TableHead>
                    <TableHead className="text-right">الانصراف</TableHead>
                    <TableHead className="text-right">المدة</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-right font-medium">{record.userName}</TableCell>
                      <TableCell className="text-right">{formatDate(record.workDate)}</TableCell>
                      <TableCell className="text-right">{formatTime(record.clockInAt)}</TableCell>
                      <TableCell className="text-right">{formatTime(record.clockOutAt)}</TableCell>
                      <TableCell className="text-right">{formatWorkedHours(record.workedMinutes)}</TableCell>
                      <TableCell className="text-right">{record.status === "present" ? "مكتمل" : "غير مكتمل"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">لا توجد سجلات مطابقة للفلاتر المحددة.</div>
            )
          )}
        </CardContent>
      </Card>

      {canConfigureLocation ? (
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardHeader className="text-right">
            <CardTitle>موقع التحضير</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-right">
                <Label htmlFor="attendance-history-location-name">اسم الموقع</Label>
                <Input id="attendance-history-location-name" value={locationForm.name} onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))} />
              </div>
              <div className="space-y-2 text-right">
                <Label htmlFor="attendance-history-location-address">العنوان</Label>
                <Input id="attendance-history-location-address" value={locationForm.address} onChange={(event) => setLocationForm((current) => ({ ...current, address: event.target.value }))} />
              </div>
            </div>

            <WorkLocationMapPicker
              value={{ latitude: locationForm.latitude, longitude: locationForm.longitude }}
              radiusMeters={locationForm.radiusMeters}
              onChange={handleMapLocationChange}
            />

            <div className="space-y-3 rounded-[1.5rem] border border-border/60 bg-muted/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-right">
                  <p className="font-semibold text-foreground">نطاق الحضور المسموح</p>
                  <p className="text-xs text-muted-foreground">اسحب المؤشر لتعديل نصف القطر المسموح به لتسجيل الحضور.</p>
                </div>
                <span className="text-sm font-semibold text-primary">{locationForm.radiusMeters} متر</span>
              </div>
              <Slider value={[locationForm.radiusMeters]} min={50} max={1000} step={10} onValueChange={([value]) => setLocationForm((current) => ({ ...current, radiusMeters: value }))} />
            </div>

            <div className="space-y-2 text-right">
              <Label htmlFor="attendance-history-location-url">رابط Google Maps</Label>
              <Input id="attendance-history-location-url" value={locationForm.googleMapsUrl} onChange={(event) => handleGoogleMapsUrlChange(event.target.value)} placeholder="https://www.google.com/maps/..." />
            </div>

            <div className="flex justify-end">
              <Button type="button" className="rounded-xl" onClick={handleSaveLocation} disabled={isPending}>
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                حفظ موقع التحضير
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}