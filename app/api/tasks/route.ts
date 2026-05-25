import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCurrentUser } from "@/lib/auth"
import { createDriveFolder } from "@/lib/google-drive"
import { defaultOperationalPlanWeekEndDay } from "@/lib/operational-plan-settings"
import { triggerTasksRealtimeUpdate } from "@/lib/pusher-server"
import { deleteRedisCacheByPrefix, getRedisCache, setRedisCache } from "@/lib/redis-cache"
import { calculateOperationalPlanProgress, getOperationalPlanOccurrenceStatus, normalizeOperationalPlanCount } from "@/lib/operational-plans"
import type { TaskAssignableUser, TaskKind, TaskNotification, TaskRecord, TasksPageData, TaskStatus } from "@/lib/tasks"
import { isVisibleCurrentTask, taskKindValues, taskStatusValues } from "@/lib/tasks"
import { getSiteSectionContent } from "@/lib/site-content"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type TaskRow = {
  id: string
  task_kind: TaskKind
  title: string
  description: string
  assigned_to_user_id: string
  assigned_by_user_id: string
  due_at: string
  status: TaskStatus
  completed_at: string | null
  attachment_url: string | null
  drive_folder_id: string | null
  drive_folder_name: string | null
  operational_plan_id: string | null
  operational_plan_occurrence_id: string | null
  operational_plan_task_index: number | null
  operational_plan_task_count: number | null
  operational_plan_release_at: string | null
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

type TaskMutationPayload = Omit<TaskRecord, "assignedToName" | "assignedByName" | "canUpdateStatus">

const taskSelectWithAttachment = "id,task_kind,title,description,assigned_to_user_id,assigned_by_user_id,due_at,status,completed_at,attachment_url,drive_folder_id,drive_folder_name,operational_plan_id,operational_plan_occurrence_id,operational_plan_task_index,operational_plan_task_count,operational_plan_release_at,created_at,updated_at"
const taskSelectWithoutAttachment = "id,task_kind,title,description,assigned_to_user_id,assigned_by_user_id,due_at,status,completed_at,drive_folder_id,drive_folder_name,operational_plan_id,operational_plan_occurrence_id,operational_plan_task_index,operational_plan_task_count,operational_plan_release_at,created_at,updated_at"

const createTaskSchema = z.object({
  action: z.literal("create_task"),
  assignedToUserId: z.string().uuid("المستخدم المحدد غير صالح"),
  title: z.string().trim().min(3, "عنوان المهمة مطلوب"),
  description: z.string().trim().optional().transform((value) => value ?? ""),
  dueAt: z.string().datetime("موعد التسليم غير صالح"),
  attachmentUrl: z.string().trim().url("رابط الملف غير صالح").nullable().optional(),
})

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_status"),
    taskId: z.string().uuid("المهمة غير صالحة"),
    status: z.enum(taskStatusValues),
  }),
  z.object({
    action: z.literal("update_attachment"),
    taskId: z.string().uuid("المهمة غير صالحة"),
    attachmentUrl: z.string().trim().url("رابط الملف غير صالح").nullable(),
  }),
  z.object({
    action: z.literal("link_task_folder"),
    taskId: z.string().uuid("المهمة غير صالحة"),
    driveFolderId: z.string().trim().min(1, "المجلد غير صالح"),
    driveFolderName: z.string().trim().min(1, "اسم المجلد غير صالح"),
  }),
  z.object({
    action: z.literal("create_task_folder"),
    taskId: z.string().uuid("المهمة غير صالحة"),
    parentFolderId: z.string().trim().min(1, "المجلد الأب غير صالح"),
  }),
  z.object({
    action: z.literal("update_task"),
    taskId: z.string().uuid("المهمة غير صالحة"),
    assignedToUserId: z.string().uuid("المستخدم المحدد غير صالح"),
    title: z.string().trim().min(3, "عنوان المهمة مطلوب"),
    description: z.string().trim().optional().transform((value) => value ?? ""),
    dueAt: z.string().datetime("موعد التسليم غير صالح"),
  }),
  z.object({
    action: z.literal("delete_task"),
    taskId: z.string().uuid("المهمة غير صالحة"),
  }),
  z.object({
    action: z.literal("mark_notification_read"),
    notificationId: z.string().uuid("الإشعار غير صالح"),
  }),
  z.object({
    action: z.literal("mark_kind_notifications_read"),
    kind: z.enum(taskKindValues),
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
    kind: row.task_kind,
    title: row.title,
    description: row.description,
    assignedToUserId: row.assigned_to_user_id,
    assignedToName: usersById.get(row.assigned_to_user_id)?.full_name ?? "-",
    assignedByUserId: row.assigned_by_user_id,
    assignedByName: usersById.get(row.assigned_by_user_id)?.full_name ?? "-",
    dueAt: row.due_at,
    status: row.status,
    completedAt: row.completed_at,
    attachmentUrl: row.attachment_url,
    driveFolderId: row.drive_folder_id,
    driveFolderName: row.drive_folder_name,
    operationalPlanId: row.operational_plan_id,
    operationalPlanOccurrenceId: row.operational_plan_occurrence_id,
    operationalPlanTaskIndex: row.operational_plan_task_index,
    operationalPlanTaskCount: row.operational_plan_task_count,
    operationalPlanReleaseAt: row.operational_plan_release_at,
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

function mapTaskForMutation(row: TaskRow): TaskMutationPayload {
  return {
    id: row.id,
    kind: row.task_kind,
    title: row.title,
    description: row.description,
    assignedToUserId: row.assigned_to_user_id,
    assignedByUserId: row.assigned_by_user_id,
    dueAt: row.due_at,
    status: row.status,
    completedAt: row.completed_at,
    attachmentUrl: row.attachment_url,
    driveFolderId: row.drive_folder_id,
    driveFolderName: row.drive_folder_name,
    operationalPlanId: row.operational_plan_id,
    operationalPlanOccurrenceId: row.operational_plan_occurrence_id,
    operationalPlanTaskIndex: row.operational_plan_task_index,
    operationalPlanTaskCount: row.operational_plan_task_count,
    operationalPlanReleaseAt: row.operational_plan_release_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function withNullAttachment(rows: Array<Omit<TaskRow, "attachment_url">>): TaskRow[] {
  return rows.map((row) => ({
    ...row,
    attachment_url: null,
  }))
}

async function loadTaskRows(
  queryFactory: (selectClause: string) => Promise<{ data: unknown[] | null; error: { code?: string; message?: string } | null }>,
) {
  const withAttachment = await queryFactory(taskSelectWithAttachment)

  if (!withAttachment.error) {
    return {
      data: ((withAttachment.data ?? []) as TaskRow[]),
      supportsAttachment: true,
    }
  }

  if (!isSchemaMissing(withAttachment.error)) {
    throw new Error(withAttachment.error.message)
  }

  const withoutAttachment = await queryFactory(taskSelectWithoutAttachment)
  if (withoutAttachment.error) {
    throw new Error(withoutAttachment.error.message)
  }

  return {
    data: withNullAttachment((withoutAttachment.data ?? []) as Array<Omit<TaskRow, "attachment_url">>),
    supportsAttachment: false,
  }
}

async function loadTaskForMutation(supabase: ReturnType<typeof createSupabaseAdminClient>, taskId: string) {
  const { data: taskRow, error } = await supabase
    .from("user_tasks")
    .select(taskSelectWithAttachment)
    .eq("id", taskId)
    .maybeSingle<TaskRow>()

  if (!error) {
    return taskRow
  }

  if (!isSchemaMissing(error)) {
    throw new Error(error.message)
  }

  const { data: fallbackRow, error: fallbackError } = await supabase
    .from("user_tasks")
    .select(taskSelectWithoutAttachment)
    .eq("id", taskId)
    .maybeSingle<Omit<TaskRow, "attachment_url">>()

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  return fallbackRow ? { ...fallbackRow, attachment_url: null } as TaskRow : null
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

async function syncOperationalPlanOccurrenceFromTask(taskId: string, status: TaskStatus, completedAt: string | null) {
  const supabase = createSupabaseAdminClient()
  const { data: taskRow, error: taskError } = await supabase
    .from("user_tasks")
    .select("operational_plan_occurrence_id")
    .eq("id", taskId)
    .maybeSingle<{ operational_plan_occurrence_id: string | null }>()

  if (taskError) {
    if (isSchemaMissing(taskError)) {
      throw new Error("SCHEMA_MISSING")
    }

    throw new Error(taskError.message)
  }

  if (!taskRow?.operational_plan_occurrence_id) {
    return
  }

  const occurrenceId = taskRow.operational_plan_occurrence_id
  const { data: occurrenceRow, error: occurrenceLookupError } = await supabase
    .from("operational_plan_occurrences")
    .select("target_value")
    .eq("id", occurrenceId)
    .maybeSingle<{ target_value: number | null }>()

  if (occurrenceLookupError) {
    if (isSchemaMissing(occurrenceLookupError)) {
      throw new Error("SCHEMA_MISSING")
    }

    throw new Error(occurrenceLookupError.message)
  }

  const { data: linkedTasks, error: linkedTasksError } = await supabase
    .from("user_tasks")
    .select("status,completed_at")
    .eq("operational_plan_occurrence_id", occurrenceId)

  if (linkedTasksError) {
    if (isSchemaMissing(linkedTasksError)) {
      throw new Error("SCHEMA_MISSING")
    }

    throw new Error(linkedTasksError.message)
  }

  const targetValue = normalizeOperationalPlanCount(occurrenceRow?.target_value ?? 0)
  const achievedValue = normalizeOperationalPlanCount((linkedTasks ?? []).filter((entry) => entry.status === "completed").length)
  const progressPercentage = calculateOperationalPlanProgress(achievedValue, targetValue)
  const occurrenceStatus = getOperationalPlanOccurrenceStatus(progressPercentage)
  const latestCompletedAt = (linkedTasks ?? [])
    .map((entry) => entry.completed_at)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? completedAt

  const { error: occurrenceError } = await supabase
    .from("operational_plan_occurrences")
    .update({
      achieved_value: achievedValue,
      progress_percentage: progressPercentage,
      status: occurrenceStatus,
      completed_at: occurrenceStatus === "completed" ? latestCompletedAt : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", occurrenceId)

  if (occurrenceError) {
    if (isSchemaMissing(occurrenceError)) {
      throw new Error("SCHEMA_MISSING")
    }

    throw new Error(occurrenceError.message)
  }
}

function parseTaskKindFilter(request: Request): TaskKind {
  const searchParams = new URL(request.url).searchParams
  const kind = searchParams.get("kind")

  if (kind && taskKindValues.includes(kind as TaskKind)) {
    return kind as TaskKind
  }

  return "task"
}

function getTasksCacheKey(currentUserId: string, isManager: boolean, taskKind: TaskKind) {
  return `tasks:${taskKind}:${currentUserId}:${isManager ? "manager" : "user"}`
}

async function invalidateTaskCachesAndBroadcast(taskKind: TaskKind) {
  await deleteRedisCacheByPrefix("tasks:")
  await triggerTasksRealtimeUpdate(taskKind)
}

async function loadTasksPageData(currentUserId: string, isManager: boolean, taskKind: TaskKind): Promise<TasksPageData> {
  const schemaReady = await ensureDueSoonNotifications(currentUserId)
  if (!schemaReady) {
    throw new Error("SCHEMA_MISSING")
  }

  const settings = await getSiteSectionContent("settings")
  const operationalPlanWeekEndDay = settings.operationalPlanWeekEndDay ?? defaultOperationalPlanWeekEndDay

  const supabase = createSupabaseAdminClient()

  const [{ data: assignedRows, supportsAttachment }, { data: notificationRows, error: notificationError }, { data: userRows, error: userError }, outgoingResult] = await Promise.all([
    loadTaskRows(async (selectClause) => await supabase.from("user_tasks").select(selectClause).eq("assigned_to_user_id", currentUserId).eq("task_kind", taskKind).order("due_at", { ascending: true })),
    supabase.from("task_notifications").select("id,task_id,notification_type,title,body,is_read,created_at").eq("user_id", currentUserId).order("created_at", { ascending: false }).limit(30),
    supabase.from("app_users").select("id,full_name,role").order("full_name", { ascending: true }),
    taskKind === "internal_transaction"
      ? loadTaskRows(async (selectClause) => await supabase.from("user_tasks").select(selectClause).eq("assigned_by_user_id", currentUserId).eq("task_kind", "internal_transaction").order("created_at", { ascending: false }))
      : Promise.resolve({ data: [] as TaskRow[], supportsAttachment: true }),
  ])

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
  const assignedTaskRows = ((assignedRows ?? []) as TaskRow[])
  const outgoingTaskRows = outgoingResult.data
  const assignedTaskIds = new Set(assignedTaskRows.map((row) => row.id))

  let managedRows: TaskRow[] = []
  if (isManager && taskKind === "task") {
    const managedResult = await loadTaskRows(async (selectClause) => await supabase.from("user_tasks").select(selectClause).eq("task_kind", "task").order("created_at", { ascending: false }))
    managedRows = managedResult.data
  }

  const mappedAssignedTasks = assignedTaskRows.map((row) => mapTask(row, usersById, currentUserId, isManager))
  const mappedOutgoingTasks = outgoingTaskRows.map((row) => mapTask(row, usersById, currentUserId, isManager))
  const mappedManagedTasks = managedRows.map((row) => mapTask(row, usersById, currentUserId, isManager))

  return {
    currentUserId,
    isManager,
    operationalPlanWeekEndDay,
    assignedTasks: mappedAssignedTasks,
    outgoingTasks: mappedOutgoingTasks,
    managedTasks: mappedManagedTasks,
    notifications: ((notificationRows ?? []) as NotificationRow[]).map(mapNotification),
    assignableUsers: users.map((user) => ({ id: user.id, name: user.full_name, role: user.role })) as TaskAssignableUser[],
    pendingTasksCount: mappedAssignedTasks.filter((task) => isVisibleCurrentTask(task, operationalPlanWeekEndDay) && task.status !== "completed").length,
    unreadNotificationsCount: ((notificationRows ?? []) as NotificationRow[]).filter((row) => !row.is_read && row.notification_type === "new_task" && !!row.task_id && assignedTaskIds.has(row.task_id)).length,
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser()
    const isManager = user.role === "admin" && user.permissions.includes("*")
    const taskKind = parseTaskKindFilter(request)
    const cacheKey = getTasksCacheKey(user.id, isManager, taskKind)
    const cachedPayload = await getRedisCache<TasksPageData>(cacheKey)

    if (cachedPayload) {
      return NextResponse.json(cachedPayload)
    }

    const payload = await loadTasksPageData(user.id, isManager, taskKind)
    void setRedisCache(cacheKey, payload, 45)

    return NextResponse.json(payload)
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
    const isManager = user.role === "admin" && user.permissions.includes("*")

    const parsed = createTaskSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات المهمة غير صحيحة" }, { status: 400 })
    }

    const payload = parsed.data
    if (!isManager && payload.assignedToUserId !== user.id) {
      return NextResponse.json({ error: "يمكنك إنشاء مهمة لنفسك فقط" }, { status: 403 })
    }

    const supabase = createSupabaseAdminClient()
    const isSelfAssignedTask = payload.assignedToUserId === user.id

    const { data: insertedRows, error } = await supabase.from("user_tasks").insert({
      task_kind: "task",
      title: payload.title,
      description: payload.description,
      assigned_to_user_id: payload.assignedToUserId,
      assigned_by_user_id: user.id,
      due_at: payload.dueAt,
      status: isSelfAssignedTask ? "completed" : "in_progress",
      completed_at: isSelfAssignedTask ? new Date().toISOString() : null,
      attachment_url: payload.attachmentUrl ?? null,
      drive_folder_id: null,
      drive_folder_name: null,
    }).select("id,title")

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }
      throw new Error(error.message)
    }

    const insertedTask = insertedRows?.[0]
    if (!isSelfAssignedTask) {
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
    }

    void invalidateTaskCachesAndBroadcast("task")

    return NextResponse.json({
      task: {
        id: insertedTask?.id ?? null,
        kind: "task" as const,
        title: payload.title,
        description: payload.description,
        assignedToUserId: payload.assignedToUserId,
        assignedByUserId: user.id,
        dueAt: payload.dueAt,
        status: isSelfAssignedTask ? "completed" : "in_progress",
        completedAt: isSelfAssignedTask ? new Date().toISOString() : null,
        attachmentUrl: payload.attachmentUrl ?? null,
        driveFolderId: null,
        driveFolderName: null,
        operationalPlanId: null,
        operationalPlanOccurrenceId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
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
    const isManager = user.role === "admin" && user.permissions.includes("*")
    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات المهمة غير صحيحة" }, { status: 400 })
    }

    const payload = parsed.data
    const supabase = createSupabaseAdminClient()
    let mutationPayload: { task?: TaskMutationPayload; taskId?: string } | null = null

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

      if (!isManager && task.assigned_to_user_id !== user.id) {
        return NextResponse.json({ error: "غير مصرح بتعديل هذه المهمة" }, { status: 403 })
      }

      const completedAt = payload.status === "completed" ? new Date().toISOString() : null
      const { error } = await supabase.from("user_tasks").update({
        status: payload.status,
        completed_at: completedAt,
      }).eq("id", payload.taskId)

      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }
        throw new Error(error.message)
      }

      await syncOperationalPlanOccurrenceFromTask(payload.taskId, payload.status, completedAt)
      const updatedTask = await loadTaskForMutation(supabase, payload.taskId)
      mutationPayload = updatedTask ? { task: mapTaskForMutation(updatedTask) } : { taskId: payload.taskId }
    } else if (payload.action === "update_attachment") {
      const { data: task, error: taskError } = await supabase.from("user_tasks").select("id,assigned_to_user_id,status").eq("id", payload.taskId).maybeSingle<{ id: string; assigned_to_user_id: string; status: TaskStatus }>()
      if (taskError) {
        if (isSchemaMissing(taskError)) {
          return schemaResponse()
        }
        throw new Error(taskError.message)
      }

      if (!task) {
        return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 })
      }

      if (!isManager && task.assigned_to_user_id !== user.id) {
        return NextResponse.json({ error: "غير مصرح بتعديل مرفق هذه المهمة" }, { status: 403 })
      }

      const nextStatus = payload.attachmentUrl && task.status === "stalled" ? "under_review" : task.status
      const { error } = await supabase.from("user_tasks").update({
        attachment_url: payload.attachmentUrl,
        status: nextStatus,
      }).eq("id", payload.taskId)

      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }
        throw new Error(error.message)
      }

      const updatedTask = await loadTaskForMutation(supabase, payload.taskId)
      mutationPayload = updatedTask ? { task: mapTaskForMutation(updatedTask) } : { taskId: payload.taskId }
    } else if (payload.action === "link_task_folder") {
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

      if (!isManager && task.assigned_to_user_id !== user.id) {
        return NextResponse.json({ error: "غير مصرح بربط مجلد لهذه المهمة" }, { status: 403 })
      }

      const { error } = await supabase.from("user_tasks").update({
        drive_folder_id: payload.driveFolderId,
        drive_folder_name: payload.driveFolderName,
      }).eq("id", payload.taskId)

      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }
        throw new Error(error.message)
      }

      const updatedTask = await loadTaskForMutation(supabase, payload.taskId)
      mutationPayload = updatedTask ? { task: mapTaskForMutation(updatedTask) } : { taskId: payload.taskId }
    } else if (payload.action === "create_task_folder") {
      const { data: task, error: taskError } = await supabase
        .from("user_tasks")
        .select("id,title,assigned_to_user_id,drive_folder_id")
        .eq("id", payload.taskId)
        .maybeSingle<{ id: string; title: string; assigned_to_user_id: string; drive_folder_id: string | null }>()

      if (taskError) {
        if (isSchemaMissing(taskError)) {
          return schemaResponse()
        }
        throw new Error(taskError.message)
      }

      if (!task) {
        return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 })
      }

      if (!isManager && task.assigned_to_user_id !== user.id) {
        return NextResponse.json({ error: "غير مصرح بإنشاء مجلد لهذه المهمة" }, { status: 403 })
      }

      const folder = await createDriveFolder(user, payload.parentFolderId, task.title)
      const { error } = await supabase.from("user_tasks").update({
        drive_folder_id: folder.id,
        drive_folder_name: folder.name,
      }).eq("id", payload.taskId)

      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }
        throw new Error(error.message)
      }

      const updatedTask = await loadTaskForMutation(supabase, payload.taskId)
      mutationPayload = updatedTask ? { task: mapTaskForMutation(updatedTask) } : { taskId: payload.taskId }
    } else if (payload.action === "update_task") {
      if (!isManager) {
        return NextResponse.json({ error: "غير مصرح بتعديل المهام" }, { status: 403 })
      }

      const { error } = await supabase.from("user_tasks").update({
        title: payload.title,
        description: payload.description,
        assigned_to_user_id: payload.assignedToUserId,
        due_at: payload.dueAt,
      }).eq("id", payload.taskId)

      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }
        throw new Error(error.message)
      }

      const updatedTask = await loadTaskForMutation(supabase, payload.taskId)
      mutationPayload = updatedTask ? { task: mapTaskForMutation(updatedTask) } : { taskId: payload.taskId }
    } else if (payload.action === "delete_task") {
      if (!isManager) {
        const { data: task, error: taskError } = await supabase
          .from("user_tasks")
          .select("id,task_kind,assigned_to_user_id,status,operational_plan_occurrence_id")
          .eq("id", payload.taskId)
          .maybeSingle<{ id: string; task_kind: TaskKind; assigned_to_user_id: string; status: TaskStatus; operational_plan_occurrence_id: string | null }>()

        if (taskError) {
          if (isSchemaMissing(taskError)) {
            return schemaResponse()
          }
          throw new Error(taskError.message)
        }

        if (!task) {
          return NextResponse.json({ error: "المهمة غير موجودة" }, { status: 404 })
        }

        if (task.operational_plan_occurrence_id) {
          return NextResponse.json({ error: "لا يمكن حذف مهام الخطة التشغيلية من هذه الصفحة" }, { status: 400 })
        }

        const canDeleteOwnCompletedTask = task.task_kind === "task" && task.assigned_to_user_id === user.id && task.status === "completed"
        if (!canDeleteOwnCompletedTask) {
          return NextResponse.json({ error: "غير مصرح بحذف هذه المهمة" }, { status: 403 })
        }
      }

      const { error } = await supabase.from("user_tasks").delete().eq("id", payload.taskId)
      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }
        throw new Error(error.message)
      }

      mutationPayload = { taskId: payload.taskId }
    } else if (payload.action === "mark_notification_read") {
      const { error } = await supabase.from("task_notifications").update({ is_read: true }).eq("id", payload.notificationId).eq("user_id", user.id)
      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }
        throw new Error(error.message)
      }
    } else {
      const { data: taskRows, error: taskRowsError } = await supabase
        .from("user_tasks")
        .select("id")
        .eq("assigned_to_user_id", user.id)
        .eq("task_kind", payload.kind)

      if (taskRowsError) {
        if (isSchemaMissing(taskRowsError)) {
          return schemaResponse()
        }
        throw new Error(taskRowsError.message)
      }

      const taskIds = (taskRows ?? []).map((row) => row.id)
      if (taskIds.length > 0) {
        const { error } = await supabase
          .from("task_notifications")
          .update({ is_read: true })
          .eq("user_id", user.id)
          .eq("notification_type", "new_task")
          .in("task_id", taskIds)
          .eq("is_read", false)

        if (error) {
          if (isSchemaMissing(error)) {
            return schemaResponse()
          }
          throw new Error(error.message)
        }
      }
    }

    const taskKind = parseTaskKindFilter(request)
    void invalidateTaskCachesAndBroadcast(taskKind)
    if (mutationPayload) {
      return NextResponse.json(mutationPayload)
    }

    return NextResponse.json(await loadTasksPageData(user.id, isManager, taskKind))
  } catch (error) {
    if (error instanceof Error && error.message === "SCHEMA_MISSING") {
      return schemaResponse()
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحديث المهمة" }, { status: 400 })
  }
}
