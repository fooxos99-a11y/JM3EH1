export const taskStatusValues = ["not_started", "in_progress", "under_review", "completed"] as const

export type TaskStatus = (typeof taskStatusValues)[number]

export type TaskRecord = {
  id: string
  title: string
  description: string
  assignedToUserId: string
  assignedToName: string
  assignedByUserId: string
  assignedByName: string
  dueAt: string
  status: TaskStatus
  completedAt: string | null
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
  managedTasks: TaskRecord[]
  notifications: TaskNotification[]
  assignableUsers: TaskAssignableUser[]
}

export function getTaskStatusLabel(status: TaskStatus) {
  switch (status) {
    case "completed":
      return "منجزة"
    case "in_progress":
      return "قيد التنفيذ"
    case "under_review":
      return "تحت المراجعة"
    default:
      return "لم تبدأ"
  }
}

export function getTaskStatusEmoji(status: TaskStatus) {
  switch (status) {
    case "completed":
      return "white_check_mark"
    case "in_progress":
      return "hourglass_flowing_sand"
    case "under_review":
      return "hourglass_flowing_sand"
    default:
      return "x"
  }
}
