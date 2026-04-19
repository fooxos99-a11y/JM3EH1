import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCurrentUser } from "@/lib/auth"
import type { AchievementTeamUser, AchievementsPageData, EmployeeWeeklyAchievementGroup, WeeklyAchievementEntry } from "@/lib/achievements-log"
import { endOfWeekMonday, formatDateInput, getWeekRangeFromStartDate, startOfWeekMonday } from "@/lib/achievements-log"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type AchievementRow = {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  achievement_text: string
  image_url: string | null
  created_at: string
  updated_at: string
}

type UserRow = {
  id: string
  full_name: string
}

const postSchema = z.object({
  achievementText: z.string().trim().min(3, "أدخل نص الإنجاز"),
  imageUrl: z.string().url("رابط الصورة غير صالح").nullable().optional(),
  weekStartDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
})

function isSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false
  }

  return error.code === "42P01" || error.code === "42703" || error.code === "22P02"
}

function schemaResponse() {
  return NextResponse.json(
    { error: "يجب تطبيق آخر تحديث لملف قاعدة البيانات قبل استخدام سجل الإنجازات" },
    { status: 503 },
  )
}

function mapEntry(row: AchievementRow, usersById: Map<string, UserRow>): WeeklyAchievementEntry {
  return {
    id: row.id,
    userId: row.user_id,
    userName: usersById.get(row.user_id)?.full_name ?? "موظف",
    weekStartDate: row.week_start_date,
    weekEndDate: row.week_end_date,
    achievementText: row.achievement_text,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function loadAchievementsPageData(currentUserId: string, isManager: boolean, weekStartDateParam?: string): Promise<AchievementsPageData> {
  const today = new Date()
  const currentWeekStart = startOfWeekMonday(today)
  const currentWeekEnd = endOfWeekMonday(today)

  const selectedWeek = weekStartDateParam ? new Date(`${weekStartDateParam}T00:00:00`) : currentWeekStart
  const selectedWeekStart = startOfWeekMonday(selectedWeek)
  const selectedWeekEnd = endOfWeekMonday(selectedWeek)
  const selectedWeekStartDate = formatDateInput(selectedWeekStart)
  const selectedWeekEndDate = formatDateInput(selectedWeekEnd)

  const supabase = createSupabaseAdminClient()

  const { data: entryRows, error: entryError } = await supabase
    .from("weekly_achievement_entries")
    .select("id,user_id,week_start_date,week_end_date,achievement_text,image_url,created_at,updated_at")
    .eq("week_start_date", selectedWeekStartDate)
    .order("created_at", { ascending: false })

  if (entryError) {
    if (isSchemaMissing(entryError)) {
      throw new Error("SCHEMA_MISSING")
    }

    throw new Error(entryError.message)
  }

  const rows = (entryRows ?? []) as AchievementRow[]
  const usersQuery = isManager
    ? supabase.from("app_users").select("id,full_name").eq("role", "admin")
    : supabase.from("app_users").select("id,full_name").in("id", Array.from(new Set(rows.map((row) => row.user_id).concat(currentUserId))))
  const { data: userRows, error: userError } = await usersQuery

  if (userError) {
    throw new Error(userError.message)
  }

  const usersById = new Map((userRows ?? []).map((row) => [row.id, row as UserRow]))
  const mappedEntries = rows.map((row) => mapEntry(row, usersById))
  const myEntries = mappedEntries.filter((entry) => entry.userId === currentUserId)
  const teamUsers: AchievementTeamUser[] = isManager
    ? Array.from(usersById.values())
        .map((row) => ({ userId: row.id, userName: row.full_name }))
        .sort((left, right) => left.userName.localeCompare(right.userName, "ar"))
    : []

  const groupedMap = new Map<string, EmployeeWeeklyAchievementGroup>()
  for (const entry of mappedEntries) {
    const current = groupedMap.get(entry.userId)
    if (current) {
      current.entries.push(entry)
      continue
    }

    groupedMap.set(entry.userId, {
      userId: entry.userId,
      userName: entry.userName,
      entries: [entry],
    })
  }

  return {
    currentUserId,
    isManager,
    selectedWeekStartDate,
    selectedWeekEndDate,
    currentWeekStartDate: formatDateInput(currentWeekStart),
    currentWeekEndDate: formatDateInput(currentWeekEnd),
    myEntries,
    teamGroups: isManager ? Array.from(groupedMap.values()).sort((a, b) => a.userName.localeCompare(b.userName, "ar")) : [],
    teamUsers,
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser()
    const { searchParams } = new URL(request.url)
    const weekStartDate = searchParams.get("weekStartDate") ?? undefined
    const isManager = user.role === "admin" && user.permissions.includes("*")
    return NextResponse.json(await loadAchievementsPageData(user.id, isManager, weekStartDate))
  } catch (error) {
    if (error instanceof Error && error.message === "SCHEMA_MISSING") {
      return schemaResponse()
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل الإنجازات" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser()
    const payload = postSchema.parse(await request.json())
    const { weekStartDate, weekEndDate } = getWeekRangeFromStartDate(payload.weekStartDate)
    const currentWeekStartDate = formatDateInput(startOfWeekMonday(new Date()))

    if (weekStartDate !== currentWeekStartDate) {
      return NextResponse.json({ error: "يمكن رفع الإنجازات للأسبوع الحالي فقط" }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from("weekly_achievement_entries").insert({
      user_id: user.id,
      week_start_date: weekStartDate,
      week_end_date: weekEndDate,
      achievement_text: payload.achievementText,
      image_url: payload.imageUrl ?? null,
    })

    if (error) {
      if (isSchemaMissing(error)) {
        return schemaResponse()
      }

      throw new Error(error.message)
    }

    const isManager = user.role === "admin" && user.permissions.includes("*")
    return NextResponse.json(await loadAchievementsPageData(user.id, isManager, weekStartDate))
  } catch (error) {
    if (error instanceof Error && error.message === "SCHEMA_MISSING") {
      return schemaResponse()
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ الإنجاز" }, { status: 400 })
  }
}
