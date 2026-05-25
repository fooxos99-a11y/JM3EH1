export const employeeGenderValues = ["male", "female"] as const
export const maritalStatusValues = ["single", "married", "divorced", "widowed"] as const
export const administrativeRequestTypeValues = ["leave", "permission", "financial", "general", "internal_transaction"] as const
export const administrativeRequestStatusValues = ["pending", "approved", "rejected", "cancelled"] as const
export const leaveAllocationTypeValues = ["leave_balance", "allowance"] as const

export type EmployeeGender = (typeof employeeGenderValues)[number]
export type MaritalStatus = (typeof maritalStatusValues)[number]
export type AdministrativeRequestType = (typeof administrativeRequestTypeValues)[number]
export type AdministrativeRequestStatus = (typeof administrativeRequestStatusValues)[number]
export type LeaveAllocationType = (typeof leaveAllocationTypeValues)[number]

export type EmployeeProfile = {
  userId: string
  nationalId: string
  birthDate: string
  gender: EmployeeGender
  maritalStatus: MaritalStatus
  jobRank: string
  createdBy: string | null
}

export type LeaveBalance = {
  userId: string
  leaveQuotaDays: number
  leaveTakenDays: number
  lateQuotaMinutes: number
  lateUsedMinutes: number
  permissionQuotaMinutes: number
  permissionUsedMinutes: number
  monthlySalary: number
  weeklyRequiredMinutes: number
  lateGraceMinutes: number
  scheduleTemplateId: string | null
  workStartTime: string
  workEndTime: string
}

export type EmployeeLeaveTypeBalance = {
  id: string
  userId: string
  name: string
  allowedDays: number
  usedDays: number
  sortOrder: number
}

export type EmployeeAttendancePeriodOverride = {
  id: string
  userId: string
  overrideDate: string | null
  weekday: number | null
  startTime: string
  endTime: string
  isRemoved: boolean
  note: string
}

export type OfficialHoliday = {
  id: string
  name: string
  startDate: string
  endDate: string
  createdAt: string
}

export type AttendanceScheduleTemplatePeriod = {
  id: string
  weekday: number
  startTime: string
  endTime: string
  sortOrder: number
}

export type AttendanceScheduleTemplateLeaveType = {
  id: string
  name: string
  allowedDays: number
  sortOrder: number
}

export type AttendanceScheduleTemplate = {
  id: string
  name: string
  description: string
  monthlySalary: number
  leaveQuotaDays: number
  lateQuotaMinutes: number
  permissionQuotaMinutes: number
  weeklyRequiredMinutes: number
  lateGraceMinutes: number
  workStartTime: string
  workEndTime: string
  periods: AttendanceScheduleTemplatePeriod[]
  leaveTypes: AttendanceScheduleTemplateLeaveType[]
}

export type MonthlyDeductionSummary = {
  year: number
  month: number
  lateMinutes: number
  earlyLeaveMinutes: number
  totalDeductionAmount: number
  isLocked: boolean
}

export type AdministrativeRequestRecord = {
  id: string
  requesterId: string
  requesterName: string
  targetUserId: string | null
  targetUserName: string | null
  requestType: AdministrativeRequestType
  status: AdministrativeRequestStatus
  subject: string
  details: string
  amountRequested: number | null
  startDate: string | null
  endDate: string | null
  requestDate: string | null
  fromTime: string | null
  toTime: string | null
  leaveAllocationType: LeaveAllocationType | null
  leaveTypeBalanceId: string | null
  leaveTypeName: string | null
  reviewedBy: string | null
  reviewerName: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  createdAt: string
  canCancel: boolean
  canReview: boolean
}

export type AdministrativeAccountSummary = {
  userId: string
  name: string
  phone: string
  email: string | null
  accountType: string
  jobTitle: string
  profile: EmployeeProfile
  leaveBalance: LeaveBalance
  leaveTypeBalances: EmployeeLeaveTypeBalance[]
  attendancePeriodOverrides: EmployeeAttendancePeriodOverride[]
  monthlyDeduction: MonthlyDeductionSummary | null
  createdAt: string
  createdByName: string | null
}

export type WorkLocationSettings = {
  id: string | null
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  radiusMeters: number
  googleMapsUrl: string
  workStartTime: string
  updatedAt: string | null
  updatedByName: string | null
  isConfigured: boolean
}

export type AttendanceRecord = {
  id: string
  userId: string
  userName: string
  workDate: string
  clockInAt: string | null
  clockOutAt: string | null
  clockInLatitude: number | null
  clockInLongitude: number | null
  clockOutLatitude: number | null
  clockOutLongitude: number | null
  workedMinutes: number
  status: "present" | "incomplete"
  notes: string | null
}

export type AttendanceDaySummary = {
  workDate: string
  clockInAt: string | null
  clockOutAt: string | null
  workedMinutes: number
  status: "present" | "incomplete"
  hasOpenSession: boolean
  sessionCount: number
}

export type WeeklyAttendanceSummary = {
  workDate: string
  firstClockInAt: string | null
  lastClockOutAt: string | null
  workedMinutes: number
}

export function getWeekdayLabel(value: string) {
  const date = new Date(`${value}T00:00:00Z`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: SAUDI_TIME_ZONE,
    weekday: "long",
  }).format(date)
}

export function toSaudiTimeInputValue(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SAUDI_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

export type AdministrativeDashboardData = {
  currentUserId: string
  currentUserName: string
  currentUserTitle: string
  isManager: boolean
  unreadReviewRequestsCount: number
  internalRecipients: Array<{ userId: string; name: string }>
  profile: EmployeeProfile
  leaveBalance: LeaveBalance
  leaveTypeBalances: EmployeeLeaveTypeBalance[]
  attendancePeriodOverrides: EmployeeAttendancePeriodOverride[]
  employmentRecord: {
    createdAt: string | null
    accountType: string
    createdByName: string | null
    jobTitle: string
    jobRank: string
  }
  workLocation: WorkLocationSettings
  monthlyDeduction: MonthlyDeductionSummary | null
  todayAttendance: AttendanceDaySummary | null
  weeklyAttendance: WeeklyAttendanceSummary[]
  attendanceHistory: AttendanceRecord[]
  allAttendanceHistory: AttendanceRecord[]
  myRequests: AdministrativeRequestRecord[]
  allRequests: AdministrativeRequestRecord[]
  reviewableRequests: AdministrativeRequestRecord[]
  accounts: AdministrativeAccountSummary[]
  scheduleTemplates: AttendanceScheduleTemplate[]
  officialHolidays: OfficialHoliday[]
}

export const SAUDI_TIME_ZONE = "Asia/Riyadh"

export function createEmptyProfile(userId = ""): EmployeeProfile {
  return {
    userId,
    nationalId: "",
    birthDate: "",
    gender: "male",
    maritalStatus: "single",
    jobRank: "",
    createdBy: null,
  }
}

export function createEmptyLeaveBalance(userId = ""): LeaveBalance {
  return {
    userId,
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
}

export function getGenderLabel(value: EmployeeGender) {
  return value === "male" ? "ذكر" : "أنثى"
}

export function getMaritalStatusLabel(value: MaritalStatus) {
  switch (value) {
    case "married":
      return "متزوج"
    case "divorced":
      return "مطلق"
    case "widowed":
      return "أرمل"
    default:
      return "أعزب"
  }
}

export function getAdministrativeRequestTypeLabel(value: AdministrativeRequestType) {
  switch (value) {
    case "internal_transaction":
      return "معاملة داخلية"
    case "leave":
      return "طلب إجازة"
    case "permission":
      return "طلب إذن"
    case "financial":
      return "طلب مالي"
    default:
      return "طلب عام"
  }
}

export function getAdministrativeRequestStatusLabel(value: AdministrativeRequestStatus) {
  switch (value) {
    case "approved":
      return "معتمد"
    case "rejected":
      return "مرفوض"
    case "cancelled":
      return "ملغي"
    default:
      return "قيد المراجعة"
  }
}

export function getLeaveAllocationTypeLabel(value: LeaveAllocationType | null) {
  if (value === "allowance") {
    return "أيام السماحية"
  }

  if (value === "leave_balance") {
    return "رصيد الإجازات"
  }

  return "-"
}

export function getAccountTypeLabel(value: string) {
  return value === "admin" ? "حساب إداري" : "حساب مستخدم"
}

export function calculateAge(birthDate: string) {
  if (!birthDate) {
    return null
  }

  const date = new Date(birthDate)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  const today = new Date()
  let age = today.getFullYear() - date.getFullYear()
  const monthDifference = today.getMonth() - date.getMonth()

  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < date.getDate())) {
    age -= 1
  }

  return age
}

export function calculateLeaveDays(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0
  }

  const differenceMs = end.getTime() - start.getTime()
  return Math.floor(differenceMs / (1000 * 60 * 60 * 24)) + 1
}

export function getDateKeysBetween(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const end = new Date(`${endDate}T00:00:00Z`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [] as string[]
  }

  const keys: string[] = []
  const cursor = new Date(start)

  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return keys
}

export function formatDate(value: string | null) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: SAUDI_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date)
}

export function formatTime(value: string | null) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: SAUDI_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "-"
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: SAUDI_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date)
}

export function formatWorkedHours(totalMinutes: number) {
  if (totalMinutes <= 0) {
    return "0 ساعة"
  }

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} دقيقة`
  }

  if (minutes === 0) {
    return `${hours} ساعة`
  }

  return `${hours} ساعة و${minutes} دقيقة`
}

export function toSaudiDateInputValue(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SAUDI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}
