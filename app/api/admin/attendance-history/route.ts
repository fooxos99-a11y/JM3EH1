import { NextResponse } from "next/server"

import { toSaudiDateInputValue, type AttendanceRecord } from "@/lib/administrative-services"
import { getCurrentUser } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type AttendanceRow = {
  id: string
  user_id: string
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  clock_in_latitude: number | null
  clock_in_longitude: number | null
  clock_out_latitude: number | null
  clock_out_longitude: number | null
  notes: string | null
}

type UserRow = {
  id: string
  full_name: string
}

function getWorkedMinutes(clockInAt: string | null, clockOutAt: string | null) {
  if (!clockInAt || !clockOutAt) {
    return 0
  }

  const start = new Date(clockInAt).getTime()
  const end = new Date(clockOutAt).getTime()

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0
  }

  return Math.round((end - start) / (1000 * 60))
}

function mapAttendance(row: AttendanceRow, namesById: Map<string, string>): AttendanceRecord {
  return {
    id: row.id,
    userId: row.user_id,
    userName: namesById.get(row.user_id) ?? "-",
    workDate: row.work_date,
    clockInAt: row.clock_in_at,
    clockOutAt: row.clock_out_at,
    clockInLatitude: row.clock_in_latitude,
    clockInLongitude: row.clock_in_longitude,
    clockOutLatitude: row.clock_out_latitude,
    clockOutLongitude: row.clock_out_longitude,
    workedMinutes: getWorkedMinutes(row.clock_in_at, row.clock_out_at),
    status: row.clock_in_at && row.clock_out_at ? "present" : "incomplete",
    notes: row.notes,
  }
}

export async function GET() {
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  if (!user.permissions.includes("*")) {
    return NextResponse.json({ error: "فقط مدير النظام يمكنه عرض السجل الكامل" }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()
  const { data: users, error: usersError } = await supabase.from("app_users").select("id,full_name").eq("role", "admin")

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 400 })
  }

  const userRows = (users ?? []) as UserRow[]
  const userIds = userRows.map((entry) => entry.id)
  const namesById = new Map(userRows.map((entry) => [entry.id, entry.full_name]))

  const { data: records, error: recordsError } = await supabase
    .from("attendance_records")
    .select("id,user_id,work_date,clock_in_at,clock_out_at,clock_in_latitude,clock_in_longitude,clock_out_latitude,clock_out_longitude,notes")
    .in("user_id", userIds)
    .order("work_date", { ascending: false })
    .order("clock_in_at", { ascending: false })

  if (recordsError) {
    return NextResponse.json({ error: recordsError.message }, { status: 400 })
  }

  const attendanceHistory = ((records ?? []) as AttendanceRow[]).map((row) => mapAttendance(row, namesById))
  const todayKey = toSaudiDateInputValue(new Date())

  return NextResponse.json({
    records: attendanceHistory,
    summary: {
      totalRecords: attendanceHistory.length,
      presentToday: attendanceHistory.filter((record) => record.workDate === todayKey && record.clockInAt).length,
      incompleteToday: attendanceHistory.filter((record) => record.workDate === todayKey && record.status === "incomplete").length,
    },
  })
}