export type WeeklyAchievementEntry = {
  id: string
  userId: string
  userName: string
  weekStartDate: string
  weekEndDate: string
  achievementText: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export type EmployeeWeeklyAchievementGroup = {
  userId: string
  userName: string
  entries: WeeklyAchievementEntry[]
}

export type AchievementsPageData = {
  currentUserId: string
  isManager: boolean
  selectedWeekStartDate: string
  selectedWeekEndDate: string
  currentWeekStartDate: string
  currentWeekEndDate: string
  myEntries: WeeklyAchievementEntry[]
  teamGroups: EmployeeWeeklyAchievementGroup[]
}

export function startOfWeekMonday(input: Date) {
  const date = new Date(input)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  return date
}

export function endOfWeekMonday(input: Date) {
  const start = startOfWeekMonday(input)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

export function formatDateInput(value: Date) {
  const year = value.getFullYear()
  const month = `${value.getMonth() + 1}`.padStart(2, "0")
  const day = `${value.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function getWeekRangeFromStartDate(startDate: string) {
  const parsed = new Date(`${startDate}T00:00:00`)
  const weekStart = startOfWeekMonday(parsed)
  const weekEnd = endOfWeekMonday(parsed)

  return {
    weekStartDate: formatDateInput(weekStart),
    weekEndDate: formatDateInput(weekEnd),
  }
}
