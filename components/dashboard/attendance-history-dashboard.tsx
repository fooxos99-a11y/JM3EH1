"use client"

import { LoaderCircle } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatDate, formatTime, formatWorkedHours, type AttendanceRecord } from "@/lib/administrative-services"

type AttendanceHistoryPayload = {
  records: AttendanceRecord[]
  summary: {
    totalRecords: number
    presentToday: number
    incompleteToday: number
  }
}

export function AttendanceHistoryDashboard() {
  const [payload, setPayload] = useState<AttendanceHistoryPayload | null>(null)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!payload || !normalizedSearch) {
      return payload?.records ?? []
    }

    return payload.records.filter((record) => {
      const candidate = `${record.userName} ${record.workDate}`.toLowerCase()
      return candidate.includes(normalizedSearch)
    })
  }, [payload, search])

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم الموظف أو التاريخ" className="max-w-sm text-right" />
          <div className="text-right">
            <h2 className="text-xl font-bold text-foreground">سجل التحضير الكامل</h2>
            <p className="mt-1 text-sm text-muted-foreground">هذه الصفحة مستقلة ومخصصة لمدير النظام فقط.</p>
          </div>
        </div>
      </div>

      {error ? (
        <Alert className="rounded-[1.5rem] border-red-200 bg-red-50/80 text-right">
          <AlertTitle>تعذر تحميل البيانات</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {payload ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardHeader className="text-right"><CardTitle>{payload.summary.totalRecords}</CardTitle><CardDescription>إجمالي السجلات</CardDescription></CardHeader></Card>
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardHeader className="text-right"><CardTitle>{payload.summary.presentToday}</CardTitle><CardDescription>حضور اليوم</CardDescription></CardHeader></Card>
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardHeader className="text-right"><CardTitle>{payload.summary.incompleteToday}</CardTitle><CardDescription>سجلات اليوم غير المكتملة</CardDescription></CardHeader></Card>
        </div>
      ) : null}

      <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
        <CardHeader className="text-right">
          <CardTitle>كل السجلات</CardTitle>
          <CardDescription>يشمل جميع الموظفين الإداريين بترتيب الأحدث فالأقدم.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </section>
  )
}