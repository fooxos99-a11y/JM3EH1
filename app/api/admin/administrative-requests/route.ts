import { NextResponse } from "next/server"
import { z } from "zod"

import {
  administrativeRequestStatusValues,
  administrativeRequestTypeValues,
  calculateLeaveDays,
  createEmptyLeaveBalance,
  createEmptyProfile,
  formatWorkedHours,
  getAccountTypeLabel,
  toSaudiDateInputValue,
  type AdministrativeAccountSummary,
  type AdministrativeDashboardData,
  type AdministrativeRequestRecord,
  type AttendanceRecord,
  type EmployeeProfile,
  type LeaveBalance,
  type WeeklyAttendanceSummary,
  type WorkLocationSettings,
  leaveAllocationTypeValues,
} from "@/lib/administrative-services"
import { getCurrentUser, hasPermission } from "@/lib/auth"
import { getSiteSectionContent } from "@/lib/site-content"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

const createRequestSchema = z
  .object({
    action: z.literal("create_request"),
    requestType: z.enum(administrativeRequestTypeValues),
    subject: z.string().trim().min(3),
    details: z.string().trim().min(5),
    amountRequested: z.number().nonnegative().nullable().optional(),
    startDate: z.string().trim().optional(),
    endDate: z.string().trim().optional(),
    requestDate: z.string().trim().optional(),
    fromTime: z.string().trim().optional(),
    toTime: z.string().trim().optional(),
    leaveAllocationType: z.enum(leaveAllocationTypeValues).optional(),
  })
  .superRefine((value, context) => {
    if (value.requestType === "leave") {
      if (!value.startDate || !value.endDate) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "يجب تحديد تاريخ بداية ونهاية الإجازة" })
      }

      if (!value.leaveAllocationType) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "يجب تحديد نوع الرصيد للإجازة" })
      }
    }

    if (value.requestType === "permission") {
      if (!value.requestDate || !value.fromTime || !value.toTime) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "يجب تحديد تاريخ الإذن ووقت البداية والنهاية" })
      }
    }

    if (value.requestType === "financial" && (value.amountRequested ?? 0) <= 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "يجب تحديد مبلغ صحيح للطلب المالي" })
    }
  })

const createAttendanceSchema = z.object({
  action: z.literal("clock_attendance"),
  eventType: z.enum(["clock_in", "clock_out"]),
  coordinates: coordinateSchema,
})

const postSchema = z.union([createRequestSchema, createAttendanceSchema])

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("cancel_request"),
    requestId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("review_request"),
    requestId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    rejectionReason: z.string().trim().optional(),
  }),
  z.object({
    action: z.literal("update_balance"),
    userId: z.string().uuid(),
    leaveQuotaDays: z.number().min(0),
    allowanceTotalDays: z.number().min(0),
    permissionQuotaCount: z.number().min(0),
  }),
  z.object({
    action: z.literal("configure_work_location"),
    name: z.string().trim(),
    address: z.string().trim(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(10).max(5000),
    googleMapsUrl: z.string().trim().url().or(z.literal("")),
  }),
])

type UserRow = {
  id: string
  full_name: string
  phone: string
  email: string | null
  role: string
  created_at: string
}

type ProfileRow = {
  user_id: string
  national_id: string
  birth_date: string
  gender: "male" | "female"
  marital_status: "single" | "married" | "divorced" | "widowed"
  job_rank: string
  created_by: string | null
}

type LeaveBalanceRow = {
  user_id: string
  leave_quota_days: number
  leave_taken_days: number
  allowance_total_days: number
  allowance_used_days: number
  permission_quota_count: number
  permission_used_count: number
}

type RequestRow = {
  id: string
  user_id: string
  request_type: (typeof administrativeRequestTypeValues)[number]
  status: (typeof administrativeRequestStatusValues)[number]
  subject: string
  details: string
  amount_requested: number | null
  start_date: string | null
  end_date: string | null
  request_date: string | null
  from_time: string | null
  to_time: string | null
  leave_allocation_type: (typeof leaveAllocationTypeValues)[number] | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
}

type WorkLocationRow = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radius_meters: number
  google_maps_url: string
  updated_at: string
  updated_by: string | null
}

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

function isSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false
  }

  return error.code === "42P01" || error.code === "42703" || error.code === "22P02"
}

function schemaResponse() {
  return NextResponse.json(
    { error: "يجب تطبيق آخر تحديث لملف قاعدة البيانات قبل استخدام الخدمات الإدارية" },
    { status: 503 },
  )
}

async function requireAdministrativeAccess(scope: "attendance" | "administrative" = "administrative") {
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    return { user: null, response: NextResponse.json({ error: "غير مصرح" }, { status: 401 }) }
  }

  const hasAttendanceAccess = hasPermission(user, "administrative_requests") || hasPermission(user, "preparation")

  if (scope === "attendance" && !hasAttendanceAccess) {
    return { user, response: NextResponse.json({ error: "ليس لديك صلاحية للوصول إلى قسم التحضير" }, { status: 403 }) }
  }

  if (scope === "administrative" && !hasPermission(user, "administrative_requests")) {
    return { user, response: NextResponse.json({ error: "ليس لديك صلاحية للوصول إلى الطلبات الإدارية" }, { status: 403 }) }
  }

  return { user, response: null }
}

async function safeSelect<T>(operation: () => Promise<{ data: T[] | null; error: { code?: string; message?: string } | null }>) {
  const { data, error } = await operation()

  if (error) {
    if (isSchemaMissing(error)) {
      return [] as T[]
    }

    throw new Error(error.message)
  }

  return data ?? []
}

async function safeMaybeSingle<T>(operation: () => Promise<{ data: T | null; error: { code?: string; message?: string } | null }>) {
  const { data, error } = await operation()

  if (error) {
    if (isSchemaMissing(error)) {
      return null
    }

    throw new Error(error.message)
  }

  return data
}

function mapProfile(row: ProfileRow | undefined, userId: string): EmployeeProfile {
  if (!row) {
    return createEmptyProfile(userId)
  }

  return {
    userId: row.user_id,
    nationalId: row.national_id,
    birthDate: row.birth_date,
    gender: row.gender,
    maritalStatus: row.marital_status,
    jobRank: row.job_rank,
    createdBy: row.created_by,
  }
}

function mapLeaveBalance(row: LeaveBalanceRow | undefined, userId: string): LeaveBalance {
  if (!row) {
    return createEmptyLeaveBalance(userId)
  }

  return {
    userId: row.user_id,
    leaveQuotaDays: row.leave_quota_days,
    leaveTakenDays: row.leave_taken_days,
    allowanceTotalDays: row.allowance_total_days,
    allowanceUsedDays: row.allowance_used_days,
    permissionQuotaCount: row.permission_quota_count,
    permissionUsedCount: row.permission_used_count,
  }
}

function mapRequest(row: RequestRow, namesById: Map<string, string>, currentUserId: string, isManager: boolean): AdministrativeRequestRecord {
  return {
    id: row.id,
    requesterId: row.user_id,
    requesterName: namesById.get(row.user_id) ?? "-",
    requestType: row.request_type,
    status: row.status,
    subject: row.subject,
    details: row.details,
    amountRequested: row.amount_requested,
    startDate: row.start_date,
    endDate: row.end_date,
    requestDate: row.request_date,
    fromTime: row.from_time,
    toTime: row.to_time,
    leaveAllocationType: row.leave_allocation_type,
    reviewedBy: row.reviewed_by,
    reviewerName: row.reviewed_by ? namesById.get(row.reviewed_by) ?? null : null,
    reviewedAt: row.reviewed_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    canCancel: row.user_id === currentUserId && row.status === "pending",
    canReview: isManager && row.status === "pending",
  }
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
  const workedMinutes = getWorkedMinutes(row.clock_in_at, row.clock_out_at)

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
    workedMinutes,
    status: row.clock_in_at && row.clock_out_at ? "present" : "incomplete",
    notes: row.notes,
  }
}

function createEmptyWorkLocation(): WorkLocationSettings {
  return {
    id: null,
    name: "موقع العمل الرئيسي",
    address: "",
    latitude: null,
    longitude: null,
    radiusMeters: 100,
    googleMapsUrl: "",
    updatedAt: null,
    updatedByName: null,
    isConfigured: false,
  }
}

function mapWorkLocation(row: WorkLocationRow | null, namesById: Map<string, string>): WorkLocationSettings {
  if (!row) {
    return createEmptyWorkLocation()
  }

  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radius_meters,
    googleMapsUrl: row.google_maps_url,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by ? namesById.get(row.updated_by) ?? null : null,
    isConfigured: true,
  }
}

function getSaudiDateKey(date = new Date()) {
  return toSaudiDateInputValue(date)
}

function getWeekDateKeys() {
  const todayKey = getSaudiDateKey()
  const todayDate = new Date(`${todayKey}T00:00:00Z`)
  const currentWeekday = todayDate.getUTCDay()
  const startOfWeek = new Date(todayDate)
  startOfWeek.setUTCDate(todayDate.getUTCDate() - currentWeekday)

  return Array.from({ length: 7 }, (_, index) => {
    const nextDate = new Date(startOfWeek)
    nextDate.setUTCDate(startOfWeek.getUTCDate() + index)
    return getSaudiDateKey(nextDate)
  })
}

function buildWeeklyAttendance(records: AttendanceRecord[]): WeeklyAttendanceSummary[] {
  const byDate = new Map(records.map((record) => [record.workDate, record]))

  return getWeekDateKeys().map((workDate) => {
    const record = byDate.get(workDate)

    return {
      workDate,
      firstClockInAt: record?.clockInAt ?? null,
      lastClockOutAt: record?.clockOutAt ?? null,
      workedMinutes: record?.workedMinutes ?? 0,
    }
  })
}

function toRadians(value: number) {
  return (value * Math.PI) / 180
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadius = 6371000
  const latDelta = toRadians(lat2 - lat1)
  const lonDelta = toRadians(lon2 - lon1)
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(lonDelta / 2) * Math.sin(lonDelta / 2)

  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function getLatestWorkLocation() {
  const supabase = createSupabaseAdminClient()
  return safeMaybeSingle<WorkLocationRow>(() =>
    supabase
      .from("work_location_settings")
      .select("id,name,address,latitude,longitude,radius_meters,google_maps_url,updated_at,updated_by")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  )
}

async function buildDashboardData(userId: string, isManager: boolean, currentUserName: string, currentUserTitle: string): Promise<AdministrativeDashboardData> {
  const supabase = createSupabaseAdminClient()
  const permissionsContent = await getSiteSectionContent("permissions")

  const { data: users, error: usersError } = await supabase
    .from("app_users")
    .select("id,full_name,phone,email,role,created_at")
    .eq("role", "admin")
    .order("created_at", { ascending: true })

  if (usersError) {
    throw new Error(usersError.message)
  }

  const userRows = (users ?? []) as UserRow[]
  const profiles = await safeSelect<ProfileRow>(() =>
    supabase.from("employee_profiles").select("user_id,national_id,birth_date,gender,marital_status,job_rank,created_by"),
  )
  const leaveBalances = await safeSelect<LeaveBalanceRow>(() =>
    supabase
      .from("employee_leave_balances")
      .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count"),
  )
  const requestRows = await safeSelect<RequestRow>(() =>
    supabase
      .from("administrative_requests")
      .select("id,user_id,request_type,status,subject,details,amount_requested,start_date,end_date,request_date,from_time,to_time,leave_allocation_type,reviewed_by,reviewed_at,rejection_reason,created_at")
      .order("created_at", { ascending: false }),
  )
  const attendanceRows = await safeSelect<AttendanceRow>(() =>
    supabase
      .from("attendance_records")
      .select("id,user_id,work_date,clock_in_at,clock_out_at,clock_in_latitude,clock_in_longitude,clock_out_latitude,clock_out_longitude,notes")
      .eq("user_id", userId)
      .order("work_date", { ascending: false }),
  )
  const workLocationRow = await getLatestWorkLocation()

  const titleById = new Map(permissionsContent.accounts.map((account) => [account.userId, account.title]))
  const namesById = new Map(userRows.map((entry) => [entry.id, entry.full_name]))
  const profilesById = new Map(profiles.map((profile) => [profile.user_id, profile]))
  const leaveBalancesById = new Map(leaveBalances.map((balance) => [balance.user_id, balance]))

  const currentProfile = mapProfile(profilesById.get(userId), userId)
  const currentLeaveBalance = mapLeaveBalance(leaveBalancesById.get(userId), userId)
  const currentUserRow = userRows.find((entry) => entry.id === userId)

  const accounts: AdministrativeAccountSummary[] = userRows.map((entry) => {
    const profile = mapProfile(profilesById.get(entry.id), entry.id)
    const leaveBalance = mapLeaveBalance(leaveBalancesById.get(entry.id), entry.id)

    return {
      userId: entry.id,
      name: entry.full_name,
      phone: entry.phone,
      email: entry.email,
      accountType: getAccountTypeLabel(entry.role),
      jobTitle: titleById.get(entry.id) ?? "مدير النظام",
      profile,
      leaveBalance,
      createdAt: entry.created_at,
      createdByName: profile.createdBy ? namesById.get(profile.createdBy) ?? null : null,
    }
  })

  const myRequests = requestRows
    .filter((request) => request.user_id === userId)
    .map((request) => mapRequest(request, namesById, userId, isManager))

  const reviewableRequests = isManager
    ? requestRows.map((request) => mapRequest(request, namesById, userId, isManager))
    : []

  const attendanceHistory = attendanceRows.map((row) => mapAttendance(row, namesById))
  const todayAttendance = attendanceHistory.find((record) => record.workDate === getSaudiDateKey()) ?? null

  return {
    currentUserId: userId,
    currentUserName,
    currentUserTitle,
    isManager,
    profile: currentProfile,
    leaveBalance: currentLeaveBalance,
    employmentRecord: {
      createdAt: currentUserRow?.created_at ?? null,
      accountType: currentUserRow ? getAccountTypeLabel(currentUserRow.role) : "حساب إداري",
      createdByName: currentProfile.createdBy ? namesById.get(currentProfile.createdBy) ?? null : null,
      jobTitle: currentUserTitle,
      jobRank: currentProfile.jobRank,
    },
    workLocation: mapWorkLocation(workLocationRow, namesById),
    todayAttendance,
    weeklyAttendance: buildWeeklyAttendance(attendanceHistory),
    attendanceHistory,
    myRequests,
    reviewableRequests,
    accounts,
  }
}

async function insertAdministrativeRequest(userId: string, payload: z.infer<typeof createRequestSchema>) {
  const supabase = createSupabaseAdminClient()

  const { error } = await supabase.from("administrative_requests").insert({
    user_id: userId,
    request_type: payload.requestType,
    status: "pending",
    subject: payload.subject,
    details: payload.details,
    amount_requested: payload.amountRequested ?? null,
    start_date: payload.startDate || null,
    end_date: payload.endDate || null,
    request_date: payload.requestDate || null,
    from_time: payload.fromTime || null,
    to_time: payload.toTime || null,
    leave_allocation_type: payload.leaveAllocationType ?? null,
  })

  return error
}

async function handleClockAttendance(userId: string, eventType: "clock_in" | "clock_out", coordinates: { latitude: number; longitude: number }) {
  const supabase = createSupabaseAdminClient()
  const workLocation = await getLatestWorkLocation()

  if (!workLocation) {
    return NextResponse.json({ error: "لم يتم تحديد موقع العمل بعد من قبل المدير" }, { status: 400 })
  }

  const distance = calculateDistanceMeters(
    coordinates.latitude,
    coordinates.longitude,
    workLocation.latitude,
    workLocation.longitude,
  )

  if (distance > workLocation.radius_meters) {
    return NextResponse.json({ error: "لا يمكنك تسجيل الحضور خارج نطاق موقع العمل" }, { status: 400 })
  }

  const workDate = getSaudiDateKey()
  const now = new Date().toISOString()

  const existing = await safeMaybeSingle<AttendanceRow>(() =>
    supabase
      .from("attendance_records")
      .select("id,user_id,work_date,clock_in_at,clock_out_at,clock_in_latitude,clock_in_longitude,clock_out_latitude,clock_out_longitude,notes")
      .eq("user_id", userId)
      .eq("work_date", workDate)
      .maybeSingle(),
  )

  if (eventType === "clock_in") {
    if (existing?.clock_in_at) {
      return NextResponse.json({ error: "تم تسجيل الحضور لهذا اليوم مسبقًا" }, { status: 400 })
    }

    const { error } = await supabase.from("attendance_records").upsert(
      {
        user_id: userId,
        work_date: workDate,
        clock_in_at: now,
        clock_in_latitude: coordinates.latitude,
        clock_in_longitude: coordinates.longitude,
      },
      { onConflict: "user_id,work_date" },
    )

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  if (!existing?.clock_in_at) {
    return NextResponse.json({ error: "يجب تسجيل الحضور أولًا قبل تسجيل الانصراف" }, { status: 400 })
  }

  if (existing.clock_out_at) {
    return NextResponse.json({ error: "تم تسجيل الانصراف لهذا اليوم مسبقًا" }, { status: 400 })
  }

  const { error } = await supabase
    .from("attendance_records")
    .update({
      clock_out_at: now,
      clock_out_latitude: coordinates.latitude,
      clock_out_longitude: coordinates.longitude,
    })
    .eq("id", existing.id)

  if (error) {
    if (isSchemaMissing(error)) {
      return schemaResponse()
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const { user, response } = await requireAdministrativeAccess("attendance")
  if (response || !user) return response

  try {
    const payload = await buildDashboardData(user.id, user.permissions.includes("*"), user.name, user.title ?? "مدير النظام")
    return NextResponse.json(payload)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل البيانات" }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireAdministrativeAccess("attendance")
  if (response || !user) return response

  const body = await request.json()
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "البيانات غير صحيحة" }, { status: 400 })
  }

  if (parsed.data.action === "clock_attendance") {
    return handleClockAttendance(user.id, parsed.data.eventType, parsed.data.coordinates)
  }

  const error = await insertAdministrativeRequest(user.id, parsed.data)

  if (error) {
    if (isSchemaMissing(error)) {
      return schemaResponse()
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const { user, response } = await requireAdministrativeAccess("attendance")
  if (response || !user) return response

  const body = await request.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  if (parsed.data.action === "configure_work_location") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه تحديد موقع العمل" }, { status: 403 })
    }

    const currentRow = await getLatestWorkLocation()
    const normalizedName = parsed.data.name || currentRow?.name || "موقع العمل الرئيسي"
    const payload = {
      name: normalizedName,
      address: parsed.data.address,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      radius_meters: parsed.data.radiusMeters,
      google_maps_url: parsed.data.googleMapsUrl,
      updated_by: user.id,
    }

    const { error } = currentRow
      ? await supabase.from("work_location_settings").update(payload).eq("id", currentRow.id)
      : await supabase.from("work_location_settings").insert(payload)

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "cancel_request") {
    const { data: requestRow, error: requestError } = await supabase
      .from("administrative_requests")
      .select("id,user_id,status")
      .eq("id", parsed.data.requestId)
      .maybeSingle<{ id: string; user_id: string; status: string }>()

    if (requestError) {
      if (isSchemaMissing(requestError)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: requestError.message }, { status: 400 })
    }

    if (!requestRow || requestRow.user_id !== user.id || requestRow.status !== "pending") {
      return NextResponse.json({ error: "لا يمكن إلغاء هذا الطلب" }, { status: 400 })
    }

    const { error } = await supabase
      .from("administrative_requests")
      .update({ status: "cancelled", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
      .eq("id", parsed.data.requestId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "update_balance") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه تحديث الأرصدة" }, { status: 403 })
    }

    const existingRows = await safeSelect<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count")
        .eq("user_id", parsed.data.userId),
    )
    const currentBalance = mapLeaveBalance(existingRows[0], parsed.data.userId)

    const { error } = await supabase.from("employee_leave_balances").upsert(
      {
        user_id: parsed.data.userId,
        leave_quota_days: parsed.data.leaveQuotaDays,
        leave_taken_days: currentBalance.leaveTakenDays,
        allowance_total_days: parsed.data.allowanceTotalDays,
        allowance_used_days: currentBalance.allowanceUsedDays,
        permission_quota_count: parsed.data.permissionQuotaCount,
        permission_used_count: currentBalance.permissionUsedCount,
        updated_by: user.id,
      },
      { onConflict: "user_id" },
    )

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  if (!user.permissions.includes("*")) {
    return NextResponse.json({ error: "فقط مدير النظام يمكنه اعتماد الطلبات" }, { status: 403 })
  }

  const { data: row, error: rowError } = await supabase
    .from("administrative_requests")
    .select("id,user_id,request_type,status,start_date,end_date,leave_allocation_type")
    .eq("id", parsed.data.requestId)
    .maybeSingle<{
      id: string
      user_id: string
      request_type: "leave" | "permission" | "financial" | "general"
      status: "pending" | "approved" | "rejected" | "cancelled"
      start_date: string | null
      end_date: string | null
      leave_allocation_type: "leave_balance" | "allowance" | null
    }>()

  if (rowError) {
    if (isSchemaMissing(rowError)) {
      return schemaResponse()
    }

    return NextResponse.json({ error: rowError.message }, { status: 400 })
  }

  if (!row || row.status !== "pending") {
    return NextResponse.json({ error: "هذا الطلب لا يقبل المراجعة الآن" }, { status: 400 })
  }

  if (parsed.data.decision === "approved") {
    const existingRows = await safeSelect<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count")
        .eq("user_id", row.user_id),
    )
    const balance = mapLeaveBalance(existingRows[0], row.user_id)

    if (row.request_type === "leave") {
      const requestedDays = row.start_date && row.end_date ? calculateLeaveDays(row.start_date, row.end_date) : 0
      if (requestedDays <= 0) {
        return NextResponse.json({ error: "تواريخ الإجازة غير صحيحة" }, { status: 400 })
      }

      if (row.leave_allocation_type === "allowance") {
        const remainingAllowance = balance.allowanceTotalDays - balance.allowanceUsedDays
        if (remainingAllowance < requestedDays) {
          return NextResponse.json({ error: "الرصيد المتبقي من أيام السماحية لا يكفي لاعتماد الطلب" }, { status: 400 })
        }

        const { error } = await supabase.from("employee_leave_balances").upsert(
          {
            user_id: row.user_id,
            leave_quota_days: balance.leaveQuotaDays,
            leave_taken_days: balance.leaveTakenDays,
            allowance_total_days: balance.allowanceTotalDays,
            allowance_used_days: balance.allowanceUsedDays + requestedDays,
            permission_quota_count: balance.permissionQuotaCount,
            permission_used_count: balance.permissionUsedCount,
            updated_by: user.id,
          },
          { onConflict: "user_id" },
        )

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
      } else {
        const remainingLeave = balance.leaveQuotaDays - balance.leaveTakenDays
        if (remainingLeave < requestedDays) {
          return NextResponse.json({ error: "رصيد الإجازات المتبقي لا يكفي لاعتماد الطلب" }, { status: 400 })
        }

        const { error } = await supabase.from("employee_leave_balances").upsert(
          {
            user_id: row.user_id,
            leave_quota_days: balance.leaveQuotaDays,
            leave_taken_days: balance.leaveTakenDays + requestedDays,
            allowance_total_days: balance.allowanceTotalDays,
            allowance_used_days: balance.allowanceUsedDays,
            permission_quota_count: balance.permissionQuotaCount,
            permission_used_count: balance.permissionUsedCount,
            updated_by: user.id,
          },
          { onConflict: "user_id" },
        )

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 })
        }
      }
    }

    if (row.request_type === "permission") {
      const remainingPermissions = balance.permissionQuotaCount - balance.permissionUsedCount
      if (remainingPermissions < 1) {
        return NextResponse.json({ error: "رصيد الأذونات المتبقي لا يكفي لاعتماد الطلب" }, { status: 400 })
      }

      const { error } = await supabase.from("employee_leave_balances").upsert(
        {
          user_id: row.user_id,
          leave_quota_days: balance.leaveQuotaDays,
          leave_taken_days: balance.leaveTakenDays,
          allowance_total_days: balance.allowanceTotalDays,
          allowance_used_days: balance.allowanceUsedDays,
          permission_quota_count: balance.permissionQuotaCount,
          permission_used_count: balance.permissionUsedCount + 1,
          updated_by: user.id,
        },
        { onConflict: "user_id" },
      )

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }
  }

  const { error } = await supabase
    .from("administrative_requests")
    .update({
      status: parsed.data.decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: parsed.data.decision === "rejected" ? parsed.data.rejectionReason || null : null,
    })
    .eq("id", parsed.data.requestId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
