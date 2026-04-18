import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCurrentUser } from "@/lib/auth"
import type { TaskAssignableUser, TaskNotification, TaskRecord, TasksPageData, TaskStatus } from "@/lib/tasks"
import { taskStatusValues } from "@/lib/tasks"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type TaskRow = {
  id: string
  title: string
  description: string
  assigned_to_user_id: string
  assigned_by_user_id: string
  due_at: string
  status: TaskStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

type NotificationRow = {
  id: string
  task_id: string | null
  notification_type: "new_task" | "due_soon"
  title: string
  body: string
  is_read: boolean
  created_at: string
}

type UserRow = {
  id: string
  full_name: string
  role: "admin" | "user"
}

const createTaskSchema = z.object({
  action: z.literal("create_task"),
  assignedToUserId: z.string().uuid("المستخدم المحدد غير صالح"),
  title: z.string().trim().min(3, "عنوان المهمة مطلوب"),
  description: z.string().trim().min(5, "وصف المهمة مطلوب"),
  dueAt: z.string().datetime("موعد التسليم غير صالح"),
})

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_status"),
    taskId: z.string().uuid("المهمة غير صالحة"),
    status: z.enum(taskStatusValues),
  }),
  z.object({
    action: z.literal("mark_notification_read"),
    notificationId: z.string().uuid("الإشعار غير صالح"),
  }),
])

function isSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false
  }

  return error.code === "42P01" || error.code === "42703" || error.code === "22P02"
}

function schemaResponse() {
  return NextResponse.json(
    { error: "يجب تطبيق آخر تحديث لملف قاعدة البيانات قبل استخدام نظام المهام" },
    { status: 503 },
  )
}

function mapTask(row: TaskRow, usersById: Map<string, UserRow>, currentUserId: string, isManager: boolean): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    assignedToUserId: row.assigned_to_user_id,
    assignedToName: usersById.get(row.assigned_to_user_id)?.full_name ?? "-",
    assignedByUserId: row.assigned_by_user_id,
    assignedByName: usersById.get(row.assigned_by_user_id)?.full_name ?? "-",
    dueAt: row.due_at,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canUpdateStatus: isManager || row.assigned_to_user_id === currentUserId,
  }
}

function mapNotification(row: NotificationRow): TaskNotification {
  return {
    id: row.id,
    taskId: row.task_id,
    type: row.notification_type,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    createdAt: row.created_at,
  }
}

async function ensureDueSoonNotifications(currentUserId: string) {
  const supabase = createSupabaseAdminClient()
  const now = new Date()
  const upcomingThreshold = new Date(now.getTime() + (1000 * 60 * 60 * 24)).toISOString()

  const { data: tasks, error: taskError } = await supabase
    .from("user_tasks")
    .select("id,title,due_at,status")
    .eq("assigned_to_user_id", currentUserId)
    .neq("status", "completed")
    .gt("due_at", now.toISOString())
    .lte("due_at", upcomingThreshold)

  if (taskError) {
    if (isSchemaMissing(taskError)) {
      return false
    }

    throw new Error(taskError.message)
  }

  if (!tasks || tasks.length === 0) {
    return true
  }

  const taskIds = tasks.map((task) => task.id)
  const { data: existingRows, error: notificationError } = await supabase
    .from("task_notifications")
    .select("task_id")
    .eq("user_id", currentUserId)
    .eq("notification_type", "due_soon")
    .in("task_id", taskIds)

  if (notificationError) {
    if (isSchemaMissing(notificationError)) {
      return false
    }

    throw new Error(notificationError.message)
  }

  const existingTaskIds = new Set((existingRows ?? []).map((row) => row.task_id).filter(Boolean))
  const missingRows = tasks
    .filter((task) => !existingTaskIds.has(task.id))
    .map((task) => ({
      user_id: currentUserId,
      task_id: task.id,
      notification_type: "due_soon",
      title: `تذكير: اقترب موعد مهمة ${task.title}`,
      body: `موعد التسليم يقترب للمهمة: ${task.title}`,
    }))

  if (missingRows.length > 0) {
    const { error } = await supabase.from("task_notifications").insert(missingRows)
    if (error) {
      if (isSchemaMissing(error)) {
        return false
      }

      throw new Error(error.message)
    }
  }

  return true
}

async function loadTasksPageData(currentUserId: string, isManager: boolean): Promise<TasksPageData> {
  const schemaReady = await ensureDueSoonNotifications(currentUserId)
  if (!schemaReady) {
    throw new Error("SCHEMA_MISSING")
  }

  const supabase = createSupabaseAdminClient()

  const [{ data: assignedRows, error: assignedError }, { data: notificationRows, error: notificationError }, { data: userRows, error: userError }] = await Promise.all([
    supabase.from("user_tasks").select("id,title,description,assigned_to_user_id,assigned_by_user_id,due_at,status,completed_at,created_at,updated_at").eq("assigned_to_user_id", currentUserId).order("due_at", { ascending: true }),
    supabase.from("task_notifications").select("id,task_id,notification_type,title,body,is_read,created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(30),
    supabase.from("app_users").select("id,full_name,role").order("full_name", { ascending: true }),
  ])

  if (assignedError) {
    if (isSchemaMissing(assignedError)) {
      throw new Error("SCHEMA_MISSING")
    }
    throw new Error(assignedError.message)
  }

  if (notificationError) {
    if (isSchemaMissing(notificationError)) {
      throw new Error("SCHEMA_MISSING")
    }
    throw new Error(notificationError.message)
  }

  if (userError) {
    throw new Error(userError.message)
  }

  const users = (userRows ?? []).map((row) => row as UserRow)
  const usersById = new Map(users.map((user) => [user.id, user]))

  let managedRows: TaskRow[] = []
  if (isManager) {
    const { data, error } = await supabase.from("user_tasks").select("id,title,description,assigned_to_user_id,assigned_by_user_id,due_at,status,completed_at,created_at,updated_at").order("created_at", { ascending: false })
    if (error) {
      if (isSchemaMissing(error)) {
        throw new Error("SCHEMA_MISSING")
      }
      throw new Error(error.message)
    }
    managedRows = (data ?? []) as TaskRow[]
  }

  return {
    currentUserId,
    isManager,
    assignedTasks: ((assignedRows ?? []) as TaskRow[]).map((row) => mapTask(row, usersById, currentUserId, isManager)),
    managedTasks: managedRows.map((row) => mapTask(row, usersById, currentUserId, isManager)),
    notifications: ((notificationRows ?? []) as NotificationRow[]).map(mapNotification),
    assignableUsers: users.map((user) => ({ id: user.id, name: user.full_name, role: user.role })) as TaskAssignableUser[],
  }
}

export async function GET() {
  try {
    const user = await requireCurrentUser()
    return NextResponse.json(await loadTasksPageData(user.id, user.role === "admin"))
  } catch (error) {
    if (error instanceof Error && error.message === "SCHEMA_MISSING") {
      return schemaResponse()
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل المهام" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser()
    if (user.role !== "admin") {
      return NextResponse.json({ error: "غير مصرح بإضافة المهام" }, { status: 403 })
    }

    const payload = createTaskSchema.parse(await request.json())
    const supabase = createSupabaseAdminClient()

    const { data: insertedRows, error } = await supabase.from("user_tasks").insert({
      title: payload.title,
      description: payload.description,
      assigned_to_user_id: payload.assignedToUserId,
      assigned_by_user_id: user.id,
      due_at: payload.dueAt,
    }).select("id,title")

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }
      throw new Error(error.message)
    }

    const insertedTask = insertedRows?.[0]
    const { error: notificationError } = await supabase.from("task_notifications").insert({
      user_id: payload.assignedToUserId,
      task_id: insertedTask?.id ?? null,
      notification_type: "new_task",
      title: `مهمة جديدة: ${payload.title}`,
      body: `تم إسناد مهمة جديدة لك مع موعد تسليم ${new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(new Date(payload.dueAt))}`,
    })

    if (notificationError) {
      if (isSchemaMissing(notificationError)) {
        return schemaResponse()
      }
      throw new Error(notificationError.message)
    }

    return NextResponse.json(await loadTasksPageData(user.id, true))
  } catch (error) {
    if (error instanceof Error && error.message === "SCHEMA_MISSING") {
      return schemaResponse()
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر إنشاء المهمة" }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireCurrentUser()
    const payload = patchSchema.parse(await request.json())
    const supabase = createSupabaseAdminClient()

    if (payload.action === "update_status") {
      const { data: task, error: taskError } = await supabase.from("user_tasks").select("id,assigned_to_user_id").eq("id", payload.taskId).maybeSingle<{ id: string; assigned_to_user_id: string }>()
      if (taskError) {
        if (isSchemaMissing(taskError)) {
          return schemaResponse()
        }
        throw new Error(taskError.message)
      }

      if (!task) {
        return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 })
      }

      if (user.role !== "admin" && task.assigned_to_user_id !== user.id) {
        return NextResponse.json({ error: "غير مصرح بتعديل هذه المهمة" }, { status: 403 })
      }

      const { error } = await supabase.from("user_tasks").update({
        status: payload.status,
        completed_at: payload.status === "completed" ? new Date().toISOString() : null,
      }).eq("id", payload.taskId)

      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }
        throw new Error(error.message)
      }
    } else {
      const { error } = await supabase.from("task_notifications").update({ is_read: true }).eq("id", payload.notificationId).eq("user_id", user.id)
      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }
        throw new Error(error.message)
      }
    }

    return NextResponse.json(await loadTasksPageData(user.id, user.role === "admin"))
  } catch (error) {
    if (error instanceof Error && error.message === "SCHEMA_MISSING") {
      return schemaResponse()
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحديث المهمة" }, { status: 400 })
  }
}
