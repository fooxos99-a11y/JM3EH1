import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCurrentUser } from "@/lib/auth"
import {
  buildOperationalPlanOccurrences,
  getOperationalPlanTargetCount,
  operationalPlanOccurrenceStatusValues,
  operationalPlanRecurrenceValues,
  type OperationalPlanAssignableUser,
  type OperationalPlanOccurrenceRecord,
  type OperationalPlanOccurrenceStatus,
  type OperationalPlanRecord,
  type OperationalPlansPageData,
  type OperationalPlanRecurrence,
} from "@/lib/operational-plans"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type OperationalPlanRow = {
  id: string
  title: string
  description: string
  plan_year: number
  recurrence: OperationalPlanRecurrence
  target_count: number
  owner_user_id: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

type OperationalPlanOccurrenceRow = {
  id: string
  plan_id: string
  sequence_number: number
  label: string
  due_at: string
  status: OperationalPlanOccurrenceStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

type UserRow = {
  id: string
  full_name: string
}

const createPlanSchema = z.object({
  title: z.string().trim().min(3, "اسم الخطة مطلوب"),
  description: z.string().trim().optional().transform((value) => value ?? ""),
  year: z.number().int().min(2024, "السنة غير صالحة").max(2100, "السنة غير صالحة"),
  recurrence: z.enum(operationalPlanRecurrenceValues),
  ownerUserId: z.string().uuid("يجب تحديد المسؤول عن الخطة"),
})

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("toggle_occurrence_status"),
    occurrenceId: z.string().uuid("العنصر غير صالح"),
    status: z.enum(operationalPlanOccurrenceStatusValues),
  }),
])

function mapOccurrence(row: OperationalPlanOccurrenceRow): OperationalPlanOccurrenceRecord {
  return {
    id: row.id,
    planId: row.plan_id,
    sequenceNumber: row.sequence_number,
    label: row.label,
    dueAt: row.due_at,
    status: row.status,
    completedAt: row.completed_at,
  }
}

function mapPlan(row: OperationalPlanRow, occurrences: OperationalPlanOccurrenceRecord[], usersById: Map<string, UserRow>): OperationalPlanRecord {
  const completedCount = occurrences.filter((occurrence) => occurrence.status === "completed").length
  const progressPercentage = row.target_count > 0 ? Math.round((completedCount / row.target_count) * 1000) / 10 : 0

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    year: row.plan_year,
    recurrence: row.recurrence,
    targetCount: row.target_count,
    completedCount,
    progressPercentage,
    ownerUserId: row.owner_user_id,
    ownerUserName: row.owner_user_id ? (usersById.get(row.owner_user_id)?.full_name ?? "-") : "غير محدد",
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    occurrences,
  }
}

async function loadOperationalPlansPageData(currentUserId: string): Promise<OperationalPlansPageData> {
  const supabase = createSupabaseAdminClient()
  const [{ data: planRows, error: plansError }, { data: occurrenceRows, error: occurrencesError }, { data: userRows, error: usersError }] = await Promise.all([
    supabase.from("operational_plans").select("id,title,description,plan_year,recurrence,target_count,owner_user_id,created_by_user_id,created_at,updated_at").order("plan_year", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("operational_plan_occurrences").select("id,plan_id,sequence_number,label,due_at,status,completed_at,created_at,updated_at").order("sequence_number", { ascending: true }),
    supabase.from("app_users").select("id,full_name").order("full_name", { ascending: true }),
  ])

  if (plansError) {
    throw new Error(plansError.message)
  }

  if (occurrencesError) {
    throw new Error(occurrencesError.message)
  }

  if (usersError) {
    throw new Error(usersError.message)
  }

  const users = ((userRows ?? []) as UserRow[])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const occurrenceMap = new Map<string, OperationalPlanOccurrenceRecord[]>()

  for (const occurrenceRow of (occurrenceRows ?? []) as OperationalPlanOccurrenceRow[]) {
    const occurrence = mapOccurrence(occurrenceRow)
    const list = occurrenceMap.get(occurrence.planId) ?? []
    list.push(occurrence)
    occurrenceMap.set(occurrence.planId, list)
  }

  return {
    isManager: true,
    currentUserId,
    plans: ((planRows ?? []) as OperationalPlanRow[]).map((row) => mapPlan(row, occurrenceMap.get(row.id) ?? [], usersById)),
    assignableUsers: users.map((user) => ({ id: user.id, name: user.full_name })) as OperationalPlanAssignableUser[],
  }
}

async function requireManager() {
  const user = await requireCurrentUser()
  const isManager = user.role === "admin" && user.permissions.includes("*")

  if (!isManager) {
    return null
  }

  return user
}

async function syncTaskForOccurrence(params: {
  planId: string
  planTitle: string
  planDescription: string
  occurrenceId: string
  occurrenceLabel: string
  dueAt: string
  ownerUserId: string | null
  createdByUserId: string
  status: OperationalPlanOccurrenceStatus
  completedAt: string | null
}) {
  const supabase = createSupabaseAdminClient()

  if (!params.ownerUserId) {
    return
  }

  const taskTitle = `${params.planTitle} - ${params.occurrenceLabel}`
  const taskDescription = params.planDescription || `مهمة مولدة تلقائيًا من الخطة التشغيلية: ${params.planTitle}`
  const taskStatus = params.status === "completed" ? "completed" : "in_progress"

  const { data: existingTask, error: existingTaskError } = await supabase
    .from("user_tasks")
    .select("id")
    .eq("operational_plan_occurrence_id", params.occurrenceId)
    .maybeSingle<{ id: string }>()

  if (existingTaskError) {
    throw new Error(existingTaskError.message)
  }

  if (existingTask) {
    const { error: updateTaskError } = await supabase
      .from("user_tasks")
      .update({
        title: taskTitle,
        description: taskDescription,
        assigned_to_user_id: params.ownerUserId,
        assigned_by_user_id: params.createdByUserId,
        due_at: params.dueAt,
        status: taskStatus,
        completed_at: params.completedAt,
      })
      .eq("id", existingTask.id)

    if (updateTaskError) {
      throw new Error(updateTaskError.message)
    }

    return
  }

  const { data: insertedTasks, error: insertTaskError } = await supabase
    .from("user_tasks")
    .insert({
      task_kind: "task",
      title: taskTitle,
      description: taskDescription,
      assigned_to_user_id: params.ownerUserId,
      assigned_by_user_id: params.createdByUserId,
      due_at: params.dueAt,
      status: taskStatus,
      completed_at: params.completedAt,
      attachment_url: null,
      drive_folder_id: null,
      drive_folder_name: null,
      operational_plan_id: params.planId,
      operational_plan_occurrence_id: params.occurrenceId,
    })
    .select("id")

  if (insertTaskError) {
    throw new Error(insertTaskError.message)
  }

  const insertedTaskId = insertedTasks?.[0]?.id ?? null
  const { error: notificationError } = await supabase.from("task_notifications").insert({
    user_id: params.ownerUserId,
    task_id: insertedTaskId,
    notification_type: "new_task",
    title: `مهمة تشغيلية جديدة: ${taskTitle}`,
    body: `تم توليد مهمة تلقائيًا من الخطة التشغيلية وموعدها ${new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(new Date(params.dueAt))}`,
  })

  if (notificationError) {
    throw new Error(notificationError.message)
  }
}

export async function GET() {
  try {
    const user = await requireManager()
    if (!user) {
      return NextResponse.json({ error: "غير مصرح بإدارة الخطة التشغيلية" }, { status: 403 })
    }

    return NextResponse.json(await loadOperationalPlansPageData(user.id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل الخطط التشغيلية" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireManager()
    if (!user) {
      return NextResponse.json({ error: "غير مصرح بإنشاء خطة تشغيلية" }, { status: 403 })
    }

    const parsed = createPlanSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الخطة غير صحيحة" }, { status: 400 })
    }

    const payload = parsed.data
    const supabase = createSupabaseAdminClient()
    const targetCount = getOperationalPlanTargetCount(payload.recurrence)

    const { data: insertedPlans, error: insertPlanError } = await supabase
      .from("operational_plans")
      .insert({
        title: payload.title,
        description: payload.description,
        plan_year: payload.year,
        recurrence: payload.recurrence,
        target_count: targetCount,
        owner_user_id: payload.ownerUserId,
        created_by_user_id: user.id,
      })
      .select("id")

    if (insertPlanError) {
      throw new Error(insertPlanError.message)
    }

    const planId = insertedPlans?.[0]?.id
    if (!planId) {
      throw new Error("تعذر إنشاء الخطة التشغيلية")
    }

    const occurrences = buildOperationalPlanOccurrences(payload.year, payload.recurrence)
    const { data: insertedOccurrences, error: insertOccurrencesError } = await supabase.from("operational_plan_occurrences").insert(
      occurrences.map((occurrence) => ({
        plan_id: planId,
        sequence_number: occurrence.sequenceNumber,
        label: occurrence.label,
        due_at: occurrence.dueAt,
        status: occurrence.status,
        completed_at: occurrence.completedAt,
      })),
    ).select("id,label,due_at,status,completed_at")

    if (insertOccurrencesError) {
      throw new Error(insertOccurrencesError.message)
    }

    for (const occurrence of insertedOccurrences ?? []) {
      await syncTaskForOccurrence({
        planId,
        planTitle: payload.title,
        planDescription: payload.description,
        occurrenceId: occurrence.id,
        occurrenceLabel: occurrence.label,
        dueAt: occurrence.due_at,
        ownerUserId: payload.ownerUserId,
        createdByUserId: user.id,
        status: occurrence.status,
        completedAt: occurrence.completed_at,
      })
    }

    return NextResponse.json(await loadOperationalPlansPageData(user.id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر إنشاء الخطة التشغيلية" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireManager()
    if (!user) {
      return NextResponse.json({ error: "غير مصرح بتحديث الخطة التشغيلية" }, { status: 403 })
    }

    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "البيانات غير صحيحة" }, { status: 400 })
    }

    const payload = parsed.data
    const supabase = createSupabaseAdminClient()

    const { data: occurrenceRow, error: occurrenceError } = await supabase
      .from("operational_plan_occurrences")
      .select("id,plan_id,label,due_at")
      .eq("id", payload.occurrenceId)
      .maybeSingle<{ id: string; plan_id: string; label: string; due_at: string }>()

    if (occurrenceError) {
      throw new Error(occurrenceError.message)
    }

    if (!occurrenceRow) {
      return NextResponse.json({ error: "عنصر الخطة غير موجود" }, { status: 404 })
    }

    const completedAt = payload.status === "completed" ? new Date().toISOString() : null
    const { error } = await supabase
      .from("operational_plan_occurrences")
      .update({
        status: payload.status,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.occurrenceId)

    if (error) {
      throw new Error(error.message)
    }

    const { data: planRow, error: planError } = await supabase
      .from("operational_plans")
      .select("id,title,description,owner_user_id,created_by_user_id")
      .eq("id", occurrenceRow.plan_id)
      .maybeSingle<{ id: string; title: string; description: string; owner_user_id: string | null; created_by_user_id: string | null }>()

    if (planError) {
      throw new Error(planError.message)
    }

    if (planRow) {
      await syncTaskForOccurrence({
        planId: planRow.id,
        planTitle: planRow.title,
        planDescription: planRow.description,
        occurrenceId: occurrenceRow.id,
        occurrenceLabel: occurrenceRow.label,
        dueAt: occurrenceRow.due_at,
        ownerUserId: planRow.owner_user_id,
        createdByUserId: planRow.created_by_user_id ?? user.id,
        status: payload.status,
        completedAt,
      })
    }

    return NextResponse.json(await loadOperationalPlansPageData(user.id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحديث الخطة التشغيلية" }, { status: 500 })
  }
}