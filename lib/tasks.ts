import { defaultOperationalPlanWeekEndDay, getWeekBoundaryOnOrAfter, type OperationalPlanWeekEndDay } from "@/lib/operational-plan-settings"

export const taskStatusValues = ["not_started", "in_progress", "under_review", "completed", "stalled"] as const
export const taskKindValues = ["task", "internal_transaction"] as const

export type TaskStatus = (typeof taskStatusValues)[number]
export type TaskKind = (typeof taskKindValues)[number]

export type TaskRecord = {
  id: string
  kind: TaskKind
  title: string
  description: string
  assignedToUserId: string
  assignedToName: string
  assignedByUserId: string
  assignedByName: string
  dueAt: string
  status: TaskStatus
  completedAt: string | null
  attachmentUrl: string | null
  driveFolderId: string | null
  driveFolderName: string | null
  operationalPlanId: string | null
  operationalPlanOccurrenceId: string | null
  operationalPlanTaskIndex?: number | null
  operationalPlanTaskCount?: number | null
  operationalPlanReleaseAt?: string | null
  createdAt: string
  updatedAt: string
  canUpdateStatus: boolean
}

export type TaskNotification = {
  id: string
  taskId: string | null
  type: "new_task" | "due_soon"
  title: string
  body: string
  isRead: boolean
  createdAt: string
}

export type TaskAssignableUser = {
  id: string
  name: string
  role: "admin" | "user"
}

export type TasksPageData = {
  currentUserId: string
  isManager: boolean
  operationalPlanWeekEndDay: OperationalPlanWeekEndDay
  assignedTasks: TaskRecord[]
  outgoingTasks: TaskRecord[]
  managedTasks: TaskRecord[]
  notifications: TaskNotification[]
  assignableUsers: TaskAssignableUser[]
  pendingTasksCount: number
  unreadNotificationsCount: number
}

export function getTaskStatusLabel(status: TaskStatus) {
  switch (status) {
    case "completed":
      return "منتهية"
    case "stalled":
      return "متعثرة"
    case "not_started":
    case "in_progress":
      return "قيد التنفيذ"
    case "under_review":
      return "قيد المراجعة"
    default:
      return "قيد التنفيذ"
  }
}

export function getTaskStatusEmoji(status: TaskStatus) {
  switch (status) {
    case "completed":
      return "white_check_mark"
    case "stalled":
      return "warning"
    case "in_progress":
      return "hourglass_flowing_sand"
    case "under_review":
      return "hourglass_flowing_sand"
    default:
      return "x"
  }
}

export function isCurrentMonthTaskDate(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return false
  }

  const now = new Date()

  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

export function isReleasedOperationalTask(task: Pick<TaskRecord, "operationalPlanOccurrenceId" | "operationalPlanReleaseAt">) {
  if (!task.operationalPlanOccurrenceId || !task.operationalPlanReleaseAt) {
    return true
  }

  const releaseDate = new Date(task.operationalPlanReleaseAt)

  if (Number.isNaN(releaseDate.getTime())) {
    return true
  }

  return releaseDate.getTime() <= Date.now()
}

export function isVisibleCurrentTask(task: Pick<TaskRecord, "dueAt" | "operationalPlanOccurrenceId" | "operationalPlanReleaseAt" | "operationalPlanTaskCount">, weekEndDay: OperationalPlanWeekEndDay = defaultOperationalPlanWeekEndDay) {
  if (task.operationalPlanOccurrenceId) {
    const operationalMonthAnchor = task.operationalPlanReleaseAt || task.dueAt

    return isCurrentMonthTaskDate(operationalMonthAnchor) && isReleasedOperationalTask(task)
  }

  return isCurrentMonthTaskDate(task.dueAt)
}

export function countVisiblePendingTasks(tasks: TaskRecord[], weekEndDay: OperationalPlanWeekEndDay = defaultOperationalPlanWeekEndDay) {
  return tasks.filter((task) => isVisibleCurrentTask(task, weekEndDay) && task.status !== "completed").length
}

export function getTaskEffectiveDueAt(task: Pick<TaskRecord, "dueAt" | "operationalPlanOccurrenceId" | "operationalPlanTaskCount" | "operationalPlanReleaseAt">, weekEndDay: OperationalPlanWeekEndDay = defaultOperationalPlanWeekEndDay) {
  if (!task.operationalPlanOccurrenceId) {
    return task.dueAt
  }

  const baseDueAt = new Date(task.dueAt)

  if (Number.isNaN(baseDueAt.getTime())) {
    return task.dueAt
  }

  const taskCount = Math.max(1, Math.round(task.operationalPlanTaskCount ?? 1))
  const monthEnd = new Date(Date.UTC(baseDueAt.getUTCFullYear(), baseDueAt.getUTCMonth() + 1, 0, 23, 59, 0))

  if (taskCount <= 1) {
    return monthEnd.toISOString()
  }

  const releaseAt = task.operationalPlanReleaseAt ? new Date(task.operationalPlanReleaseAt) : new Date(Date.UTC(baseDueAt.getUTCFullYear(), baseDueAt.getUTCMonth(), 1, 0, 0, 0))

  if (Number.isNaN(releaseAt.getTime())) {
    return monthEnd.toISOString()
  }

  return getWeekBoundaryOnOrAfter(releaseAt, weekEndDay, monthEnd).toISOString()
}
