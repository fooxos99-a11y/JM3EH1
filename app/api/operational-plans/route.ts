import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCurrentUser } from "@/lib/auth"
import {
  buildOperationalPlanDistribution,
  buildOperationalPlanOccurrences,
  calculateOperationalPlanProgress,
  getOperationalPlanMonthLabel,
  getOperationalPlanOccurrenceStatus,
  getOperationalPlanTargetCount,
  normalizeOperationalPlanCount,
  normalizeOperationalPlanMonthlyTargets,
  normalizeOperationalPlanProgressPercentage,
  type OperationalPlanAssignableUser,
  type OperationalPlanOccurrenceRecord,
  type OperationalPlanOccurrenceStatus,
  type OperationalPlanRecord,
  type OperationalPlansPageData,
} from "@/lib/operational-plans"
import { countWeekSegmentsInMonth, defaultOperationalPlanWeekEndDay, getWeekBoundaryOnOrAfter, type OperationalPlanWeekEndDay } from "@/lib/operational-plan-settings"
import { getSiteSectionContent } from "@/lib/site-content"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type OperationalPlanRow = {
  id: string
  title: string
  description: string
  plan_year: number
  annual_target: number | null
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
  target_value: number | null
  achieved_value: number | null
  progress_percentage: number
  status: OperationalPlanOccurrenceStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

type UserRow = {
  id: string
  full_name: string
}

type OperationalPlanMutationPayload = {
  plan: OperationalPlanRecord
}

type OperationalPlanOccurrenceMutationPayload = {
  planId: string
  occurrences: OperationalPlanOccurrenceRecord[]
}

type OperationalPlanDeletePayload = {
  planId: string
}

const createPlanSchema = z.object({
  title: z.string().trim().min(3, "اسم الخطة مطلوب"),
  description: z.string().trim().optional().transform((value) => value ?? ""),
  year: z.number().int().min(2024, "السنة غير صالحة").max(2100, "السنة غير صالحة"),
  annualTarget: z.number().int().min(1, "المستهدف السنوي غير صالح").max(10000, "المستهدف السنوي غير صالح"),
  distributionMode: z.enum(["automatic", "manual"]),
  monthlyTargets: z.array(z.number().int().min(0, "التخطيط الشهري غير صالح").max(100000, "التخطيط الشهري غير صالح")).length(12).optional(),
  ownerUserId: z.string().uuid("يجب تحديد المسؤول عن الخطة"),
})

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("update_occurrence_achievement"),
    planId: z.string().uuid("الخطة غير صالحة"),
    monthNumber: z.number().int().min(1, "الشهر غير صالح").max(12, "الشهر غير صالح"),
    achievedValue: z.number().int().min(0, "المنجز الشهري غير صالح").max(100000, "المنجز الشهري غير صالح"),
  }),
  z.object({
    action: z.literal("move_occurrence_target"),
    planId: z.string().uuid("الخطة غير صالحة"),
    fromMonthNumber: z.number().int().min(1, "الشهر غير صالح").max(12, "الشهر غير صالح"),
    toMonthNumber: z.number().int().min(1, "الشهر غير صالح").max(12, "الشهر غير صالح"),
  }),
])

function buildMonthlyPlanOccurrences(plan: OperationalPlanRow, rows: OperationalPlanOccurrenceRow[]) {
  const annualTarget = normalizeOperationalPlanCount(plan.annual_target ?? plan.target_count)
  const distribution = buildOperationalPlanDistribution(annualTarget)

  return Array.from({ length: 12 }, (_, index) => {
    const monthNumber = index + 1
    const dueAt = new Date(Date.UTC(plan.plan_year, index, 1)).toISOString()
    const row = rows.find((item) => item.sequence_number === monthNumber) ?? rows.find((item) => (new Date(item.due_at).getUTCMonth() + 1) === monthNumber) ?? null
    const targetValue = normalizeOperationalPlanCount(row?.target_value ?? distribution[index] ?? 0)
    const achievedValue = normalizeOperationalPlanCount(
      row?.achieved_value ?? (targetValue > 0 ? Math.round((targetValue * normalizeOperationalPlanProgressPercentage(row?.progress_percentage ?? 0)) / 100) : 0),
    )
    const progressPercentage = calculateOperationalPlanProgress(achievedValue, targetValue)
    const status = getOperationalPlanOccurrenceStatus(progressPercentage)

    return {
      id: `${plan.id}-${monthNumber}`,
      planId: plan.id,
      monthNumber,
      sequenceNumber: monthNumber,
      label: `${getOperationalPlanMonthLabel(dueAt)} (${monthNumber})`,
      dueAt,
      targetValue,
      achievedValue,
      progressPercentage,
      status,
      completedAt: status === "completed" ? row?.completed_at ?? null : null,
    } satisfies OperationalPlanOccurrenceRecord
  })
}

function mapPlan(row: OperationalPlanRow, occurrences: OperationalPlanOccurrenceRecord[], usersById: Map<string, UserRow>): OperationalPlanRecord {
  const annualTarget = normalizeOperationalPlanCount(row.annual_target ?? row.target_count)
  const achievedTotal = occurrences.reduce((sum, occurrence) => sum + occurrence.achievedValue, 0)
  const completedCount = occurrences.filter((occurrence) => occurrence.progressPercentage >= 100).length
  const progressPercentage = calculateOperationalPlanProgress(achievedTotal, annualTarget)

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    year: row.plan_year,
    annualTarget,
    achievedTotal,
    targetCount: getOperationalPlanTargetCount("monthly"),
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

function isOperationalPlansManager(user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  return user.role === "admin" && user.permissions.includes("*")
}

async function loadOperationalPlansPageData(currentUserId: string, isManager: boolean, scope: "self" | "all" = "all"): Promise<OperationalPlansPageData> {
  const supabase = createSupabaseAdminClient()
  const canManageAllPlans = isManager && scope === "all"
  const plansQuery = supabase.from("operational_plans").select("id,title,description,plan_year,annual_target,target_count,owner_user_id,created_by_user_id,created_at,updated_at")

  if (!canManageAllPlans) {
    plansQuery.eq("owner_user_id", currentUserId)
  }

  const [{ data: planRows, error: plansError }, { data: userRows, error: usersError }] = await Promise.all([
    plansQuery.order("plan_year", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("app_users").select("id,full_name").order("full_name", { ascending: true }),
  ])

  if (plansError) {
    throw new Error(plansError.message)
  }

  if (usersError) {
    throw new Error(usersError.message)
  }

  const planIds = ((planRows ?? []) as OperationalPlanRow[]).map((row) => row.id)
  const occurrenceRows = planIds.length === 0
    ? []
    : await supabase
      .from("operational_plan_occurrences")
      .select("id,plan_id,sequence_number,label,due_at,target_value,achieved_value,progress_percentage,status,completed_at,created_at,updated_at")
      .in("plan_id", planIds)
      .order("sequence_number", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          throw new Error(error.message)
        }

        return (data ?? []) as OperationalPlanOccurrenceRow[]
      })

  const users = ((userRows ?? []) as UserRow[])
  const usersById = new Map(users.map((user) => [user.id, user]))
  const occurrenceMap = new Map<string, OperationalPlanOccurrenceRow[]>()

  for (const occurrenceRow of occurrenceRows) {
    const list = occurrenceMap.get(occurrenceRow.plan_id) ?? []
    list.push(occurrenceRow)
    occurrenceMap.set(occurrenceRow.plan_id, list)
  }

  return {
    isManager: canManageAllPlans,
    currentUserId,
    plans: ((planRows ?? []) as OperationalPlanRow[]).map((row) => mapPlan(row, buildMonthlyPlanOccurrences(row, occurrenceMap.get(row.id) ?? []), usersById)),
    assignableUsers: canManageAllPlans ? users.map((user) => ({ id: user.id, name: user.full_name })) as OperationalPlanAssignableUser[] : [],
  }
}

async function loadAssignableUsers() {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.from("app_users").select("id,full_name").order("full_name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as UserRow[]).map((user) => ({ id: user.id, name: user.full_name })) as OperationalPlanAssignableUser[]
}

async function requireManager() {
  const user = await requireCurrentUser()
  const isManager = isOperationalPlansManager(user)

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
  targetValue: number
  achievedValue: number
  weekEndDay: OperationalPlanWeekEndDay
}) {
  const supabase = createSupabaseAdminClient()

  if (!params.ownerUserId) {
    return
  }

  const targetValue = normalizeOperationalPlanCount(params.targetValue)
  const achievedValue = Math.min(normalizeOperationalPlanCount(params.achievedValue), targetValue)

  const { data: existingTasks, error: existingTaskError } = await supabase
    .from("user_tasks")
    .select("id,operational_plan_task_index,completed_at")
    .eq("operational_plan_occurrence_id", params.occurrenceId)
    .order("operational_plan_task_index", { ascending: true })

  if (existingTaskError) {
    throw new Error(existingTaskError.message)
  }

  if (targetValue <= 0) {
    if ((existingTasks ?? []).length > 0) {
      const { error: deleteTaskError } = await supabase
        .from("user_tasks")
        .delete()
        .eq("operational_plan_occurrence_id", params.occurrenceId)

      if (deleteTaskError) {
        throw new Error(deleteTaskError.message)
      }
    }

    return
  }

  const existingTasksByIndex = new Map((existingTasks ?? []).map((task) => [normalizeOperationalPlanCount(task.operational_plan_task_index ?? 1), task]))
  const now = Date.now()

  for (const schedule of buildOccurrenceTaskSchedules(params.dueAt, targetValue, params.weekEndDay)) {
    const existingTask = existingTasksByIndex.get(schedule.index)
    const taskTitle = targetValue > 1
      ? `${params.planTitle} - ${params.occurrenceLabel} - ${getOccurrenceTaskPartLabel(schedule.index, targetValue)}`
      : `${params.planTitle} - ${params.occurrenceLabel}`
    const taskDescription = params.planDescription
      ? `من الخطة التشغيلية: ${params.planTitle}\n${params.planDescription}`
      : `من الخطة التشغيلية: ${params.planTitle}`
    const isCompletedTask = schedule.index <= achievedValue
    const taskStatus = isCompletedTask ? "completed" : "in_progress"
    const taskCompletedAt = isCompletedTask ? (existingTask?.completed_at ?? new Date().toISOString()) : null

    if (existingTask) {
      const { error: updateTaskError } = await supabase
        .from("user_tasks")
        .update({
          title: taskTitle,
          description: taskDescription,
          assigned_to_user_id: params.ownerUserId,
          assigned_by_user_id: params.createdByUserId,
          due_at: schedule.dueAt,
          status: taskStatus,
          completed_at: taskCompletedAt,
          operational_plan_task_index: schedule.index,
          operational_plan_task_count: targetValue,
          operational_plan_release_at: schedule.releaseAt,
        })
        .eq("id", existingTask.id)

      if (updateTaskError) {
        throw new Error(updateTaskError.message)
      }

      continue
    }

    const { data: insertedTasks, error: insertTaskError } = await supabase
      .from("user_tasks")
      .insert({
        task_kind: "task",
        title: taskTitle,
        description: taskDescription,
        assigned_to_user_id: params.ownerUserId,
        assigned_by_user_id: params.createdByUserId,
        due_at: schedule.dueAt,
        status: taskStatus,
        completed_at: taskCompletedAt,
        attachment_url: null,
        drive_folder_id: null,
        drive_folder_name: null,
        operational_plan_id: params.planId,
        operational_plan_occurrence_id: params.occurrenceId,
        operational_plan_task_index: schedule.index,
        operational_plan_task_count: targetValue,
        operational_plan_release_at: schedule.releaseAt,
      })
      .select("id")

    if (insertTaskError) {
      throw new Error(insertTaskError.message)
    }

    if (new Date(schedule.releaseAt).getTime() > now) {
      continue
    }

    const insertedTaskId = insertedTasks?.[0]?.id ?? null
    const { error: notificationError } = await supabase.from("task_notifications").insert({
      user_id: params.ownerUserId,
      task_id: insertedTaskId,
      notification_type: "new_task",
      title: `مهمة تشغيلية جديدة: ${taskTitle}`,
      body: `تم توليد مهمة تلقائيًا من الخطة التشغيلية وموعدها ${new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeStyle: "short" }).format(new Date(schedule.dueAt))}`,
    })

    if (notificationError) {
      throw new Error(notificationError.message)
    }
  }

  const extraTaskIds = (existingTasks ?? [])
    .filter((task) => normalizeOperationalPlanCount(task.operational_plan_task_index ?? 1) > targetValue)
    .map((task) => task.id)

  if (extraTaskIds.length > 0) {
    const { error: deleteTaskError } = await supabase
      .from("user_tasks")
      .delete()
      .in("id", extraTaskIds)

    if (deleteTaskError) {
      throw new Error(deleteTaskError.message)
    }
  }
}

function buildOccurrenceTaskSchedules(dueAtValue: string, taskCount: number, weekEndDay: OperationalPlanWeekEndDay) {
  const dueAt = new Date(dueAtValue)
  const year = dueAt.getUTCFullYear()
  const month = dueAt.getUTCMonth()
  const monthStart = new Date(Date.UTC(year, month, 1, 0, 0, 0))
  const monthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 0))

  if (taskCount <= 1) {
    return [{
      index: 1,
      releaseAt: monthStart.toISOString(),
      dueAt: monthEnd.toISOString(),
    }]
  }

  const maxWeekSegments = countWeekSegmentsInMonth(year, month, weekEndDay)

  if (taskCount > maxWeekSegments) {
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

    return Array.from({ length: taskCount }, (_, index) => {
      const startDay = Math.floor((index * daysInMonth) / taskCount) + 1
      const endDay = Math.max(startDay, Math.floor((((index + 1) * daysInMonth) / taskCount)))

      return {
        index: index + 1,
        releaseAt: new Date(Date.UTC(year, month, startDay, 0, 0, 0)).toISOString(),
        dueAt: new Date(Date.UTC(year, month, endDay, 23, 59, 0)).toISOString(),
      }
    })
  }

  const schedules: Array<{ index: number; releaseAt: string; dueAt: string }> = []
  let segmentStart = monthStart

  for (let index = 1; index <= taskCount; index += 1) {
    const segmentEnd = index === taskCount
      ? monthEnd
      : getWeekBoundaryOnOrAfter(segmentStart, weekEndDay, monthEnd)

    schedules.push({
      index,
      releaseAt: segmentStart.toISOString(),
      dueAt: segmentEnd.toISOString(),
    })

    segmentStart = new Date(Date.UTC(
      segmentEnd.getUTCFullYear(),
      segmentEnd.getUTCMonth(),
      segmentEnd.getUTCDate() + 1,
      0,
      0,
      0,
    ))

    if (segmentStart.getTime() > monthEnd.getTime()) {
      break
    }
  }

  return schedules
}

function getOccurrenceTaskPartLabel(index: number, taskCount: number) {
  if (taskCount === 4) {
    return `الأسبوع ${index}`
  }

  return `الجزء ${index} من ${taskCount}`
}

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser()
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get("scope") === "self" ? "self" : "all"

    return NextResponse.json(await loadOperationalPlansPageData(user.id, isOperationalPlansManager(user), scope))
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
    const settings = await getSiteSectionContent("settings")
    const weekEndDay = settings.operationalPlanWeekEndDay ?? defaultOperationalPlanWeekEndDay
    const annualTarget = normalizeOperationalPlanCount(payload.annualTarget)
    const monthlyTargets = payload.distributionMode === "manual" ? normalizeOperationalPlanMonthlyTargets(payload.monthlyTargets) : null

    if (monthlyTargets && monthlyTargets.reduce((sum, value) => sum + value, 0) !== annualTarget) {
      return NextResponse.json({ error: "يجب أن يساوي مجموع التخطيط الشهري المستهدف السنوي" }, { status: 400 })
    }

    const targetCount = getOperationalPlanTargetCount("monthly")

    const { data: insertedPlans, error: insertPlanError } = await supabase
      .from("operational_plans")
      .insert({
        title: payload.title,
        description: payload.description,
        plan_year: payload.year,
        recurrence: "monthly",
        annual_target: annualTarget,
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

    const occurrences = buildOperationalPlanOccurrences(payload.year, annualTarget, monthlyTargets)
    const { data: insertedOccurrences, error: insertOccurrencesError } = await supabase
      .from("operational_plan_occurrences")
      .insert(
        occurrences.map((occurrence) => ({
          plan_id: planId,
          sequence_number: occurrence.sequenceNumber,
          label: occurrence.label,
          due_at: occurrence.dueAt,
          target_value: occurrence.targetValue,
          achieved_value: occurrence.achievedValue,
          progress_percentage: occurrence.progressPercentage,
          status: occurrence.status,
          completed_at: occurrence.completedAt,
        })),
      )
      .select("id,sequence_number,label,due_at,target_value,achieved_value,progress_percentage,status,completed_at")

    if (insertOccurrencesError) {
      throw new Error(insertOccurrencesError.message)
    }

    await Promise.all((insertedOccurrences ?? []).filter((occurrence) => normalizeOperationalPlanCount(occurrence.target_value) > 0).map(async (occurrence) => {
      await syncTaskForOccurrence({
        planId,
        planTitle: payload.title,
        planDescription: payload.description,
        occurrenceId: occurrence.id,
        occurrenceLabel: occurrence.label,
        dueAt: occurrence.due_at,
        ownerUserId: payload.ownerUserId,
        createdByUserId: user.id,
        targetValue: normalizeOperationalPlanCount(occurrence.target_value),
        achievedValue: normalizeOperationalPlanCount(occurrence.achieved_value),
        weekEndDay,
      })
    }))

    const assignableUsers = await loadAssignableUsers()
    const ownerUserName = assignableUsers.find((assignableUser) => assignableUser.id === payload.ownerUserId)?.name ?? "-"
    const mappedOccurrences = (insertedOccurrences ?? []).map((occurrence, index) => ({
      id: `${planId}-${occurrence.sequence_number ?? index + 1}`,
      planId,
      monthNumber: occurrence.sequence_number ?? index + 1,
      sequenceNumber: occurrence.sequence_number ?? index + 1,
      label: occurrence.label,
      dueAt: occurrence.due_at,
      targetValue: normalizeOperationalPlanCount(occurrence.target_value),
      achievedValue: normalizeOperationalPlanCount(occurrence.achieved_value),
      progressPercentage: normalizeOperationalPlanProgressPercentage(occurrence.progress_percentage),
      status: occurrence.status,
      completedAt: occurrence.completed_at,
    })) satisfies OperationalPlanOccurrenceRecord[]

    return NextResponse.json({
      plan: {
        id: planId,
        title: payload.title,
        description: payload.description,
        year: payload.year,
        annualTarget,
        achievedTotal: 0,
        targetCount,
        completedCount: 0,
        progressPercentage: 0,
        ownerUserId: payload.ownerUserId,
        ownerUserName,
        createdByUserId: user.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        occurrences: mappedOccurrences,
      },
    } satisfies OperationalPlanMutationPayload)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر إنشاء الخطة التشغيلية" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireCurrentUser()
    const isManager = isOperationalPlansManager(user)

    const parsed = patchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "البيانات غير صحيحة" }, { status: 400 })
    }

    const payload = parsed.data
    const supabase = createSupabaseAdminClient()
    const settings = await getSiteSectionContent("settings")
    const weekEndDay = settings.operationalPlanWeekEndDay ?? defaultOperationalPlanWeekEndDay

    const { data: planRow, error: planError } = await supabase
      .from("operational_plans")
      .select("id,title,description,owner_user_id,created_by_user_id,target_count,annual_target,plan_year")
      .eq("id", payload.planId)
      .maybeSingle<{ id: string; title: string; description: string; owner_user_id: string | null; created_by_user_id: string | null; target_count: number; annual_target: number | null; plan_year: number }>()

    if (planError) {
      throw new Error(planError.message)
    }

    if (!planRow) {
      return NextResponse.json({ error: "الخطة التشغيلية غير موجودة" }, { status: 404 })
    }

    if (!isManager && planRow.owner_user_id !== user.id) {
      return NextResponse.json({ error: "غير مصرح بتحديث هذا العنصر" }, { status: 403 })
    }

    if (payload.action === "move_occurrence_target") {
      if (payload.fromMonthNumber === payload.toMonthNumber) {
        return NextResponse.json({ error: "اختر شهرًا مختلفًا" }, { status: 400 })
      }

      const { data: monthRows, error: monthRowsError } = await supabase
        .from("operational_plan_occurrences")
        .select("id,sequence_number,label,due_at,target_value,achieved_value,progress_percentage,status,completed_at")
        .eq("plan_id", planRow.id)
        .in("sequence_number", [payload.fromMonthNumber, payload.toMonthNumber])

      if (monthRowsError) {
        throw new Error(monthRowsError.message)
      }

      const rowsBySequence = new Map((monthRows ?? []).map((row) => [row.sequence_number, row as Pick<OperationalPlanOccurrenceRow, "id" | "sequence_number" | "label" | "due_at" | "target_value" | "achieved_value" | "progress_percentage" | "status" | "completed_at">]))
      const sourceRow = rowsBySequence.get(payload.fromMonthNumber)
      const destinationRow = rowsBySequence.get(payload.toMonthNumber)

      const sourceTargetValue = normalizeOperationalPlanCount(sourceRow?.target_value ?? 0)
      const sourceAchievedValue = normalizeOperationalPlanCount(sourceRow?.achieved_value ?? 0)

      if (sourceTargetValue <= 0) {
        return NextResponse.json({ error: "لا يوجد مستهدف لنقله من هذا الشهر" }, { status: 400 })
      }

      if (sourceAchievedValue > 0) {
        return NextResponse.json({ error: "لا يمكن نقل الشهر بعد بدء الإنجاز عليه" }, { status: 400 })
      }

      const destinationTargetValue = normalizeOperationalPlanCount(destinationRow?.target_value ?? 0)
      const destinationAchievedValue = normalizeOperationalPlanCount(destinationRow?.achieved_value ?? 0)
      const nextDestinationTargetValue = destinationTargetValue + sourceTargetValue
      const destinationProgress = calculateOperationalPlanProgress(destinationAchievedValue, nextDestinationTargetValue)
      const destinationStatus = getOperationalPlanOccurrenceStatus(destinationProgress)
      const destinationCompletedAt = destinationStatus === "completed" ? (destinationRow?.completed_at ?? new Date().toISOString()) : null
      const sourceDueAt = new Date(Date.UTC(planRow.plan_year, payload.fromMonthNumber - 1, 1)).toISOString()
      const destinationDueAt = new Date(Date.UTC(planRow.plan_year, payload.toMonthNumber - 1, 1)).toISOString()

      const { error: sourceUpdateError } = await supabase
        .from("operational_plan_occurrences")
        .update({
          label: `${getOperationalPlanMonthLabel(sourceDueAt)} (${payload.fromMonthNumber})`,
          due_at: sourceDueAt,
          target_value: 0,
          achieved_value: 0,
          progress_percentage: 0,
          status: "pending",
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("plan_id", planRow.id)
        .eq("sequence_number", payload.fromMonthNumber)

      if (sourceUpdateError) {
        throw new Error(sourceUpdateError.message)
      }

      const { data: savedDestination, error: destinationUpdateError } = await supabase
        .from("operational_plan_occurrences")
        .upsert({
          id: destinationRow?.id,
          plan_id: planRow.id,
          sequence_number: payload.toMonthNumber,
          label: `${getOperationalPlanMonthLabel(destinationDueAt)} (${payload.toMonthNumber})`,
          due_at: destinationDueAt,
          target_value: nextDestinationTargetValue,
          achieved_value: destinationAchievedValue,
          progress_percentage: destinationProgress,
          status: destinationStatus,
          completed_at: destinationCompletedAt,
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single<{ id: string }>()

      if (destinationUpdateError) {
        throw new Error(destinationUpdateError.message)
      }

      await syncTaskForOccurrence({
        planId: planRow.id,
        planTitle: planRow.title,
        planDescription: planRow.description,
        occurrenceId: sourceRow?.id ?? `${planRow.id}-${payload.fromMonthNumber}`,
        occurrenceLabel: `${getOperationalPlanMonthLabel(sourceDueAt)} (${payload.fromMonthNumber})`,
        dueAt: sourceDueAt,
        ownerUserId: planRow.owner_user_id,
        createdByUserId: planRow.created_by_user_id ?? user.id,
        targetValue: 0,
        achievedValue: 0,
        weekEndDay,
      })

      await syncTaskForOccurrence({
        planId: planRow.id,
        planTitle: planRow.title,
        planDescription: planRow.description,
        occurrenceId: savedDestination.id,
        occurrenceLabel: `${getOperationalPlanMonthLabel(destinationDueAt)} (${payload.toMonthNumber})`,
        dueAt: destinationDueAt,
        ownerUserId: planRow.owner_user_id,
        createdByUserId: planRow.created_by_user_id ?? user.id,
        targetValue: nextDestinationTargetValue,
        achievedValue: destinationAchievedValue,
        weekEndDay,
      })

      return NextResponse.json({
        planId: planRow.id,
        occurrences: [
          {
            id: `${planRow.id}-${payload.fromMonthNumber}`,
            planId: planRow.id,
            monthNumber: payload.fromMonthNumber,
            sequenceNumber: payload.fromMonthNumber,
            label: `${getOperationalPlanMonthLabel(sourceDueAt)} (${payload.fromMonthNumber})`,
            dueAt: sourceDueAt,
            targetValue: 0,
            achievedValue: 0,
            progressPercentage: 0,
            status: "pending",
            completedAt: null,
          },
          {
            id: `${planRow.id}-${payload.toMonthNumber}`,
            planId: planRow.id,
            monthNumber: payload.toMonthNumber,
            sequenceNumber: payload.toMonthNumber,
            label: `${getOperationalPlanMonthLabel(destinationDueAt)} (${payload.toMonthNumber})`,
            dueAt: destinationDueAt,
            targetValue: nextDestinationTargetValue,
            achievedValue: destinationAchievedValue,
            progressPercentage: destinationProgress,
            status: destinationStatus,
            completedAt: destinationCompletedAt,
          },
        ],
      } satisfies OperationalPlanOccurrenceMutationPayload)
    }

    const achievedValue = normalizeOperationalPlanCount(payload.achievedValue)

    const { data: existingOccurrence, error: existingOccurrenceError } = await supabase
      .from("operational_plan_occurrences")
      .select("id,target_value")
      .eq("plan_id", planRow.id)
      .eq("sequence_number", payload.monthNumber)
      .maybeSingle<{ id: string; target_value: number | null }>()

    if (existingOccurrenceError) {
      throw new Error(existingOccurrenceError.message)
    }

    const distribution = buildOperationalPlanDistribution(planRow.annual_target ?? planRow.target_count)
    const targetValue = normalizeOperationalPlanCount(existingOccurrence?.target_value ?? distribution[payload.monthNumber - 1] ?? 0)
    const progressPercentage = calculateOperationalPlanProgress(achievedValue, targetValue)
    const status = getOperationalPlanOccurrenceStatus(progressPercentage)
    const completedAt = status === "completed" ? new Date().toISOString() : null
    const dueAt = new Date(Date.UTC(planRow.plan_year, payload.monthNumber - 1, 1)).toISOString()

    const { data: savedOccurrence, error } = await supabase
      .from("operational_plan_occurrences")
      .upsert({
        id: existingOccurrence?.id,
        plan_id: planRow.id,
        sequence_number: payload.monthNumber,
        label: `${getOperationalPlanMonthLabel(dueAt)} (${payload.monthNumber})`,
        due_at: dueAt,
        target_value: targetValue,
        achieved_value: achievedValue,
        progress_percentage: progressPercentage,
        status,
        completed_at: completedAt,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single<{ id: string }>()

    if (error) {
      throw new Error(error.message)
    }

    if (targetValue > 0 || achievedValue > 0) {
      void syncTaskForOccurrence({
        planId: planRow.id,
        planTitle: planRow.title,
        planDescription: planRow.description,
        occurrenceId: savedOccurrence.id,
        occurrenceLabel: `${getOperationalPlanMonthLabel(dueAt)} (${payload.monthNumber})`,
        dueAt,
        ownerUserId: planRow.owner_user_id,
        createdByUserId: planRow.created_by_user_id ?? user.id,
        targetValue,
        achievedValue,
        weekEndDay,
      }).catch((syncError) => {
        console.error("Operational plan task sync failed", syncError)
      })
    }

    return NextResponse.json({
      planId: planRow.id,
      occurrences: [{
        id: `${planRow.id}-${payload.monthNumber}`,
        planId: planRow.id,
        monthNumber: payload.monthNumber,
        sequenceNumber: payload.monthNumber,
        label: `${getOperationalPlanMonthLabel(dueAt)} (${payload.monthNumber})`,
        dueAt,
        targetValue,
        achievedValue,
        progressPercentage,
        status,
        completedAt,
      }],
    } satisfies OperationalPlanOccurrenceMutationPayload)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحديث الخطة التشغيلية" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireManager()
    if (!user) {
      return NextResponse.json({ error: "غير مصرح بحذف الخطة التشغيلية" }, { status: 403 })
    }

    const url = new URL(request.url)
    const planId = url.searchParams.get("planId")

    if (!planId) {
      return NextResponse.json({ error: "معرف الخطة غير صالح" }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()

    const { data: planRow, error: planError } = await supabase
      .from("operational_plans")
      .select("id")
      .eq("id", planId)
      .maybeSingle<{ id: string }>()

    if (planError) {
      throw new Error(planError.message)
    }

    if (!planRow) {
      return NextResponse.json({ error: "الخطة التشغيلية غير موجودة" }, { status: 404 })
    }

    const { error: tasksError } = await supabase
      .from("user_tasks")
      .delete()
      .eq("operational_plan_id", planId)

    if (tasksError) {
      throw new Error(tasksError.message)
    }

    const { error: deletePlanError } = await supabase
      .from("operational_plans")
      .delete()
      .eq("id", planId)

    if (deletePlanError) {
      throw new Error(deletePlanError.message)
    }

    return NextResponse.json({ planId } satisfies OperationalPlanDeletePayload)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حذف الخطة التشغيلية" }, { status: 500 })
  }
}
