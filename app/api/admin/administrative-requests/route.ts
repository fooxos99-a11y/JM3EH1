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
  getDateKeysBetween,
  getAccountTypeLabel,
  toSaudiDateInputValue,
  type AdministrativeAccountSummary,
  type AdministrativeDashboardData,
  type AdministrativeRequestRecord,
  type AttendanceDaySummary,
  type AttendanceRecord,
  type EmployeeAttendancePeriodOverride,
  type EmployeeProfile,
  type LeaveBalance,
  type OfficialHoliday,
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
const DEFAULT_WORK_END_TIME = "16:00"
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
    leaveTypeBalanceId: z.string().uuid("نوع الإجازة المحدد غير صالح").optional(),
  })
  .superRefine((value, context) => {
    if (value.requestType === "leave") {
      if (!value.leaveTypeBalanceId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "يجب اختيار نوع الإجازة" })
      }

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
    monthlySalary: z.number().min(0),
    weeklyRequiredMinutes: z.number().int().min(0),
    lateGraceMinutes: z.number().int().min(0),
    scheduleTemplateId: z.string().uuid().nullable(),
    workStartTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت بداية الدوام غير صالح"),
    workEndTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت نهاية الدوام غير صالح"),
    leaveTypes: z.array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1, "اسم نوع الإجازة مطلوب"),
        allowedDays: z.number().int().min(0),
      }),
    ).optional(),
  }),
  z.object({
    action: z.literal("update_attendance_settings"),
    userId: z.union([z.string().uuid(), z.literal("all_accounts")]),
    monthlySalary: z.number().min(0),
    weeklyRequiredMinutes: z.number().int().min(0),
    lateGraceMinutes: z.number().int().min(0),
    scheduleTemplateId: z.string().uuid().nullable(),
    workStartTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت بداية الدوام غير صالح"),
    workEndTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت نهاية الدوام غير صالح"),
    periodOverrides: z.array(
      z.object({
        weekdays: z.array(z.number().int().min(0).max(6)).min(1, "يجب اختيار يوم واحد على الأقل"),
        startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت بداية الفترة غير صالح"),
        endTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت نهاية الفترة غير صالح"),
      }),
    ).optional(),
  }),
  z.object({
    action: z.literal("update_general_balances"),
    leaveQuotaDays: z.number().min(0).optional(),
    lateQuotaMinutes: z.number().min(0).optional(),
    permissionQuotaMinutes: z.number().min(0).optional(),
    lateGraceMinutes: z.number().min(0).optional(),
    leaveTypes: z.array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1, "اسم نوع الإجازة مطلوب"),
        allowedDays: z.number().int().min(0),
      }),
    ).optional(),
  }),
  z.object({
    action: z.literal("save_leave_types"),
    userId: z.string().uuid("الموظف المحدد غير صالح"),
    leaveTypes: z.array(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1, "اسم نوع الإجازة مطلوب"),
        allowedDays: z.number().int().min(0),
      }),
    ),
  }),
  z.object({
    action: z.literal("save_employee_period_override"),
    userId: z.string().uuid("الموظف المحدد غير صالح"),
    overrideDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ الفترة غير صالح"),
    startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت بداية الفترة غير صالح"),
    endTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت نهاية الفترة غير صالح"),
    note: z.string().trim().optional().transform((value) => value ?? ""),
  }),
  z.object({
    action: z.literal("delete_employee_period_override"),
    overrideId: z.string().uuid("الفترة المحددة غير صالحة"),
  }),
  z.object({
    action: z.literal("save_official_holiday"),
    holidayId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1, "اسم الإجازة الرسمية مطلوب"),
    startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ البداية غير صالح"),
    endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ النهاية غير صالح"),
  }),
  z.object({
    action: z.literal("delete_official_holiday"),
    holidayId: z.string().uuid("الإجازة الرسمية غير صالحة"),
  }),
  z.object({
    action: z.literal("save_schedule_template"),
    templateId: z.string().uuid().nullable().optional(),
    name: z.string().trim().min(1, "اسم القالب مطلوب"),
    description: z.string().trim().optional().transform((value) => value ?? ""),
    lateQuotaMinutes: z.number().int().min(0),
    permissionQuotaMinutes: z.number().int().min(0),
    weeklyRequiredMinutes: z.number().int().min(0),
    workStartTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت بداية الدوام غير صالح"),
    workEndTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت نهاية الدوام غير صالح"),
    periods: z.array(
      z.object({
        weekday: z.number().int().min(0).max(6),
        startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت البداية غير صالح"),
        endTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "وقت النهاية غير صالح"),
      }),
    ).min(1, "يجب إضافة فترة دوام واحدة على الأقل"),
  }),
  z.object({
    action: z.literal("delete_schedule_template"),
    templateId: z.string().uuid("القالب غير صالح"),
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
  monthly_salary: number | null
  weekly_required_minutes: number | null
  late_grace_minutes: number | null
  schedule_template_id: string | null
  work_start_time: string
  work_end_time: string
}

type LeaveTypeBalanceRow = {
  id: string
  user_id: string
  leave_type_name: string
  allowed_days: number
  used_days: number
  sort_order: number
}

type ScheduleTemplateRow = {
  id: string
  name: string
  description: string
  monthly_salary: number | null
  leave_quota_days: number | null
  late_quota_minutes: number | null
  permission_quota_minutes: number | null
  weekly_required_minutes: number | null
  late_grace_minutes: number | null
  work_start_time: string
  work_end_time: string
}

type ScheduleTemplatePeriodRow = {
  id: string
  template_id: string
  weekday: number
  start_time: string
  end_time: string
  sort_order: number
}

type ScheduleTemplateLeaveTypeRow = {
  id: string
  template_id: string
  leave_type_name: string
  allowed_days: number
  sort_order: number
}

type MonthlyDeductionRow = {
  user_id: string
  deduction_year: number
  deduction_month: number
  late_minutes: number
  early_leave_minutes: number
  total_deduction_amount: number | null
  is_locked: boolean
}

type AttendancePeriodOverrideRow = {
  id: string
  user_id: string
  override_date: string | null
  weekday: number | null
  start_time: string
  end_time: string
  is_removed: boolean
  note: string
}

type OfficialHolidayRow = {
  id: string
  name: string
  start_date: string
  end_date: string
  created_at: string
}

type ResolvedAttendanceSchedule = {
  startMinutes: number | null
  endMinutes: number | null
  totalMinutes: number
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
  leave_type_balance_id: string | null
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

  const message = error.message?.toLowerCase() ?? ""

  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "22P02" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("could not find the column")
  )
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
    monthlySalary: row.monthly_salary ?? 0,
    weeklyRequiredMinutes: row.weekly_required_minutes ?? 0,
    lateGraceMinutes: row.late_grace_minutes ?? 0,
    scheduleTemplateId: row.schedule_template_id ?? null,
    workStartTime: row.work_start_time || DEFAULT_WORK_START_TIME,
    workEndTime: row.work_end_time || DEFAULT_WORK_END_TIME,
  }
}

function mapLeaveTypeBalance(row: LeaveTypeBalanceRow) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.leave_type_name,
    allowedDays: row.allowed_days,
    usedDays: row.used_days,
    sortOrder: row.sort_order,
  }
}

function mapScheduleTemplateLeaveType(row: ScheduleTemplateLeaveTypeRow) {
  return {
    id: row.id,
    name: row.leave_type_name,
    allowedDays: row.allowed_days,
    sortOrder: row.sort_order,
  }
}

function mapAttendancePeriodOverride(row: AttendancePeriodOverrideRow): EmployeeAttendancePeriodOverride {
  return {
    id: row.id,
    userId: row.user_id,
    overrideDate: row.override_date,
    weekday: row.weekday,
    startTime: row.start_time,
    endTime: row.end_time,
    isRemoved: row.is_removed,
    note: row.note,
  }
}

function mapOfficialHoliday(row: OfficialHolidayRow): OfficialHoliday {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
  }
}

function buildOfficialHolidayDateSet(officialHolidays: Array<{ start_date: string; end_date: string }>) {
  const holidayDates = new Set<string>()

  for (const holiday of officialHolidays) {
    for (const dateKey of getDateKeysBetween(holiday.start_date, holiday.end_date)) {
      holidayDates.add(dateKey)
    }
  }

  return holidayDates
}

function calculateLeaveDaysExcludingOfficialHolidays(startDate: string, endDate: string, officialHolidays: Array<{ start_date: string; end_date: string }>) {
  const officialHolidayDateSet = buildOfficialHolidayDateSet(officialHolidays)

  return getDateKeysBetween(startDate, endDate).filter((dateKey) => !officialHolidayDateSet.has(dateKey)).length
}

function applyLeaveTypeTotals(balance: LeaveBalance, leaveTypes: Array<{ allowedDays: number; usedDays: number }>) {
  if (leaveTypes.length === 0) {
    return balance
  }

  return {
    ...balance,
    leaveQuotaDays: leaveTypes.reduce((total, leaveType) => total + leaveType.allowedDays, 0),
    leaveTakenDays: leaveTypes.reduce((total, leaveType) => total + leaveType.usedDays, 0),
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

function mapRequest(row: RequestRow, namesById: Map<string, string>, leaveTypeNamesById: Map<string, string>, currentUserId: string, isManager: boolean): AdministrativeRequestRecord {
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
    leaveTypeBalanceId: row.leave_type_balance_id,
    leaveTypeName: row.leave_type_balance_id ? leaveTypeNamesById.get(row.leave_type_balance_id) ?? null : null,
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

function getWeekdayFromDateKey(workDate: string) {
  const date = new Date(`${workDate}T00:00:00Z`)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return date.getUTCDay()
}

function getMonthRangeFromDateKey(workDate: string) {
  const [yearText, monthText] = workDate.split("-")
  const year = Number(yearText)
  const month = Number(monthText)

  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
    return null
  }

  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1

  return {
    year,
    month,
    start: `${yearText}-${monthText}-01`,
    end: `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`,
  }
}

function resolveAttendanceScheduleForDate(
  periods: ScheduleTemplatePeriodRow[],
  overrides: AttendancePeriodOverrideRow[],
  workDate: string,
  fallbackStartTime?: string | null,
  fallbackEndTime?: string | null,
): ResolvedAttendanceSchedule {
  const matchingOverrides = overrides
    .filter((override) => override.override_date === workDate && !override.is_removed)
    .sort((left, right) => left.start_time.localeCompare(right.start_time))

  if (matchingOverrides.length > 0) {
    let startMinutes: number | null = null
    let endMinutes: number | null = null
    let totalMinutes = 0

    for (const override of matchingOverrides) {
      const periodStart = parseTimeToMinutes(override.start_time)
      const periodEnd = parseTimeToMinutes(override.end_time)

      if (periodStart === null || periodEnd === null || periodEnd <= periodStart) {
        continue
      }

      startMinutes = startMinutes === null ? periodStart : Math.min(startMinutes, periodStart)
      endMinutes = endMinutes === null ? periodEnd : Math.max(endMinutes, periodEnd)
      totalMinutes += periodEnd - periodStart
    }

    return {
      startMinutes: startMinutes ?? parseTimeToMinutes(fallbackStartTime) ?? null,
      endMinutes,
      totalMinutes,
    }
  }

  const weekday = getWeekdayFromDateKey(workDate)
  const matchingPeriods = weekday === null
    ? []
    : periods
      .filter((period) => period.weekday === weekday)
      .sort((left, right) => left.sort_order - right.sort_order)

  if (matchingPeriods.length === 0) {
    return {
      startMinutes: parseTimeToMinutes(fallbackStartTime) ?? null,
      endMinutes: parseTimeToMinutes(fallbackEndTime) ?? null,
      totalMinutes: 0,
    }
  }

  let startMinutes: number | null = null
  let endMinutes: number | null = null
  let totalMinutes = 0

  for (const period of matchingPeriods) {
    const periodStart = parseTimeToMinutes(period.start_time)
    const periodEnd = parseTimeToMinutes(period.end_time)

    if (periodStart === null || periodEnd === null || periodEnd <= periodStart) {
      continue
    }

    startMinutes = startMinutes === null ? periodStart : Math.min(startMinutes, periodStart)
    endMinutes = endMinutes === null ? periodEnd : Math.max(endMinutes, periodEnd)
    totalMinutes += periodEnd - periodStart
  }

  return {
    startMinutes: startMinutes ?? parseTimeToMinutes(fallbackStartTime) ?? null,
    endMinutes,
    totalMinutes,
  }
}

function calculateMonthlyDeductionAmount(totalMinutes: number, monthlySalary: number, weeklyRequiredMinutes: number) {
  if (totalMinutes <= 0 || monthlySalary <= 0 || weeklyRequiredMinutes <= 0) {
    return 0
  }

  const averageMonthlyMinutes = Math.round((weeklyRequiredMinutes * 52) / 12)
  if (averageMonthlyMinutes <= 0) {
    return 0
  }

  return Number(((totalMinutes / averageMonthlyMinutes) * monthlySalary).toFixed(2))
}

function mapMonthlyDeduction(row: MonthlyDeductionRow | undefined | null) {
  if (!row) {
    return null
  }

  return {
    year: row.deduction_year,
    month: row.deduction_month,
    lateMinutes: row.late_minutes,
    earlyLeaveMinutes: row.early_leave_minutes,
    totalDeductionAmount: row.total_deduction_amount ?? 0,
    isLocked: row.is_locked,
  }
}

async function syncLeaveTypeAggregateBalance(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  updatedBy: string,
  currentBalance?: LeaveBalance,
) {
  const leaveTypeRows = await safeSelect<LeaveTypeBalanceRow>(() =>
    supabase
      .from("employee_leave_type_balances")
      .select("id,user_id,leave_type_name,allowed_days,used_days,sort_order")
      .eq("user_id", userId),
  )

  const baseBalance = currentBalance ?? mapLeaveBalance(undefined, userId)
  const totals = leaveTypeRows.reduce(
    (accumulator, row) => ({
      allowedDays: accumulator.allowedDays + row.allowed_days,
      usedDays: accumulator.usedDays + row.used_days,
    }),
    { allowedDays: 0, usedDays: 0 },
  )

  const { error } = await supabase.from("employee_leave_balances").upsert(
    {
      user_id: userId,
      leave_quota_days: totals.allowedDays,
      leave_taken_days: totals.usedDays,
      allowance_total_days: baseBalance.lateQuotaMinutes,
      allowance_used_days: baseBalance.lateUsedMinutes,
      permission_quota_count: baseBalance.permissionQuotaMinutes,
      permission_used_count: baseBalance.permissionUsedMinutes,
      monthly_salary: baseBalance.monthlySalary,
      weekly_required_minutes: baseBalance.weeklyRequiredMinutes,
      late_grace_minutes: baseBalance.lateGraceMinutes,
      schedule_template_id: baseBalance.scheduleTemplateId,
      work_start_time: baseBalance.workStartTime,
      work_end_time: baseBalance.workEndTime,
      updated_by: updatedBy,
    },
    { onConflict: "user_id" },
  )

  return error
}

async function replaceEmployeeLeaveTypes(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  leaveTypes: Array<{ id?: string; name: string; allowedDays: number }>,
) {
  const existingLeaveTypes = await safeSelect<LeaveTypeBalanceRow>(() =>
    supabase
      .from("employee_leave_type_balances")
      .select("id,user_id,leave_type_name,allowed_days,used_days,sort_order")
      .eq("user_id", userId),
  )
  const existingById = new Map(existingLeaveTypes.map((row) => [row.id, row]))
  const existingByName = new Map(existingLeaveTypes.map((row) => [row.leave_type_name.trim(), row]))
  const retainedIds = leaveTypes.flatMap((leaveType) => leaveType.id ? [leaveType.id] : [])
  const deleteIds = existingLeaveTypes.filter((row) => !retainedIds.includes(row.id)).map((row) => row.id)

  if (deleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("employee_leave_type_balances")
      .delete()
      .in("id", deleteIds)

    if (deleteError) {
      return deleteError
    }
  }

  if (leaveTypes.length === 0) {
    return null
  }

  const { error: upsertError } = await supabase.from("employee_leave_type_balances").upsert(
    leaveTypes.map((leaveType, index) => ({
      ...(leaveType.id ? { id: leaveType.id } : {}),
      user_id: userId,
      leave_type_name: leaveType.name,
      allowed_days: leaveType.allowedDays,
      used_days: existingById.get(leaveType.id ?? "")?.used_days ?? existingByName.get(leaveType.name.trim())?.used_days ?? 0,
      sort_order: index,
    })),
    { onConflict: "id" },
  )

  return upsertError
}

async function loadScheduleTemplatePeriods(templateId: string | null) {
  if (!templateId) {
    return [] as ScheduleTemplatePeriodRow[]
  }

  const supabase = createSupabaseAdminClient()
  return safeSelect<ScheduleTemplatePeriodRow>(() =>
    supabase
      .from("attendance_schedule_template_periods")
      .select("id,template_id,weekday,start_time,end_time,sort_order")
      .eq("template_id", templateId)
      .order("weekday", { ascending: true })
      .order("sort_order", { ascending: true }),
  )
}

async function loadAttendancePeriodOverrides(userId: string, monthRange?: { start: string; end: string } | null) {
  const supabase = createSupabaseAdminClient()

  return safeSelect<AttendancePeriodOverrideRow>(() => {
    let query = supabase
      .from("employee_attendance_period_overrides")
      .select("id,user_id,override_date,weekday,start_time,end_time,is_removed,note")
      .eq("user_id", userId)
      .eq("is_removed", false)

    if (monthRange) {
      query = query.gte("override_date", monthRange.start).lt("override_date", monthRange.end)
    }

    return query.order("override_date", { ascending: true }).order("start_time", { ascending: true })
  })
}

async function syncMonthlyDeductionsForAttendance(userId: string, balance: LeaveBalance, workDate: string) {
  const monthRange = getMonthRangeFromDateKey(workDate)
  if (!monthRange) {
    return
  }

  const supabase = createSupabaseAdminClient()
  const [attendanceRows, templatePeriods, attendanceOverrides, officialHolidayRows] = await Promise.all([
    safeSelect<AttendanceRow>(() =>
      supabase
        .from("attendance_records")
        .select("id,user_id,work_date,clock_in_at,clock_out_at,clock_in_latitude,clock_in_longitude,clock_out_latitude,clock_out_longitude,notes")
        .eq("user_id", userId)
        .gte("work_date", monthRange.start)
        .lt("work_date", monthRange.end)
        .order("work_date", { ascending: true })
        .order("clock_in_at", { ascending: true }),
    ),
    loadScheduleTemplatePeriods(balance.scheduleTemplateId),
    loadAttendancePeriodOverrides(userId, monthRange),
    safeSelect<OfficialHolidayRow>(() =>
      supabase
        .from("official_holidays")
        .select("id,name,start_date,end_date,created_at")
        .lte("start_date", monthRange.end)
        .gte("end_date", monthRange.start),
    ),
  ])
  const officialHolidayDateSet = buildOfficialHolidayDateSet(officialHolidayRows)

  const emptyNames = new Map<string, string>()
  const recordsByDate = new Map<string, AttendanceRecord[]>()

  for (const row of attendanceRows) {
    const record = mapAttendance(row, emptyNames)
    const existing = recordsByDate.get(record.workDate) ?? []
    existing.push(record)
    recordsByDate.set(record.workDate, existing)
  }

  let lateMinutes = 0
  let earlyLeaveMinutes = 0

  for (const [attendanceDate, dailyRecords] of recordsByDate) {
    if (officialHolidayDateSet.has(attendanceDate)) {
      continue
    }

    const dailySummary = buildAttendanceDaySummary(dailyRecords)
    if (!dailySummary?.clockInAt) {
      continue
    }

    const expectedSchedule = resolveAttendanceScheduleForDate(templatePeriods, attendanceOverrides, attendanceDate, balance.workStartTime, balance.workEndTime)
    const firstClockMinutes = expectedSchedule.startMinutes === null ? null : getSaudiClockMinutes(dailySummary.clockInAt)

    if (firstClockMinutes !== null && expectedSchedule.startMinutes !== null) {
      lateMinutes += Math.max(0, firstClockMinutes - expectedSchedule.startMinutes - Math.max(0, balance.lateGraceMinutes))
    }

    if (dailySummary.clockOutAt && expectedSchedule.endMinutes !== null) {
      const lastClockMinutes = getSaudiClockMinutes(dailySummary.clockOutAt)
      earlyLeaveMinutes += Math.max(0, expectedSchedule.endMinutes - lastClockMinutes)
    }
  }

  const { error } = await supabase.from("employee_monthly_deductions").upsert(
    {
      user_id: userId,
      deduction_year: monthRange.year,
      deduction_month: monthRange.month,
      late_minutes: lateMinutes,
      early_leave_minutes: earlyLeaveMinutes,
      total_deduction_amount: calculateMonthlyDeductionAmount(lateMinutes + earlyLeaveMinutes, balance.monthlySalary, balance.weeklyRequiredMinutes),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,deduction_year,deduction_month" },
  )

  if (error && !isSchemaMissing(error)) {
    throw new Error(error.message)
  }
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
  const currentMonthRange = getMonthRangeFromDateKey(getSaudiDateKey())

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
      .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time"),
  )
  const leaveTypeBalanceRows = await safeSelect<LeaveTypeBalanceRow>(() =>
    supabase
      .from("employee_leave_type_balances")
      .select("id,user_id,leave_type_name,allowed_days,used_days,sort_order")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  )
  const attendancePeriodOverrideRows = await safeSelect<AttendancePeriodOverrideRow>(() =>
    supabase
      .from("employee_attendance_period_overrides")
      .select("id,user_id,override_date,weekday,start_time,end_time,is_removed,note")
      .eq("is_removed", false)
      .order("override_date", { ascending: true })
      .order("start_time", { ascending: true }),
  )
  const officialHolidayRows = await safeSelect<OfficialHolidayRow>(() =>
    supabase
      .from("official_holidays")
      .select("id,name,start_date,end_date,created_at")
      .order("start_date", { ascending: true })
      .order("created_at", { ascending: true }),
  )
  const scheduleTemplateRows = await safeSelect<ScheduleTemplateRow>(() =>
    supabase
      .from("attendance_schedule_templates")
      .select("id,name,description,monthly_salary,leave_quota_days,late_quota_minutes,permission_quota_minutes,weekly_required_minutes,late_grace_minutes,work_start_time,work_end_time")
      .order("created_at", { ascending: true }),
  )
  const scheduleTemplatePeriods = scheduleTemplateRows.length === 0
    ? []
    : await safeSelect<ScheduleTemplatePeriodRow>(() =>
      supabase
        .from("attendance_schedule_template_periods")
        .select("id,template_id,weekday,start_time,end_time,sort_order")
        .in("template_id", scheduleTemplateRows.map((row) => row.id))
        .order("weekday", { ascending: true })
        .order("sort_order", { ascending: true }),
    )
  const scheduleTemplateLeaveTypeRows = scheduleTemplateRows.length === 0
    ? []
    : await safeSelect<ScheduleTemplateLeaveTypeRow>(() =>
      supabase
        .from("attendance_schedule_template_leave_types")
        .select("id,template_id,leave_type_name,allowed_days,sort_order")
        .in("template_id", scheduleTemplateRows.map((row) => row.id))
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    )
  const requestRows = await safeSelect<RequestRow>(() =>
    supabase
      .from("administrative_requests")
      .select("id,user_id,request_type,target_user_id,status,subject,details,amount_requested,start_date,end_date,request_date,from_time,to_time,leave_allocation_type,leave_type_balance_id,reviewed_by,reviewed_at,rejection_reason,created_at")
      .order("created_at", { ascending: false }),
  )
  const monthlyDeductionRows = currentMonthRange
    ? await safeSelect<MonthlyDeductionRow>(() =>
      supabase
        .from("employee_monthly_deductions")
        .select("user_id,deduction_year,deduction_month,late_minutes,early_leave_minutes,total_deduction_amount,is_locked")
        .eq("deduction_year", currentMonthRange.year)
        .eq("deduction_month", currentMonthRange.month),
    )
    : []
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
  const leaveTypeBalancesByUserId = new Map<string, ReturnType<typeof mapLeaveTypeBalance>[]>()
  const attendanceOverridesByUserId = new Map<string, EmployeeAttendancePeriodOverride[]>()
  const monthlyDeductionsById = new Map(monthlyDeductionRows.map((deduction) => [deduction.user_id, deduction]))
  const schedulePeriodsByTemplateId = new Map<string, ScheduleTemplatePeriodRow[]>()
  const scheduleTemplateLeaveTypesByTemplateId = new Map<string, ReturnType<typeof mapScheduleTemplateLeaveType>[]>()
  const leaveTypeNamesById = new Map(leaveTypeBalanceRows.map((row) => [row.id, row.leave_type_name]))

  for (const leaveTypeRow of leaveTypeBalanceRows) {
    const existing = leaveTypeBalancesByUserId.get(leaveTypeRow.user_id) ?? []
    existing.push(mapLeaveTypeBalance(leaveTypeRow))
    leaveTypeBalancesByUserId.set(leaveTypeRow.user_id, existing)
  }

  for (const overrideRow of attendancePeriodOverrideRows) {
    const existing = attendanceOverridesByUserId.get(overrideRow.user_id) ?? []
    existing.push(mapAttendancePeriodOverride(overrideRow))
    attendanceOverridesByUserId.set(overrideRow.user_id, existing)
  }

  for (const period of scheduleTemplatePeriods) {
    const existing = schedulePeriodsByTemplateId.get(period.template_id) ?? []
    existing.push(period)
    schedulePeriodsByTemplateId.set(period.template_id, existing)
  }

  for (const leaveTypeRow of scheduleTemplateLeaveTypeRows) {
    const existing = scheduleTemplateLeaveTypesByTemplateId.get(leaveTypeRow.template_id) ?? []
    existing.push(mapScheduleTemplateLeaveType(leaveTypeRow))
    scheduleTemplateLeaveTypesByTemplateId.set(leaveTypeRow.template_id, existing)
  }

  const currentProfile = mapProfile(profilesById.get(userId), userId)
  const currentLeaveTypeBalances = leaveTypeBalancesByUserId.get(userId) ?? []
  const currentAttendanceOverrides = attendanceOverridesByUserId.get(userId) ?? []
  const currentLeaveBalance = applyLeaveTypeTotals(mapLeaveBalance(leaveBalancesById.get(userId), userId), currentLeaveTypeBalances)
  const currentMonthlyDeduction = mapMonthlyDeduction(monthlyDeductionsById.get(userId))
  const currentUserRow = userRows.find((entry) => entry.id === userId)

  const accounts: AdministrativeAccountSummary[] = adminUserRows.map((entry) => {
    const profile = mapProfile(profilesById.get(entry.id), entry.id)
    const leaveTypeBalances = leaveTypeBalancesByUserId.get(entry.id) ?? []
    const attendancePeriodOverrides = attendanceOverridesByUserId.get(entry.id) ?? []
    const leaveBalance = applyLeaveTypeTotals(mapLeaveBalance(leaveBalancesById.get(entry.id), entry.id), leaveTypeBalances)

    return {
      userId: entry.id,
      name: entry.full_name,
      phone: entry.phone,
      email: entry.email,
      accountType: getAccountTypeLabel(entry.role),
      jobTitle: titleById.get(entry.id) ?? "مدير النظام",
      profile,
      leaveBalance,
      leaveTypeBalances,
      attendancePeriodOverrides,
      monthlyDeduction: mapMonthlyDeduction(monthlyDeductionsById.get(entry.id)),
      createdAt: entry.created_at,
      createdByName: profile.createdBy ? namesById.get(profile.createdBy) ?? null : null,
    }
  })

  const myRequests = requestRows
    .filter((request) => request.user_id === userId)
    .map((request) => mapRequest(request, namesById, leaveTypeNamesById, userId, isManager))

  const allRequests = isManager
    ? requestRows.map((request) => mapRequest(request, namesById, leaveTypeNamesById, userId, isManager))
    : []

  const reviewableRequests = isManager
    ? requestRows.filter((request) => request.request_type !== "internal_transaction").map((request) => mapRequest(request, namesById, leaveTypeNamesById, userId, isManager))
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
    monthlyDeduction: currentMonthlyDeduction,
    leaveTypeBalances: currentLeaveTypeBalances,
    attendancePeriodOverrides: currentAttendanceOverrides,
    todayAttendance,
    weeklyAttendance: buildWeeklyAttendance(attendanceHistory),
    attendanceHistory,
    allAttendanceHistory,
    myRequests,
    allRequests,
    reviewableRequests,
    accounts,
    scheduleTemplates: scheduleTemplateRows.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      monthlySalary: template.monthly_salary ?? 0,
      leaveQuotaDays: template.leave_quota_days ?? 0,
      lateQuotaMinutes: template.late_quota_minutes ?? 0,
      permissionQuotaMinutes: template.permission_quota_minutes ?? 0,
      weeklyRequiredMinutes: template.weekly_required_minutes ?? 0,
      lateGraceMinutes: template.late_grace_minutes ?? 0,
      workStartTime: template.work_start_time || DEFAULT_WORK_START_TIME,
      workEndTime: template.work_end_time || DEFAULT_WORK_END_TIME,
      periods: (schedulePeriodsByTemplateId.get(template.id) ?? []).map((period) => ({
        id: period.id,
        weekday: period.weekday,
        startTime: period.start_time,
        endTime: period.end_time,
        sortOrder: period.sort_order,
      })),
      leaveTypes: scheduleTemplateLeaveTypesByTemplateId.get(template.id) ?? [],
    })),
    officialHolidays: officialHolidayRows.map(mapOfficialHoliday),
  }
}

async function insertAdministrativeRequest(userId: string, currentUserName: string, payload: z.infer<typeof createRequestSchema>) {
  const supabase = createSupabaseAdminClient()

  if (payload.requestType === "leave") {
    const leaveTypeBalance = await safeMaybeSingle<LeaveTypeBalanceRow>(() =>
      supabase
        .from("employee_leave_type_balances")
        .select("id,user_id,leave_type_name,allowed_days,used_days,sort_order")
        .eq("id", payload.leaveTypeBalanceId ?? "")
        .eq("user_id", userId)
        .maybeSingle(),
    )

    if (!leaveTypeBalance) {
      return { message: "نوع الإجازة المحدد غير موجود لهذا الموظف" }
    }
  }

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
    leave_type_balance_id: payload.requestType === "leave" ? payload.leaveTypeBalanceId ?? null : null,
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
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time")
        .eq("user_id", userId),
    )
    const balance = mapLeaveBalance(existingBalanceRows[0], userId)
    const [templatePeriods, attendanceOverrides, officialHolidayRows] = await Promise.all([
      loadScheduleTemplatePeriods(balance.scheduleTemplateId),
      loadAttendancePeriodOverrides(userId),
      safeSelect<OfficialHolidayRow>(() =>
        supabase
          .from("official_holidays")
          .select("id,name,start_date,end_date,created_at")
          .lte("start_date", workDate)
          .gte("end_date", workDate),
      ),
    ])
    const isOfficialHoliday = officialHolidayRows.some((holiday) => holiday.start_date <= workDate && holiday.end_date >= workDate)
    const expectedSchedule = resolveAttendanceScheduleForDate(
      templatePeriods,
      attendanceOverrides,
      workDate,
      balance.workStartTime || workLocation.work_start_time || DEFAULT_WORK_START_TIME,
      balance.workEndTime || DEFAULT_WORK_END_TIME,
    )
    const currentClockMinutes = getSaudiClockMinutes(now)
    const configuredWorkStartMinutes = expectedSchedule.startMinutes ?? parseTimeToMinutes(workLocation.work_start_time) ?? DEFAULT_WORK_START_MINUTES
    const lateMinutes = isOfficialHoliday || hasAttendanceForDay ? 0 : Math.max(0, currentClockMinutes - configuredWorkStartMinutes - Math.max(0, balance.lateGraceMinutes))

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
          monthly_salary: balance.monthlySalary,
          weekly_required_minutes: balance.weeklyRequiredMinutes,
          late_grace_minutes: balance.lateGraceMinutes,
          schedule_template_id: balance.scheduleTemplateId,
          work_start_time: balance.workStartTime,
          work_end_time: balance.workEndTime,
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

    await syncMonthlyDeductionsForAttendance(userId, balance, workDate).catch(() => undefined)

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

  const existingBalanceRows = await safeSelect<LeaveBalanceRow>(() =>
    supabase
      .from("employee_leave_balances")
      .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time")
      .eq("user_id", userId),
  )
  const balance = mapLeaveBalance(existingBalanceRows[0], userId)

  await syncMonthlyDeductionsForAttendance(userId, balance, workDate).catch(() => undefined)

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

  if (parsed.data.action === "save_schedule_template") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه إدارة قوالب الدوام" }, { status: 403 })
    }

    const templatePayload = parsed.data
    const normalizedPeriods = templatePayload.periods
      .map((period, index) => ({
        ...period,
        sortOrder: index,
      }))
      .sort((left, right) => left.weekday - right.weekday || left.sortOrder - right.sortOrder)

    for (const period of normalizedPeriods) {
      const startMinutes = parseTimeInputToMinutes(period.startTime)
      const endMinutes = parseTimeInputToMinutes(period.endTime)

      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
        return NextResponse.json({ error: "كل فترة دوام يجب أن تكون من وقت صحيح إلى وقت لاحق له" }, { status: 400 })
      }
    }

    let templateId = templatePayload.templateId ?? null

    if (templateId) {
      const { error: updateTemplateError } = await supabase
        .from("attendance_schedule_templates")
        .update({
          name: templatePayload.name,
          description: templatePayload.description,
          late_quota_minutes: templatePayload.lateQuotaMinutes,
          permission_quota_minutes: templatePayload.permissionQuotaMinutes,
          weekly_required_minutes: templatePayload.weeklyRequiredMinutes,
          work_start_time: templatePayload.workStartTime,
          work_end_time: templatePayload.workEndTime,
          updated_at: new Date().toISOString(),
        })
        .eq("id", templateId)

      if (updateTemplateError) {
        if (isSchemaMissing(updateTemplateError)) {
          return schemaResponse()
        }

        return NextResponse.json({ error: updateTemplateError.message }, { status: 400 })
      }

      const { error: deletePeriodsError } = await supabase
        .from("attendance_schedule_template_periods")
        .delete()
        .eq("template_id", templateId)

      if (deletePeriodsError) {
        if (isSchemaMissing(deletePeriodsError)) {
          return schemaResponse()
        }

        return NextResponse.json({ error: deletePeriodsError.message }, { status: 400 })
      }

      const { error: deleteLeaveTypesError } = await supabase
        .from("attendance_schedule_template_leave_types")
        .delete()
        .eq("template_id", templateId)

      if (deleteLeaveTypesError) {
        if (isSchemaMissing(deleteLeaveTypesError)) {
          return schemaResponse()
        }

        return NextResponse.json({ error: deleteLeaveTypesError.message }, { status: 400 })
      }
    } else {
      const { data: insertedTemplate, error: insertTemplateError } = await supabase
        .from("attendance_schedule_templates")
        .insert({
          name: templatePayload.name,
          description: templatePayload.description,
          late_quota_minutes: templatePayload.lateQuotaMinutes,
          permission_quota_minutes: templatePayload.permissionQuotaMinutes,
          weekly_required_minutes: templatePayload.weeklyRequiredMinutes,
          work_start_time: templatePayload.workStartTime,
          work_end_time: templatePayload.workEndTime,
          created_by: user.id,
        })
        .select("id")
        .maybeSingle<{ id: string }>()

      if (insertTemplateError || !insertedTemplate?.id) {
        if (isSchemaMissing(insertTemplateError)) {
          return schemaResponse()
        }

        return NextResponse.json({ error: insertTemplateError?.message ?? "تعذر إنشاء قالب الدوام" }, { status: 400 })
      }

      templateId = insertedTemplate.id
    }

    const { error: insertPeriodsError } = await supabase
      .from("attendance_schedule_template_periods")
      .insert(normalizedPeriods.map((period) => ({
        template_id: templateId,
        weekday: period.weekday,
        start_time: period.startTime,
        end_time: period.endTime,
        sort_order: period.sortOrder,
      })))

    if (insertPeriodsError) {
      if (isSchemaMissing(insertPeriodsError)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: insertPeriodsError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, templateId })
  }

  if (parsed.data.action === "delete_schedule_template") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه حذف قوالب الدوام" }, { status: 403 })
    }

    const { error } = await supabase
      .from("attendance_schedule_templates")
      .delete()
      .eq("id", parsed.data.templateId)

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

  if (parsed.data.action === "save_employee_period_override") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه إضافة فترة خاصة للموظف" }, { status: 403 })
    }

    const startMinutes = parseTimeInputToMinutes(parsed.data.startTime)
    const endMinutes = parseTimeInputToMinutes(parsed.data.endTime)

    if (!isValidDateInput(parsed.data.overrideDate) || startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      return NextResponse.json({ error: "بيانات الفترة الخاصة غير صالحة" }, { status: 400 })
    }

    const { error } = await supabase.from("employee_attendance_period_overrides").insert({
      user_id: parsed.data.userId,
      override_date: parsed.data.overrideDate,
      weekday: null,
      start_time: parsed.data.startTime,
      end_time: parsed.data.endTime,
      is_removed: false,
      note: parsed.data.note,
      created_by: user.id,
    })

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const balanceRow = await safeMaybeSingle<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time")
        .eq("user_id", parsed.data.userId)
        .maybeSingle(),
    )

    await syncMonthlyDeductionsForAttendance(parsed.data.userId, mapLeaveBalance(balanceRow ?? undefined, parsed.data.userId), parsed.data.overrideDate).catch(() => undefined)

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "delete_employee_period_override") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه حذف الفترات الخاصة" }, { status: 403 })
    }

    const existingOverride = await safeMaybeSingle<AttendancePeriodOverrideRow>(() =>
      supabase
        .from("employee_attendance_period_overrides")
        .select("id,user_id,override_date,weekday,start_time,end_time,is_removed,note")
        .eq("id", parsed.data.overrideId)
        .maybeSingle(),
    )

    if (!existingOverride) {
      return NextResponse.json({ error: "الفترة الخاصة لم تعد موجودة" }, { status: 404 })
    }

    const { error } = await supabase
      .from("employee_attendance_period_overrides")
      .delete()
      .eq("id", parsed.data.overrideId)

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const balanceRow = await safeMaybeSingle<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time")
        .eq("user_id", existingOverride.user_id)
        .maybeSingle(),
    )

    await syncMonthlyDeductionsForAttendance(existingOverride.user_id, mapLeaveBalance(balanceRow ?? undefined, existingOverride.user_id), existingOverride.override_date ?? getSaudiDateKey()).catch(() => undefined)

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "save_official_holiday") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه إدارة الإجازات الرسمية" }, { status: 403 })
    }

    if (!isValidDateInput(parsed.data.startDate) || !isValidDateInput(parsed.data.endDate) || parsed.data.endDate < parsed.data.startDate) {
      return NextResponse.json({ error: "تواريخ الإجازة الرسمية غير صالحة" }, { status: 400 })
    }

    const payload = {
      name: parsed.data.name,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      created_by: user.id,
    }

    const { error } = parsed.data.holidayId
      ? await supabase.from("official_holidays").update(payload).eq("id", parsed.data.holidayId)
      : await supabase.from("official_holidays").insert(payload)

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "delete_official_holiday") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه حذف الإجازات الرسمية" }, { status: 403 })
    }

    const { error } = await supabase
      .from("official_holidays")
      .delete()
      .eq("id", parsed.data.holidayId)

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "update_attendance_settings") {
    const attendancePayload = parsed.data

    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه تحديث إعدادات الحضور" }, { status: 403 })
    }

    const targetUserIds = attendancePayload.userId === "all_accounts"
      ? await safeSelect<UserRow>(() =>
          supabase
            .from("app_users")
            .select("id,full_name,phone,email,role,created_at")
            .order("created_at", { ascending: true }),
        ).then((rows) => rows.map((row) => row.id))
      : [attendancePayload.userId]

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "لا توجد حسابات متاحة لتحديث إعدادات الحضور" }, { status: 400 })
    }

    const existingRows = await safeSelect<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time")
        .in("user_id", targetUserIds),
    )
    const balancesByUserId = new Map(existingRows.map((row) => [row.user_id, row]))

    const { error } = await supabase.from("employee_leave_balances").upsert(
      targetUserIds.map((targetUserId) => {
        const currentBalance = mapLeaveBalance(balancesByUserId.get(targetUserId), targetUserId)

        return {
          user_id: targetUserId,
          leave_quota_days: currentBalance.leaveQuotaDays,
          leave_taken_days: currentBalance.leaveTakenDays,
          allowance_total_days: currentBalance.lateQuotaMinutes,
          allowance_used_days: currentBalance.lateUsedMinutes,
          permission_quota_count: currentBalance.permissionQuotaMinutes,
          permission_used_count: currentBalance.permissionUsedMinutes,
          monthly_salary: attendancePayload.monthlySalary,
          weekly_required_minutes: attendancePayload.weeklyRequiredMinutes,
          late_grace_minutes: attendancePayload.lateGraceMinutes,
          schedule_template_id: attendancePayload.scheduleTemplateId,
          work_start_time: attendancePayload.workStartTime,
          work_end_time: attendancePayload.workEndTime,
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

    if (attendancePayload.periodOverrides) {
      const uniquePeriodOverrides = attendancePayload.periodOverrides.flatMap((period) => {
        const startMinutes = parseTimeInputToMinutes(period.startTime)
        const endMinutes = parseTimeInputToMinutes(period.endTime)

        if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
          return [null]
        }

        return [...new Set(period.weekdays)].map((weekday) => ({
          weekday,
          startTime: period.startTime,
          endTime: period.endTime,
        }))
      })

      if (uniquePeriodOverrides.some((period) => period === null)) {
        return NextResponse.json({ error: "بيانات الفترات الأسبوعية غير صالحة" }, { status: 400 })
      }

      const normalizedPeriodOverrides = Array.from(
        new Map(
          uniquePeriodOverrides.map((period) => [`${period!.weekday}-${period!.startTime}-${period!.endTime}`, period!]),
        ).values(),
      )

      for (const targetUserId of targetUserIds) {
        const { error: deleteError } = await supabase
          .from("employee_attendance_period_overrides")
          .delete()
          .eq("user_id", targetUserId)
          .is("override_date", null)

        if (deleteError) {
          if (isSchemaMissing(deleteError)) {
            return schemaResponse()
          }

          return NextResponse.json({ error: deleteError.message }, { status: 400 })
        }

        if (normalizedPeriodOverrides.length > 0) {
          const { error: insertError } = await supabase
            .from("employee_attendance_period_overrides")
            .insert(normalizedPeriodOverrides.map((period) => ({
              user_id: targetUserId,
              override_date: null,
              weekday: period.weekday,
              start_time: period.startTime,
              end_time: period.endTime,
              is_removed: false,
              note: "",
              created_by: user.id,
            })))

          if (insertError) {
            if (isSchemaMissing(insertError)) {
              return schemaResponse()
            }

            return NextResponse.json({ error: insertError.message }, { status: 400 })
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "update_balance") {
    const balancePayload = parsed.data

    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه تحديث الأرصدة" }, { status: 403 })
    }

    const targetUserIds = balancePayload.userId === "all_accounts"
      ? await safeSelect<UserRow>(() =>
          supabase
            .from("app_users")
            .select("id,full_name,phone,email,role,created_at")
            .order("created_at", { ascending: true }),
        ).then((rows) => rows.map((row) => row.id))
          : [balancePayload.userId]

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "لا توجد حسابات متاحة لتحديث الأرصدة" }, { status: 400 })
    }

    const existingRows = await safeSelect<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time")
        .in("user_id", targetUserIds),
    )
    const balancesByUserId = new Map(existingRows.map((row) => [row.user_id, row]))

    const { error } = await supabase.from("employee_leave_balances").upsert(
      targetUserIds.map((targetUserId) => {
        const currentBalance = mapLeaveBalance(balancesByUserId.get(targetUserId), targetUserId)

        return {
          user_id: targetUserId,
          leave_quota_days: balancePayload.leaveQuotaDays,
          leave_taken_days: currentBalance.leaveTakenDays,
          allowance_total_days: balancePayload.lateQuotaMinutes,
          allowance_used_days: currentBalance.lateUsedMinutes,
          permission_quota_count: balancePayload.permissionQuotaMinutes,
          permission_used_count: currentBalance.permissionUsedMinutes,
          monthly_salary: balancePayload.monthlySalary,
          weekly_required_minutes: balancePayload.weeklyRequiredMinutes,
          late_grace_minutes: balancePayload.lateGraceMinutes,
          schedule_template_id: balancePayload.scheduleTemplateId,
          work_start_time: balancePayload.workStartTime,
          work_end_time: balancePayload.workEndTime,
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

    if (parsed.data.leaveTypes) {
      for (const targetUserId of targetUserIds) {
        const replaceError = await replaceEmployeeLeaveTypes(supabase, targetUserId, parsed.data.leaveTypes)

        if (replaceError) {
          if (isSchemaMissing(replaceError)) {
            return schemaResponse()
          }

          return NextResponse.json({ error: replaceError.message }, { status: 400 })
        }

        const currentBalance = mapLeaveBalance(balancesByUserId.get(targetUserId), targetUserId)
        const syncError = await syncLeaveTypeAggregateBalance(supabase, targetUserId, user.id, {
          ...currentBalance,
          leaveQuotaDays: balancePayload.leaveQuotaDays,
          monthlySalary: balancePayload.monthlySalary,
          weeklyRequiredMinutes: balancePayload.weeklyRequiredMinutes,
          lateGraceMinutes: balancePayload.lateGraceMinutes,
          scheduleTemplateId: balancePayload.scheduleTemplateId,
          workStartTime: balancePayload.workStartTime,
          workEndTime: balancePayload.workEndTime,
          lateQuotaMinutes: balancePayload.lateQuotaMinutes,
          permissionQuotaMinutes: balancePayload.permissionQuotaMinutes,
        })

        if (syncError) {
          if (isSchemaMissing(syncError)) {
            return schemaResponse()
          }

          return NextResponse.json({ error: syncError.message }, { status: 400 })
        }
      }
    }

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "update_general_balances") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه تحديث الأرصدة العامة" }, { status: 403 })
    }

    const targetUserIds = await safeSelect<UserRow>(() =>
      supabase
        .from("app_users")
        .select("id,full_name,phone,email,role,created_at")
        .order("created_at", { ascending: true }),
    ).then((rows) => rows.map((row) => row.id))

    if (targetUserIds.length === 0) {
      return NextResponse.json({ error: "لا توجد حسابات متاحة لتحديث الأرصدة العامة" }, { status: 400 })
    }

    const existingRows = await safeSelect<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time")
        .in("user_id", targetUserIds),
    )
    const balancesByUserId = new Map(existingRows.map((row) => [row.user_id, row]))

    const { error } = await supabase.from("employee_leave_balances").upsert(
      targetUserIds.map((targetUserId) => {
        const currentBalance = mapLeaveBalance(balancesByUserId.get(targetUserId), targetUserId)

        return {
          user_id: targetUserId,
          leave_quota_days: parsed.data.leaveQuotaDays ?? currentBalance.leaveQuotaDays,
          leave_taken_days: currentBalance.leaveTakenDays,
          allowance_total_days: parsed.data.lateQuotaMinutes ?? currentBalance.lateQuotaMinutes,
          allowance_used_days: currentBalance.lateUsedMinutes,
          permission_quota_count: parsed.data.permissionQuotaMinutes ?? currentBalance.permissionQuotaMinutes,
          permission_used_count: currentBalance.permissionUsedMinutes,
          monthly_salary: currentBalance.monthlySalary,
          weekly_required_minutes: currentBalance.weeklyRequiredMinutes,
          late_grace_minutes: parsed.data.lateGraceMinutes ?? currentBalance.lateGraceMinutes,
          schedule_template_id: currentBalance.scheduleTemplateId,
          work_start_time: currentBalance.workStartTime,
          work_end_time: currentBalance.workEndTime,
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

    if (parsed.data.leaveTypes) {
      for (const targetUserId of targetUserIds) {
        const replaceError = await replaceEmployeeLeaveTypes(supabase, targetUserId, parsed.data.leaveTypes)

        if (replaceError) {
          if (isSchemaMissing(replaceError)) {
            return schemaResponse()
          }

          return NextResponse.json({ error: replaceError.message }, { status: 400 })
        }

        const currentBalance = mapLeaveBalance(balancesByUserId.get(targetUserId), targetUserId)
        const syncError = await syncLeaveTypeAggregateBalance(supabase, targetUserId, user.id, {
          ...currentBalance,
          leaveQuotaDays: parsed.data.leaveQuotaDays ?? currentBalance.leaveQuotaDays,
          lateQuotaMinutes: parsed.data.lateQuotaMinutes ?? currentBalance.lateQuotaMinutes,
          permissionQuotaMinutes: parsed.data.permissionQuotaMinutes ?? currentBalance.permissionQuotaMinutes,
          lateGraceMinutes: parsed.data.lateGraceMinutes ?? currentBalance.lateGraceMinutes,
        })

        if (syncError) {
          if (isSchemaMissing(syncError)) {
            return schemaResponse()
          }

          return NextResponse.json({ error: syncError.message }, { status: 400 })
        }
      }
    }

    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "save_leave_types") {
    if (!user.permissions.includes("*")) {
      return NextResponse.json({ error: "فقط مدير النظام يمكنه إدارة أنواع الإجازات" }, { status: 403 })
    }

    const existingLeaveTypes = await safeSelect<LeaveTypeBalanceRow>(() =>
      supabase
        .from("employee_leave_type_balances")
        .select("id,user_id,leave_type_name,allowed_days,used_days,sort_order")
        .eq("user_id", parsed.data.userId),
    )
    const existingById = new Map(existingLeaveTypes.map((row) => [row.id, row]))
    const retainedIds = parsed.data.leaveTypes.flatMap((leaveType) => leaveType.id ? [leaveType.id] : [])
    const deleteIds = existingLeaveTypes.filter((row) => !retainedIds.includes(row.id)).map((row) => row.id)

    if (deleteIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("employee_leave_type_balances")
        .delete()
        .in("id", deleteIds)

      if (deleteError) {
        if (isSchemaMissing(deleteError)) {
          return schemaResponse()
        }

        return NextResponse.json({ error: deleteError.message }, { status: 400 })
      }
    }

    if (parsed.data.leaveTypes.length > 0) {
      const { error: upsertError } = await supabase.from("employee_leave_type_balances").upsert(
        parsed.data.leaveTypes.map((leaveType, index) => ({
          ...(leaveType.id ? { id: leaveType.id } : {}),
          user_id: parsed.data.userId,
          leave_type_name: leaveType.name,
          allowed_days: leaveType.allowedDays,
          used_days: existingById.get(leaveType.id ?? "")?.used_days ?? 0,
          sort_order: index,
        })),
        { onConflict: "id" },
      )

      if (upsertError) {
        if (isSchemaMissing(upsertError)) {
          return schemaResponse()
        }

        return NextResponse.json({ error: upsertError.message }, { status: 400 })
      }
    }

    const currentBalanceRow = await safeMaybeSingle<LeaveBalanceRow>(() =>
      supabase
        .from("employee_leave_balances")
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time")
        .eq("user_id", parsed.data.userId)
        .maybeSingle(),
    )

    const syncError = await syncLeaveTypeAggregateBalance(
      supabase,
      parsed.data.userId,
      user.id,
      mapLeaveBalance(currentBalanceRow ?? undefined, parsed.data.userId),
    )

    if (syncError) {
      if (isSchemaMissing(syncError)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: syncError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  if (!user.permissions.includes("*")) {
    return NextResponse.json({ error: "فقط مدير النظام يمكنه اعتماد الطلبات" }, { status: 403 })
  }

  const { data: row, error: rowError } = await supabase
    .from("administrative_requests")
    .select("id,user_id,request_type,status,start_date,end_date,leave_allocation_type,leave_type_balance_id,from_time,to_time")
    .eq("id", parsed.data.requestId)
    .maybeSingle<{
      id: string
      user_id: string
      request_type: "leave" | "permission" | "financial" | "general" | "internal_transaction"
      status: "pending" | "approved" | "rejected" | "cancelled"
      start_date: string | null
      end_date: string | null
      leave_allocation_type: "leave_balance" | "allowance" | null
      leave_type_balance_id: string | null
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
        .select("user_id,leave_quota_days,leave_taken_days,allowance_total_days,allowance_used_days,permission_quota_count,permission_used_count,monthly_salary,weekly_required_minutes,late_grace_minutes,schedule_template_id,work_start_time,work_end_time")
        .eq("user_id", row.user_id),
    )
    const balance = mapLeaveBalance(existingRows[0], row.user_id)

    if (row.request_type === "leave") {
      const officialHolidayRows = row.start_date && row.end_date
        ? await safeSelect<OfficialHolidayRow>(() =>
          supabase
            .from("official_holidays")
            .select("id,name,start_date,end_date,created_at")
            .lte("start_date", row.end_date)
            .gte("end_date", row.start_date),
        )
        : []
      const requestedDays = row.start_date && row.end_date
        ? calculateLeaveDaysExcludingOfficialHolidays(row.start_date, row.end_date, officialHolidayRows)
        : 0
      if (requestedDays <= 0) {
        return NextResponse.json({ error: "الفترة المطلوبة تقع بالكامل داخل إجازة رسمية أو أن التواريخ غير صحيحة" }, { status: 400 })
      }

      const leaveTypeRows = await safeSelect<LeaveTypeBalanceRow>(() =>
        supabase
          .from("employee_leave_type_balances")
          .select("id,user_id,leave_type_name,allowed_days,used_days,sort_order")
          .eq("user_id", row.user_id),
      )
      const selectedLeaveType = row.leave_type_balance_id
        ? leaveTypeRows.find((leaveTypeRow) => leaveTypeRow.id === row.leave_type_balance_id) ?? null
        : null
      const effectiveBalance = applyLeaveTypeTotals(balance, leaveTypeRows.map(mapLeaveTypeBalance))
      const remainingLeave = selectedLeaveType
        ? selectedLeaveType.allowed_days - selectedLeaveType.used_days
        : effectiveBalance.leaveQuotaDays - effectiveBalance.leaveTakenDays

      if (remainingLeave < requestedDays) {
        return NextResponse.json({ error: "رصيد الإجازات المتبقي لا يكفي لاعتماد الطلب" }, { status: 400 })
      }

      if (row.leave_type_balance_id) {
        if (!selectedLeaveType) {
          return NextResponse.json({ error: "نوع الإجازة المرتبط بالطلب لم يعد موجودًا" }, { status: 400 })
        }

        const { error: leaveTypeUpdateError } = await supabase
          .from("employee_leave_type_balances")
          .update({ used_days: selectedLeaveType.used_days + requestedDays })
          .eq("id", selectedLeaveType.id)

        if (leaveTypeUpdateError) {
          return NextResponse.json({ error: leaveTypeUpdateError.message }, { status: 400 })
        }

        const syncError = await syncLeaveTypeAggregateBalance(supabase, row.user_id, user.id, balance)

        if (syncError) {
          return NextResponse.json({ error: syncError.message }, { status: 400 })
        }
      } else {
        const { error } = await supabase.from("employee_leave_balances").upsert(
          {
            user_id: row.user_id,
            leave_quota_days: balance.leaveQuotaDays,
            leave_taken_days: balance.leaveTakenDays + requestedDays,
            allowance_total_days: balance.lateQuotaMinutes,
            allowance_used_days: balance.lateUsedMinutes,
            permission_quota_count: balance.permissionQuotaMinutes,
            permission_used_count: balance.permissionUsedMinutes,
            monthly_salary: balance.monthlySalary,
            weekly_required_minutes: balance.weeklyRequiredMinutes,
            late_grace_minutes: balance.lateGraceMinutes,
            schedule_template_id: balance.scheduleTemplateId,
            work_start_time: balance.workStartTime,
            work_end_time: balance.workEndTime,
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
          work_end_time: balance.workEndTime,
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
