import { NextResponse } from "next/server"
import { z } from "zod"

import {
  SAUDI_TIME_ZONE,
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
  type AttendanceDaySummary,
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
  accuracy: z.number().finite().nonnegative().optional(),
})

const DEFAULT_WORK_START_MINUTES = 8 * 60
const DEFAULT_WORK_START_TIME = "08:00"
const STAFF_REQUESTS_SECTION_KEY = "staff_requests"

const locationIntegritySchema = z.object({
  permissionState: z.enum(["granted", "prompt", "denied", "unknown"]).optional(),
  isSecureContext: z.boolean().optional(),
  isMocked: z.boolean().optional(),
  reasons: z.array(z.string().trim().min(1)).max(8).optional(),
  userAgent: z.string().trim().max(300).optional(),
  sampledAt: z.string().datetime().optional(),
  sampleCount: z.number().int().min(1).max(10).optional(),
})

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

async function resolveCoordinatesFromGoogleMapsUrl(url: string) {
  const directCoordinates = parseCoordinatesFromGoogleMapsUrl(url)

  if (directCoordinates) {
    return directCoordinates
  }

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      cache: "no-store",
    })

    return parseCoordinatesFromGoogleMapsUrl(response.url)
  } catch {
    return null
  }
}

function buildGoogleMapsUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
}

function isValidDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseTimeInputToMinutes(value: string | undefined) {
  if (!value) {
    return null
  }

  const match = value.match(/^(\d{2}):(\d{2})$/)
  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

const createRequestSchema = z
  .object({
    action: z.literal("create_request"),
    requestType: z.enum(administrativeRequestTypeValues),
    targetUserId: z.string().uuid("الموظف المحدد غير صالح").optional(),
    subject: z.string().trim().min(1),
    details: z.string().trim().min(1),
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
      } else {
        if (!isValidDateInput(value.startDate) || !isValidDateInput(value.endDate)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "تواريخ الإجازة غير صالحة" })
        } else if (value.endDate < value.startDate) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "تاريخ نهاية الإجازة يجب أن يكون بعد أو مساويًا لتاريخ البداية" })
        }
      }
    }

    if (value.requestType === "permission") {
      if (!value.requestDate || !value.fromTime || !value.toTime) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "يجب تحديد تاريخ الإذن ووقت البداية والنهاية" })
      } else {
        const fromMinutes = parseTimeInputToMinutes(value.fromTime)
        const toMinutes = parseTimeInputToMinutes(value.toTime)

        if (!isValidDateInput(value.requestDate)) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "تاريخ الإذن غير صالح" })
        }

        if (fromMinutes === null || toMinutes === null) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "وقت الإذن غير صالح" })
        } else if (toMinutes <= fromMinutes) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: "وقت نهاية الإذن يجب أن يكون بعد وقت البداية" })
        }
      }
    }

    if (value.requestType === "financial" && (value.amountRequested ?? 0) <= 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "يجب تحديد مبلغ صحيح للطلب المالي" })
    }

    if (value.requestType === "internal_transaction" && !value.targetUserId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "يجب اختيار الموظف المستلم" })
    }
  })

const createAttendanceSchema = z.object({
  action: z.literal("clock_attendance"),
  eventType: z.enum(["clock_in", "clock_out"]),
  coordinates: coordinateSchema,
  integrity: locationIntegritySchema.optional(),
})

const postSchema = z.union([createRequestSchema, createAttendanceSchema])

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark_review_requests_seen"),
  }),
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
    userId: z.union([z.string().uuid(), z.literal("all_accounts")]),
    leaveQuotaDays: z.number().min(0),
    lateQuotaMinutes: z.number().min(0),
    permissionQuotaMinutes: z.number().min(0),
    workStartTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت بداية الدوام غير صالح"),
  }),
  z.object({
    action: z.literal("configure_work_location"),
    name: z.string().trim(),
    address: z.string().trim(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusMeters: z.number().int().min(10).max(5000),
    googleMapsUrl: z.string().trim().url().or(z.literal("")),
    workStartTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت بداية الدوام غير صالح").optional(),
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
  work_start_time: string
}

type RequestRow = {
  id: string
  user_id: string
  request_type: (typeof administrativeRequestTypeValues)[number]
  target_user_id: string | null
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
  work_start_time: string
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

type DashboardSectionViewRow = {
  user_id: string
  section_key: string
  last_seen_at: string
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

  if (scope === "attendance") {
    return { user, response: null }
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
    lateQuotaMinutes: row.allowance_total_days,
    lateUsedMinutes: row.allowance_used_days,
    permissionQuotaMinutes: row.permission_quota_count,
    permissionUsedMinutes: row.permission_used_count,
    workStartTime: row.work_start_time || DEFAULT_WORK_START_TIME,
  }
}

function parseTimeToMinutes(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

function getRequestedPermissionMinutes(fromTime: string | null | undefined, toTime: string | null | undefined) {
  const fromMinutes = parseTimeToMinutes(fromTime)
  const toMinutes = parseTimeToMinutes(toTime)

  if (fromMinutes === null || toMinutes === null || toMinutes <= fromMinutes) {
    return 0
  }

  return toMinutes - fromMinutes
}

function getSaudiClockMinutes(dateValue: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: SAUDI_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(new Date(dateValue))
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")

  return hour * 60 + minute
}

function mapRequest(row: RequestRow, namesById: Map<string, string>, currentUserId: string, isManager: boolean): AdministrativeRequestRecord {
  return {
    id: row.id,
    requesterId: row.user_id,
    requesterName: namesById.get(row.user_id) ?? "-",
    targetUserId: row.target_user_id,
    targetUserName: row.target_user_id ? namesById.get(row.target_user_id) ?? null : null,
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

function buildAttendanceDaySummary(records: AttendanceRecord[]): AttendanceDaySummary | null {
  if (records.length === 0) {
    return null
  }

  let firstClockInAt: string | null = null
  let lastClockOutAt: string | null = null
  let workedMinutes = 0
  let hasOpenSession = false

  for (const record of records) {
    if (record.clockInAt && (!firstClockInAt || record.clockInAt < firstClockInAt)) {
      firstClockInAt = record.clockInAt
    }

    if (record.clockOutAt && (!lastClockOutAt || record.clockOutAt > lastClockOutAt)) {
      lastClockOutAt = record.clockOutAt
    }

    workedMinutes += record.workedMinutes
    hasOpenSession ||= Boolean(record.clockInAt) && !record.clockOutAt
  }

  return {
    workDate: records[0].workDate,
    clockInAt: firstClockInAt,
    clockOutAt: lastClockOutAt,
    workedMinutes,
    status: hasOpenSession ? "incomplete" : "present",
    hasOpenSession,
    sessionCount: records.length,
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
    workStartTime: DEFAULT_WORK_START_TIME,
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
    workStartTime: row.work_start_time || DEFAULT_WORK_START_TIME,
    updatedAt: row.updated_at,
    updatedByName: row.updated_by ? namesById.get(row.updated_by) ?? null : null,
    isConfigured: true,
  }
}

function getSaudiDateKey(date = new Date()) {
  return toSaudiDateInputValue(date)
}

function getSaudiEndOfDayIso(date = new Date()) {
  const dateKey = getSaudiDateKey(date)
  return new Date(`${dateKey}T23:59:00+03:00`).toISOString()
}

function countUnreadReviewRequests(requestRows: RequestRow[], currentUserId: string, lastSeenAt: string | null) {
  return requestRows.filter((request) => {
    if (request.request_type === "internal_transaction") {
      return false
    }

    if (request.status !== "pending") {
      return false
    }

    return !lastSeenAt || request.created_at > lastSeenAt
  }).length
}

async function getSectionLastSeen(userId: string, sectionKey: string) {
  const supabase = createSupabaseAdminClient()
  const row = await safeMaybeSingle<DashboardSectionViewRow>(() =>
    supabase
      .from("dashboard_section_views")
      .select("user_id,section_key,last_seen_at")
      .eq("user_id", userId)
      .eq("section_key", sectionKey)
      .maybeSingle(),
  )

  return row?.last_seen_at ?? null
}

async function markSectionSeen(userId: string, sectionKey: string) {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from("dashboard_section_views")
    .upsert(
      {
        user_id: userId,
        section_key: sectionKey,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "user_id,section_key" },
    )

  return error
}

async function loadAdministrativeSidebarCounts(userId: string, isManager: boolean) {
  if (!isManager) {
    return { unreadReviewRequestsCount: 0 }
  }

  const supabase = createSupabaseAdminClient()
  const [requestRows, lastSeenAt] = await Promise.all([
    safeSelect<RequestRow>(() =>
      supabase
        .from("administrative_requests")
        .select("id,user_id,request_type,target_user_id,status,subject,details,amount_requested,start_date,end_date,request_date,from_time,to_time,leave_allocation_type,reviewed_by,reviewed_at,rejection_reason,created_at")
        .neq("request_type", "internal_transaction")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ),
    getSectionLastSeen(userId, STAFF_REQUESTS_SECTION_KEY),
  ])

  return {
    unreadReviewRequestsCount: countUnreadReviewRequests(requestRows, userId, lastSeenAt),
  }
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
  const byDate = new Map<string, AttendanceRecord[]>()

  for (const record of records) {
    const existing = byDate.get(record.workDate)

    if (existing) {
      existing.push(record)
      continue
    }

    byDate.set(record.workDate, [record])
  }

  return getWeekDateKeys().map((workDate) => {
    const record = buildAttendanceDaySummary(byDate.get(workDate) ?? [])

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
      .select("id,name,address,latitude,longitude,radius_meters,google_maps_url,work_start_time,updated_at,updated_by")
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
    .order("created_at", { ascending: true })

  if (usersError) {
    throw new Error(usersError.message)
  }

  const userRows = (users ?? []) as UserRow[]
  const adminUserRows = userRows.filter((entry) => entry.role === "admin")
  const profiles = await safeSelect<ProfileRow>(() =>
    supabase.from("employee_profiles").select("user_id,national_id,birth_date,gender,marital_status,job_rank,created_by"),
  )
  const leaveBalances = await safeSelect<LeaveBalanceRow>(() =>
    supabase
      .from("employee_leave_balances")
      .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,work_start_time"),
  )
  const requestRows = await safeSelect<RequestRow>(() =>
    supabase
      .from("administrative_requests")
      .select("id,user_id,request_type,target_user_id,status,subject,details,amount_requested,start_date,end_date,request_date,from_time,to_time,leave_allocation_type,reviewed_by,reviewed_at,rejection_reason,created_at")
      .order("created_at", { ascending: false }),
  )
  const attendanceRows = await safeSelect<AttendanceRow>(async () => {
    const query = supabase
      .from("attendance_records")
      .select("id,user_id,work_date,clock_in_at,clock_out_at,clock_in_latitude,clock_in_longitude,clock_out_latitude,clock_out_longitude,notes")

    return await (isManager ? query : query.eq("user_id", userId)).order("work_date", { ascending: false })
  })
  const workLocationRow = await getLatestWorkLocation()
  const lastSeenAt = isManager ? await getSectionLastSeen(userId, STAFF_REQUESTS_SECTION_KEY) : null

  const titleById = new Map(permissionsContent.accounts.map((account) => [account.userId, account.title]))
  const namesById = new Map(userRows.map((entry) => [entry.id, entry.full_name]))
  const profilesById = new Map(profiles.map((profile) => [profile.user_id, profile]))
  const leaveBalancesById = new Map(leaveBalances.map((balance) => [balance.user_id, balance]))

  const currentProfile = mapProfile(profilesById.get(userId), userId)
  const currentLeaveBalance = mapLeaveBalance(leaveBalancesById.get(userId), userId)
  const currentUserRow = userRows.find((entry) => entry.id === userId)

  const accounts: AdministrativeAccountSummary[] = adminUserRows.map((entry) => {
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
    ? requestRows.filter((request) => request.request_type !== "internal_transaction").map((request) => mapRequest(request, namesById, userId, isManager))
    : []

  const allAttendanceHistory = attendanceRows.map((row) => mapAttendance(row, namesById))
  const attendanceHistory = allAttendanceHistory.filter((record) => record.userId === userId)
  const todayKey = getSaudiDateKey()
  const todayAttendance = buildAttendanceDaySummary(attendanceHistory.filter((record) => record.workDate === todayKey))

  return {
    currentUserId: userId,
    currentUserName,
    currentUserTitle,
    isManager,
    unreadReviewRequestsCount: isManager ? countUnreadReviewRequests(requestRows, userId, lastSeenAt) : 0,
    internalRecipients: userRows
      .filter((entry) => entry.id !== userId)
      .sort((left, right) => left.full_name.localeCompare(right.full_name, "ar"))
      .map((entry) => ({ userId: entry.id, name: entry.full_name })),
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
    allAttendanceHistory,
    myRequests,
    reviewableRequests,
    accounts,
  }
}

async function insertAdministrativeRequest(userId: string, currentUserName: string, payload: z.infer<typeof createRequestSchema>) {
  const supabase = createSupabaseAdminClient()

  if (payload.requestType === "internal_transaction") {
    if (!payload.targetUserId) {
      return { message: "يجب اختيار الموظف المستلم" }
    }

    if (payload.targetUserId === userId) {
      return { message: "لا يمكنك إرسال معاملة داخلية لنفسك" }
    }

    const { data: targetUser, error: targetUserError } = await supabase
      .from("app_users")
      .select("id,full_name")
      .eq("id", payload.targetUserId)
      .maybeSingle<{ id: string; full_name: string }>()

    if (targetUserError) {
      return targetUserError
    }

    if (!targetUser) {
      return { message: "الموظف المحدد غير موجود" }
    }

    const dueAt = getSaudiEndOfDayIso()
    const taskDescription = [`معاملة داخلية من ${currentUserName}`, payload.details].filter(Boolean).join("\n\n")

    const { data: insertedTaskRows, error: taskError } = await supabase
      .from("user_tasks")
      .insert({
        task_kind: "internal_transaction",
        title: payload.subject,
        description: taskDescription,
        assigned_to_user_id: payload.targetUserId,
        assigned_by_user_id: userId,
        due_at: dueAt,
      })
      .select("id,title")

    if (taskError) {
      return taskError
    }

    const insertedTask = insertedTaskRows?.[0]
    const { error: notificationError } = await supabase.from("task_notifications").insert({
      user_id: payload.targetUserId,
      task_id: insertedTask?.id ?? null,
      notification_type: "new_task",
      title: `معاملة داخلية جديدة من ${currentUserName}`,
      body: payload.subject,
    })

    if (notificationError) {
      if (insertedTask?.id) {
        await supabase.from("user_tasks").delete().eq("id", insertedTask.id)
      }

      return notificationError
    }

    const { error: requestError } = await supabase.from("administrative_requests").insert({
      user_id: userId,
      target_user_id: payload.targetUserId,
      request_type: payload.requestType,
      status: "approved",
      subject: payload.subject,
      details: payload.details,
      amount_requested: null,
      start_date: null,
      end_date: null,
      request_date: null,
      from_time: null,
      to_time: null,
      leave_allocation_type: null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })

    if (requestError) {
      if (insertedTask?.id) {
        await supabase.from("user_tasks").delete().eq("id", insertedTask.id)
      }

      return requestError
    }

    return null
  }

  const { error } = await supabase.from("administrative_requests").insert({
    user_id: userId,
    target_user_id: null,
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
    leave_allocation_type: payload.requestType === "leave" ? "leave_balance" : payload.leaveAllocationType ?? null,
  })

  return error
}

async function handleClockAttendance(
  userId: string,
  eventType: "clock_in" | "clock_out",
  payload: {
    coordinates: { latitude: number; longitude: number; accuracy?: number }
    integrity?: {
      permissionState?: "granted" | "prompt" | "denied" | "unknown"
      isSecureContext?: boolean
      isMocked?: boolean
      reasons?: string[]
      userAgent?: string
      sampledAt?: string
      sampleCount?: number
    }
  },
) {
  const supabase = createSupabaseAdminClient()
  const workLocation = await getLatestWorkLocation()
  const { coordinates, integrity } = payload

  if (!workLocation) {
    return NextResponse.json({ error: "لم يتم تحديد موقع العمل بعد من قبل المدير" }, { status: 400 })
  }

  if (integrity?.isMocked) {
    return NextResponse.json(
      {
        error: `تم رفض التحضير لأن الجهاز يشير إلى استخدام موقع وهمي.${integrity.reasons?.length ? ` ${integrity.reasons.join("، ")}.` : ""}`,
      },
      { status: 400 },
    )
  }

  const distance = calculateDistanceMeters(
    coordinates.latitude,
    coordinates.longitude,
    workLocation.latitude,
    workLocation.longitude,
  )

  const gpsAccuracyBuffer = Math.min(Math.max(coordinates.accuracy ?? 0, 0), 150)
  const allowedDistance = workLocation.radius_meters + gpsAccuracyBuffer

  if (distance > allowedDistance) {
    const isLikelyMisconfiguredLocation = distance > 10000
    return NextResponse.json(
      {
        error:
          gpsAccuracyBuffer > 0
            ? `${isLikelyMisconfiguredLocation ? "يبدو أن موقع التحضير المحفوظ بعيد جدًا عن موقعك الحالي. راجع إعدادات موقع العمل أولًا. " : ""}لا يمكنك تسجيل الحضور خارج نطاق موقع العمل (${workLocation.name}). المسافة الحالية تقريبًا ${Math.round(distance)} متر، والنطاق المسموح ${Math.round(allowedDistance)} متر، ودقة موقع الجهاز ${Math.round(gpsAccuracyBuffer)} متر.`
            : isLikelyMisconfiguredLocation
              ? "يبدو أن موقع التحضير المحفوظ بعيد جدًا عن موقعك الحالي. راجع إعدادات موقع العمل أولًا."
              : "لا يمكنك تسجيل الحضور خارج نطاق موقع العمل",
        geofence: {
          workLocationName: workLocation.name,
          distanceMeters: Math.round(distance),
          allowedDistanceMeters: Math.round(allowedDistance),
          accuracyMeters: Math.round(gpsAccuracyBuffer),
          googleMapsUrl: workLocation.google_maps_url,
        },
      },
      { status: 400 },
    )
  }

  const workDate = getSaudiDateKey()
  const now = new Date().toISOString()

  const existingRecords = await safeSelect<AttendanceRow>(async () => {
    return supabase
      .from("attendance_records")
      .select("id,user_id,work_date,clock_in_at,clock_out_at,clock_in_latitude,clock_in_longitude,clock_out_latitude,clock_out_longitude,notes")
      .eq("user_id", userId)
      .eq("work_date", workDate)
      .order("clock_in_at", { ascending: false })
  })

  const openAttendance = existingRecords.find((record) => record.clock_in_at && !record.clock_out_at) ?? null
  const hasAttendanceForDay = existingRecords.some((record) => Boolean(record.clock_in_at))

  if (eventType === "clock_in") {
    if (openAttendance) {
      return NextResponse.json({ error: "يوجد تسجيل حضور مفتوح لهذا اليوم. سجل الانصراف أولًا" }, { status: 400 })
    }

    const existingBalanceRows = await safeSelect<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,work_start_time")
        .eq("user_id", userId),
    )
    const balance = mapLeaveBalance(existingBalanceRows[0], userId)
    const currentClockMinutes = getSaudiClockMinutes(now)
    const configuredWorkStartMinutes = parseTimeToMinutes(balance.workStartTime) ?? parseTimeToMinutes(workLocation.work_start_time) ?? DEFAULT_WORK_START_MINUTES
    const lateMinutes = hasAttendanceForDay ? 0 : Math.max(0, currentClockMinutes - configuredWorkStartMinutes)

    const { error } = await supabase.from("attendance_records").insert(
      {
        user_id: userId,
        work_date: workDate,
        clock_in_at: now,
        clock_in_latitude: coordinates.latitude,
        clock_in_longitude: coordinates.longitude,
      },
    )

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (lateMinutes > 0) {
      const balanceUpdate = await supabase.from("employee_leave_balances").upsert(
        {
          user_id: userId,
          leave_quota_days: balance.leaveQuotaDays,
          leave_taken_days: balance.leaveTakenDays,
          allowance_total_days: balance.lateQuotaMinutes,
          allowance_used_days: balance.lateUsedMinutes + lateMinutes,
          permission_quota_count: balance.permissionQuotaMinutes,
          permission_used_count: balance.permissionUsedMinutes,
          work_start_time: balance.workStartTime,
          updated_by: userId,
        },
        { onConflict: "user_id" },
      )

      if (balanceUpdate.error) {
        if (isSchemaMissing(balanceUpdate.error)) {
          return schemaResponse()
        }

        return NextResponse.json({ error: balanceUpdate.error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true })
  }

  if (!openAttendance?.clock_in_at) {
    return NextResponse.json({ error: "يجب تسجيل الحضور أولًا قبل تسجيل الانصراف" }, { status: 400 })
  }

  const { error } = await supabase
    .from("attendance_records")
    .update({
      clock_out_at: now,
      clock_out_latitude: coordinates.latitude,
      clock_out_longitude: coordinates.longitude,
    })
    .eq("id", openAttendance.id)

  if (error) {
    if (isSchemaMissing(error)) {
      return schemaResponse()
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET(request: Request) {
  const { user, response } = await requireAdministrativeAccess("attendance")
  if (response || !user) return response

  try {
    const summary = new URL(request.url).searchParams.get("summary")
    if (summary === "counts") {
      return NextResponse.json(await loadAdministrativeSidebarCounts(user.id, user.permissions.includes("*")))
    }

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
    return handleClockAttendance(user.id, parsed.data.eventType, {
      coordinates: parsed.data.coordinates,
      integrity: parsed.data.integrity,
    })
  }

  const error = await insertAdministrativeRequest(user.id, user.name, parsed.data)

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

  if (parsed.data.action === "mark_review_requests_seen") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه فتح سجل مراجعة الطلبات" }, { status: 403 })
    }

    const markError = await markSectionSeen(user.id, STAFF_REQUESTS_SECTION_KEY)
    if (markError) {
      if (isSchemaMissing(markError)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: markError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "configure_work_location") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه تحديد موقع العمل" }, { status: 403 })
    }

    const currentRow = await getLatestWorkLocation()
    const resolvedCoordinates = parsed.data.googleMapsUrl
      ? await resolveCoordinatesFromGoogleMapsUrl(parsed.data.googleMapsUrl)
      : null

    if (parsed.data.googleMapsUrl && !resolvedCoordinates) {
      return NextResponse.json(
        { error: "تعذر قراءة الإحداثيات من رابط Google Maps. استخدم رابطًا مباشرًا للموقع أو حدده من الخريطة." },
        { status: 400 },
      )
    }

    const normalizedName = parsed.data.name || currentRow?.name || "موقع العمل الرئيسي"
    const finalLatitude = resolvedCoordinates?.latitude ?? parsed.data.latitude
    const finalLongitude = resolvedCoordinates?.longitude ?? parsed.data.longitude
    const payload = {
      name: normalizedName,
      address: parsed.data.address,
      latitude: finalLatitude,
      longitude: finalLongitude,
      radius_meters: parsed.data.radiusMeters,
      google_maps_url: buildGoogleMapsUrl(finalLatitude, finalLongitude),
      work_start_time: parsed.data.workStartTime ?? currentRow?.work_start_time ?? DEFAULT_WORK_START_TIME,
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

    const targetUserIds = parsed.data.userId === "all_accounts"
      ? await safeSelect<UserRow>(() =>
          supabase
            .from("app_users")
            .select("id,full_name,phone,email,role,created_at")
            .eq("role", "admin")
            .order("created_at", { ascending: true }),
        ).then((rows) => rows.map((row) => row.id))
      : [parsed.data.userId]

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "لا توجد حسابات متاحة لتحديث الأرصدة" }, { status: 400 })
    }

    const existingRows = await safeSelect<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,work_start_time")
        .in("user_id", targetUserIds),
    )
    const balancesByUserId = new Map(existingRows.map((row) => [row.user_id, row]))

    const { error } = await supabase.from("employee_leave_balances").upsert(
      targetUserIds.map((targetUserId) => {
        const currentBalance = mapLeaveBalance(balancesByUserId.get(targetUserId), targetUserId)

        return {
          user_id: targetUserId,
          leave_quota_days: parsed.data.leaveQuotaDays,
          leave_taken_days: currentBalance.leaveTakenDays,
          allowance_total_days: parsed.data.lateQuotaMinutes,
          allowance_used_days: currentBalance.lateUsedMinutes,
          permission_quota_count: parsed.data.permissionQuotaMinutes,
          permission_used_count: currentBalance.permissionUsedMinutes,
          work_start_time: parsed.data.workStartTime,
          updated_by: user.id,
        }
      }),
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
    .select("id,user_id,request_type,status,start_date,end_date,leave_allocation_type,from_time,to_time")
    .eq("id", parsed.data.requestId)
    .maybeSingle<{
      id: string
      user_id: string
      request_type: "leave" | "permission" | "financial" | "general" | "internal_transaction"
      status: "pending" | "approved" | "rejected" | "cancelled"
      start_date: string | null
      end_date: string | null
      leave_allocation_type: "leave_balance" | "allowance" | null
      from_time: string | null
      to_time: string | null
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
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,work_start_time")
        .eq("user_id", row.user_id),
    )
    const balance = mapLeaveBalance(existingRows[0], row.user_id)

    if (row.request_type === "leave") {
      const requestedDays = row.start_date && row.end_date ? calculateLeaveDays(row.start_date, row.end_date) : 0
      if (requestedDays <= 0) {
        return NextResponse.json({ error: "تواريخ الإجازة غير صحيحة" }, { status: 400 })
      }

      const remainingLeave = balance.leaveQuotaDays - balance.leaveTakenDays
      if (remainingLeave < requestedDays) {
        return NextResponse.json({ error: "رصيد الإجازات المتبقي لا يكفي لاعتماد الطلب" }, { status: 400 })
      }

      const { error } = await supabase.from("employee_leave_balances").upsert(
        {
          user_id: row.user_id,
          leave_quota_days: balance.leaveQuotaDays,
          leave_taken_days: balance.leaveTakenDays + requestedDays,
          allowance_total_days: balance.lateQuotaMinutes,
          allowance_used_days: balance.lateUsedMinutes,
          permission_quota_count: balance.permissionQuotaMinutes,
          permission_used_count: balance.permissionUsedMinutes,
          work_start_time: balance.workStartTime,
          updated_by: user.id,
        },
        { onConflict: "user_id" },
      )

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    if (row.request_type === "permission") {
      const requestedMinutes = getRequestedPermissionMinutes(row.from_time, row.to_time)
      if (requestedMinutes <= 0) {
        return NextResponse.json({ error: "وقت الاستئذان غير صحيح" }, { status: 400 })
      }

      const remainingPermissions = balance.permissionQuotaMinutes - balance.permissionUsedMinutes
      if (remainingPermissions < requestedMinutes) {
        return NextResponse.json({ error: "رصيد دقائق الاستئذان المتبقي لا يكفي لاعتماد الطلب" }, { status: 400 })
      }

      const { error } = await supabase.from("employee_leave_balances").upsert(
        {
          user_id: row.user_id,
          leave_quota_days: balance.leaveQuotaDays,
          leave_taken_days: balance.leaveTakenDays,
          allowance_total_days: balance.lateQuotaMinutes,
          allowance_used_days: balance.lateUsedMinutes,
          permission_quota_count: balance.permissionQuotaMinutes,
          permission_used_count: balance.permissionUsedMinutes + requestedMinutes,
          work_start_time: balance.workStartTime,
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
