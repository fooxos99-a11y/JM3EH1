export const operationalPlanRecurrenceValues = ["weekly", "monthly", "quarterly", "semiannual", "annual"] as const
export const operationalPlanOccurrenceStatusValues = ["pending", "completed"] as const

export type OperationalPlanRecurrence = (typeof operationalPlanRecurrenceValues)[number]
export type OperationalPlanOccurrenceStatus = (typeof operationalPlanOccurrenceStatusValues)[number]

export type OperationalPlanOccurrenceRecord = {
  id: string
  planId: string
  sequenceNumber: number
  label: string
  dueAt: string
  status: OperationalPlanOccurrenceStatus
  completedAt: string | null
}

export type OperationalPlanRecord = {
  id: string
  title: string
  description: string
  year: number
  recurrence: OperationalPlanRecurrence
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
  switch (recurrence) {
    case "weekly":
      return 52
    case "monthly":
      return 12
    case "quarterly":
      return 4
    case "semiannual":
      return 2
    case "annual":
      return 1
    default:
      return 1
  }
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

export function buildOperationalPlanOccurrences(year: number, recurrence: OperationalPlanRecurrence) {
  const targetCount = getOperationalPlanTargetCount(recurrence)

  return Array.from({ length: targetCount }, (_, index) => {
    const sequenceNumber = index + 1
    const dueAt = getOperationalPlanOccurrenceDate(year, recurrence, index)

    return {
      sequenceNumber,
      label: getOperationalPlanOccurrenceLabel(recurrence, sequenceNumber, dueAt),
      dueAt: dueAt.toISOString(),
      status: "pending" as const,
      completedAt: null,
    }
  })
}

function getOperationalPlanOccurrenceDate(year: number, recurrence: OperationalPlanRecurrence, index: number) {
  switch (recurrence) {
    case "weekly": {
      const date = new Date(Date.UTC(year, 0, 1))
      date.setUTCDate(date.getUTCDate() + (index * 7))
      return date
    }
    case "monthly":
      return new Date(Date.UTC(year, index, 1))
    case "quarterly":
      return new Date(Date.UTC(year, index * 3, 1))
    case "semiannual":
      return new Date(Date.UTC(year, index * 6, 1))
    case "annual":
      return new Date(Date.UTC(year, 0, 1))
    default:
      return new Date(Date.UTC(year, 0, 1))
  }
}

function getOperationalPlanOccurrenceLabel(recurrence: OperationalPlanRecurrence, sequenceNumber: number, dueAt: Date) {
  switch (recurrence) {
    case "weekly":
      return `الأسبوع ${sequenceNumber}`
    case "monthly":
      return new Intl.DateTimeFormat("ar-SA", { month: "long" }).format(dueAt)
    case "quarterly":
      return `الربع ${sequenceNumber}`
    case "semiannual":
      return `النصف ${sequenceNumber}`
    case "annual":
      return `العام ${dueAt.getUTCFullYear()}`
    default:
      return `الدورة ${sequenceNumber}`
  }
}