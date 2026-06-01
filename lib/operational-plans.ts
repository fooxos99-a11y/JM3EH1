export const operationalPlanRecurrenceValues = ["weekly", "monthly", "quarterly", "semiannual", "annual"] as const
export const operationalPlanOccurrenceStatusValues = ["pending", "completed"] as const

export type OperationalPlanRecurrence = (typeof operationalPlanRecurrenceValues)[number]
export type OperationalPlanOccurrenceStatus = (typeof operationalPlanOccurrenceStatusValues)[number]
export type OperationalPlanDistributionMode = "automatic" | "manual"

export type OperationalPlanOccurrenceRecord = {
  id: string
  planId: string
  monthNumber: number
  sequenceNumber: number
  label: string
  dueAt: string
  targetValue: number
  achievedValue: number
  progressPercentage: number
  status: OperationalPlanOccurrenceStatus
  completedAt: string | null
}

export type OperationalPlanRecord = {
  id: string
  title: string
  description: string
  year: number
  annualTarget: number
  achievedTotal: number
  targetCount: number
  completedCount: number
  progressPercentage: number
  ownerUserId: string | null
  ownerUserName: string
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
  occurrences: OperationalPlanOccurrenceRecord[]
}

export type OperationalPlanAssignableUser = {
  id: string
  name: string
}

export type OperationalPlansPageData = {
  isManager: boolean
  currentUserId: string
  plans: OperationalPlanRecord[]
  assignableUsers: OperationalPlanAssignableUser[]
}

export function getOperationalPlanTargetCount(recurrence: OperationalPlanRecurrence) {
  void recurrence
  return 12
}

export function getOperationalPlanRecurrenceLabel(recurrence: OperationalPlanRecurrence) {
  switch (recurrence) {
    case "weekly":
      return "أسبوعي"
    case "monthly":
      return "شهري"
    case "quarterly":
      return "ربع سنوي"
    case "semiannual":
      return "نصف سنوي"
    case "annual":
      return "سنوي"
    default:
      return "سنوي"
  }
}

export function getOperationalPlanStatusLabel(progressPercentage: number) {
  if (progressPercentage >= 100) {
    return "مكتملة"
  }

  if (progressPercentage <= 0) {
    return "لم تبدأ"
  }

  return "جارية"
}

export function normalizeOperationalPlanProgressPercentage(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.min(100, Math.max(0, Math.round(value)))
}

export function normalizeOperationalPlanCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.round(value))
}

export function calculateOperationalPlanProgress(achievedValue: number, targetValue: number) {
  const normalizedAchievedValue = normalizeOperationalPlanCount(achievedValue)
  const normalizedTargetValue = normalizeOperationalPlanCount(targetValue)

  if (normalizedTargetValue <= 0) {
    return normalizedAchievedValue > 0 ? 100 : 0
  }

  return normalizeOperationalPlanProgressPercentage((normalizedAchievedValue / normalizedTargetValue) * 100)
}

export function getOperationalPlanOccurrenceStatus(progressPercentage: number): OperationalPlanOccurrenceStatus {
  return normalizeOperationalPlanProgressPercentage(progressPercentage) >= 100 ? "completed" : "pending"
}

export function getOperationalPlanMonthLabel(value: string | Date, month: "long" | "short" = "long") {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { month, timeZone: "UTC" }).format(typeof value === "string" ? new Date(value) : value)
}

export function getOperationalPlanPeriodRange(recurrence: OperationalPlanRecurrence, sequenceNumber: number) {
  void recurrence
  return { startMonth: sequenceNumber, endMonth: sequenceNumber }
}

export function buildOperationalPlanDistribution(annualTarget: number) {
  const normalizedAnnualTarget = normalizeOperationalPlanCount(annualTarget)

  return Array.from({ length: 12 }, (_, index) => {
    const current = Math.round(((index + 1) * normalizedAnnualTarget) / 12)
    const previous = Math.round((index * normalizedAnnualTarget) / 12)
    return current - previous
  })
}

export function normalizeOperationalPlanMonthlyTargets(values: number[] | null | undefined) {
  return Array.from({ length: 12 }, (_, index) => normalizeOperationalPlanCount(values?.[index] ?? 0))
}

export function buildOperationalPlanOccurrences(year: number, annualTarget: number, monthlyTargets?: number[] | null) {
  const distribution = monthlyTargets ? normalizeOperationalPlanMonthlyTargets(monthlyTargets) : buildOperationalPlanDistribution(annualTarget)

  return Array.from({ length: 12 }, (_, index) => {
    const sequenceNumber = index + 1
    const dueAt = getOperationalPlanOccurrenceDate(year, sequenceNumber)
    const targetValue = distribution[index] ?? 0
    const achievedValue = 0
    const progressPercentage = calculateOperationalPlanProgress(achievedValue, targetValue)

    return {
      sequenceNumber,
      label: getOperationalPlanOccurrenceLabel(sequenceNumber, dueAt),
      dueAt: dueAt.toISOString(),
      targetValue,
      achievedValue,
      progressPercentage,
      status: getOperationalPlanOccurrenceStatus(progressPercentage),
      completedAt: null,
    }
  })
}

function getOperationalPlanOccurrenceDate(year: number, sequenceNumber: number) {
  return new Date(Date.UTC(year, sequenceNumber, 0, 23, 59, 0))
}

function getOperationalPlanOccurrenceLabel(sequenceNumber: number, dueAt: Date) {
  return `${getOperationalPlanMonthLabel(dueAt)} (${sequenceNumber})`
}