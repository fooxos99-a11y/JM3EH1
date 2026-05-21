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
