import { z } from "zod"

export const operationalPlanWeekEndDayValues = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const

export type OperationalPlanWeekEndDay = (typeof operationalPlanWeekEndDayValues)[number]

export const operationalPlanWeekEndDaySchema = z.enum(operationalPlanWeekEndDayValues)

export const defaultOperationalPlanWeekEndDay: OperationalPlanWeekEndDay = "tuesday"

export const operationalPlanWeekEndDayLabels: Record<OperationalPlanWeekEndDay, string> = {
  sunday: "الأحد",
  monday: "الاثنين",
  tuesday: "الثلاثاء",
  wednesday: "الأربعاء",
  thursday: "الخميس",
  friday: "الجمعة",
  saturday: "السبت",
}

export function getOperationalPlanWeekEndUtcDay(value: OperationalPlanWeekEndDay) {
  switch (value) {
    case "sunday":
      return 0
    case "monday":
      return 1
    case "tuesday":
      return 2
    case "wednesday":
      return 3
    case "thursday":
      return 4
    case "friday":
      return 5
    case "saturday":
      return 6
    default:
      return 2
  }
}

export function getWeekBoundaryOnOrAfter(startDate: Date, weekEndDay: OperationalPlanWeekEndDay, monthEnd: Date) {
  const boundary = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate(), 23, 59, 0))
  const targetDay = getOperationalPlanWeekEndUtcDay(weekEndDay)

  while (boundary.getUTCDay() !== targetDay && boundary.getTime() < monthEnd.getTime()) {
    boundary.setUTCDate(boundary.getUTCDate() + 1)
  }

  if (boundary.getTime() > monthEnd.getTime()) {
    return new Date(monthEnd)
  }

  return boundary
}

export function countWeekSegmentsInMonth(year: number, month: number, weekEndDay: OperationalPlanWeekEndDay) {
  const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0))
  const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 0))
  let segments = 0
  let currentStart = monthStart

  while (currentStart.getTime() <= monthEnd.getTime()) {
    segments += 1
    const boundary = getWeekBoundaryOnOrAfter(currentStart, weekEndDay, monthEnd)
    currentStart = new Date(Date.UTC(boundary.getUTCFullYear(), boundary.getUTCMonth(), boundary.getUTCDate() + 1, 0, 0, 0))
  }

  return segments
}