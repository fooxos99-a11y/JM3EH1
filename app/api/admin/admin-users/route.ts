import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

import { employeeGenderValues, maritalStatusValues } from "@/lib/administrative-services"
import type { DashboardPermissionKey } from "@/lib/dashboard-permissions"
import { getCurrentUser, hasPermission, isPhoneValid, normalizePhone } from "@/lib/auth"
import { getSiteSectionContent, upsertSiteSectionContent } from "@/lib/site-content"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const adminUserSchema = z.object({
  name: z.string().trim().min(2),
  title: z.string().trim().min(2),
  phone: z.string().trim().min(8),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  password: z.string().min(8),
  nationalId: z.string().trim().min(6).max(20),
  birthDate: z.string().trim().min(8),
  gender: z.enum(employeeGenderValues),
  maritalStatus: z.enum(maritalStatusValues),
  jobRank: z.string().trim().min(2),
  permissions: z.array(z.string()).min(1),
})

const updateAdminUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().trim().min(2).optional(),
  title: z.string().trim().min(2),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  password: z.string().min(8).optional(),
  nationalId: z.string().trim().min(6).max(20),
  birthDate: z.string().trim().min(8),
  gender: z.enum(employeeGenderValues),
  maritalStatus: z.enum(maritalStatusValues),
  jobRank: z.string().trim().min(2),
  permissions: z.array(z.string()).min(1),
})

type ProfileRow = {
  user_id: string
  national_id: string
  birth_date: string
  gender: (typeof employeeGenderValues)[number]
  marital_status: (typeof maritalStatusValues)[number]
  job_rank: string
}

function getReadableDatabaseError(error: { code?: string; message?: string; details?: string | null } | null | undefined) {
  if (!error) {
    return "حدث خطأ غير متوقع أثناء حفظ البيانات"
  }

  if (error.code === "23505") {
    const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase()

    if (message.includes("phone")) {
      return "رقم الجوال مستخدم مسبقًا"
    }

    if (message.includes("email")) {
      return "البريد الإلكتروني مستخدم مسبقًا"
    }

    if (message.includes("national")) {
      return "رقم الهوية مستخدم مسبقًا"
    }

    return "توجد بيانات مكررة تمنع إنشاء الحساب"
  }

  if (error.code === "23503") {
    return "تعذر ربط الحساب ببياناته الوظيفية، تحقق من سلامة قاعدة البيانات"
  }

  if (error.code === "23514") {
    return "بعض القيم المدخلة غير متوافقة مع قيود النظام"
  }

  return error.message ?? "حدث خطأ أثناء إنشاء الحساب الإداري"
}

function isSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false
  }

  return error.code === "42P01" || error.code === "42703"
}

function schemaResponse() {
  return NextResponse.json(
    { error: "يجب تطبيق آخر تحديث لملف قاعدة البيانات قبل إدارة البيانات الوظيفية" },
    { status: 503 },
  )
}

async function requirePermissionsAdmin() {
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    return { user: null, response: NextResponse.json({ error: "غير مصرح" }, { status: 401 }) }
  }

  if (!hasPermission(user, "permissions")) {
    return { user, response: NextResponse.json({ error: "ليس لديك صلاحية لإدارة الحسابات" }, { status: 403 }) }
  }

  return { user, response: null }
}

export async function GET() {
  const { response } = await requirePermissionsAdmin()
  if (response) return response

  const supabase = createSupabaseAdminClient()
  const permissionsContent = await getSiteSectionContent("permissions")
  const { data, error } = await supabase
    .from("app_users")
    .select("id,full_name,phone,email,role")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
  const { data: profiles, error: profilesError } = await supabase
    .from("employee_profiles")
    .select("user_id,national_id,birth_date,gender,marital_status,job_rank")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  if (profilesError && !isSchemaMissing(profilesError)) {
    return NextResponse.json({ error: profilesError.message }, { status: 400 })
  }

  const profilesById = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.user_id, profile]))

  const accounts = (data ?? []).map((account) => {
    const config = permissionsContent.accounts.find((item) => item.userId === account.id)
    const profile = profilesById.get(account.id)

    return {
      id: account.id,
      name: account.full_name,
      phone: account.phone,
      email: account.email,
      title: config?.title ?? "مدير النظام",
      permissions: config?.permissions.length ? config.permissions : ["*"],
      nationalId: profile?.national_id ?? "",
      birthDate: profile?.birth_date ?? "",
      gender: profile?.gender ?? "male",
      maritalStatus: profile?.marital_status ?? "single",
      jobRank: profile?.job_rank ?? "",
    }
  })

  return NextResponse.json({ accounts })
}

export async function POST(request: Request) {
  const { user, response } = await requirePermissionsAdmin()
  if (response || !user) return response

  const body = await request.json()
  const parsed = adminUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(parsed.data.phone)
  if (!isPhoneValid(normalizedPhone)) {
    return NextResponse.json({ error: "رقم الجوال غير صحيح" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const schemaCheck = await supabase.from("employee_profiles").select("user_id").limit(1)
  if (schemaCheck.error && isSchemaMissing(schemaCheck.error)) {
    return schemaResponse()
  }

  const passwordHash = await hash(parsed.data.password, 12)
  const normalizedEmail = parsed.data.email ? parsed.data.email.toLowerCase() : null

  const { data: insertedUser, error } = await supabase
    .from("app_users")
    .insert({
      full_name: parsed.data.name,
      phone: normalizedPhone,
      email: normalizedEmail,
      password_hash: passwordHash,
      role: "admin",
      phone_verified_at: new Date().toISOString(),
    })
    .select("id,full_name,phone,email")
    .single<{ id: string; full_name: string; phone: string; email: string | null }>()

  if (error || !insertedUser) {
    return NextResponse.json({ error: getReadableDatabaseError(error) }, { status: 400 })
  }

  const { error: profileError } = await supabase.from("employee_profiles").upsert(
    {
      user_id: insertedUser.id,
      national_id: parsed.data.nationalId,
      birth_date: parsed.data.birthDate,
      gender: parsed.data.gender,
      marital_status: parsed.data.maritalStatus,
      job_rank: parsed.data.jobRank,
      created_by: user.id,
      updated_by: user.id,
    },
    { onConflict: "user_id" },
  )

  if (profileError) {
    await supabase.from("app_users").delete().eq("id", insertedUser.id)
    return NextResponse.json({ error: getReadableDatabaseError(profileError) }, { status: 400 })
  }

  const { error: balanceError } = await supabase.from("employee_leave_balances").upsert(
    {
      user_id: insertedUser.id,
      updated_by: user.id,
    },
    { onConflict: "user_id" },
  )

  if (balanceError && !isSchemaMissing(balanceError)) {
    return NextResponse.json({ error: getReadableDatabaseError(balanceError) }, { status: 400 })
  }

  const permissionsContent = await getSiteSectionContent("permissions")
  const permissions = parsed.data.permissions as Array<DashboardPermissionKey | "*">
  await upsertSiteSectionContent("permissions", {
    accounts: [
      ...permissionsContent.accounts,
      {
        userId: insertedUser.id,
        title: parsed.data.title,
        permissions,
      },
    ],
  })

  return NextResponse.json({
    account: {
      id: insertedUser.id,
      name: insertedUser.full_name,
      phone: insertedUser.phone,
      email: insertedUser.email,
      title: parsed.data.title,
      permissions,
      nationalId: parsed.data.nationalId,
      birthDate: parsed.data.birthDate,
      gender: parsed.data.gender,
      maritalStatus: parsed.data.maritalStatus,
      jobRank: parsed.data.jobRank,
    },
  })
}

export async function PATCH(request: Request) {
  const { user, response } = await requirePermissionsAdmin()
  if (response || !user) return response

  const body = await request.json()
  const parsed = updateAdminUserSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const schemaCheck = await supabase.from("employee_profiles").select("user_id").limit(1)
  if (schemaCheck.error && isSchemaMissing(schemaCheck.error)) {
    return schemaResponse()
  }

  const updates: Record<string, string | null> = {}

  if (parsed.data.name) updates.full_name = parsed.data.name
  if (parsed.data.email !== undefined) updates.email = parsed.data.email ? parsed.data.email.toLowerCase() : null
  if (parsed.data.password) updates.password_hash = await hash(parsed.data.password, 12)

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase.from("app_users").update(updates).eq("id", parsed.data.userId).eq("role", "admin")
    if (error) {
      return NextResponse.json({ error: getReadableDatabaseError(error) }, { status: 400 })
    }
  }

  const { error: profileError } = await supabase.from("employee_profiles").upsert(
    {
      user_id: parsed.data.userId,
      national_id: parsed.data.nationalId,
      birth_date: parsed.data.birthDate,
      gender: parsed.data.gender,
      marital_status: parsed.data.maritalStatus,
      job_rank: parsed.data.jobRank,
      updated_by: user.id,
    },
    { onConflict: "user_id" },
  )

  if (profileError) {
    return NextResponse.json({ error: getReadableDatabaseError(profileError) }, { status: 400 })
  }

  const permissionsContent = await getSiteSectionContent("permissions")
  const permissions = parsed.data.permissions as Array<DashboardPermissionKey | "*">
  const hasExistingAccount = permissionsContent.accounts.some((account) => account.userId === parsed.data.userId)
  await upsertSiteSectionContent("permissions", {
    accounts: hasExistingAccount
      ? permissionsContent.accounts.map((account) =>
          account.userId === parsed.data.userId
            ? { ...account, title: parsed.data.title, permissions }
            : account,
        )
      : [
          ...permissionsContent.accounts,
          {
            userId: parsed.data.userId,
            title: parsed.data.title,
            permissions,
          },
        ],
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { user, response } = await requirePermissionsAdmin()
  if (response || !user) return response

  const { userId } = (await request.json()) as { userId?: string }
  if (!userId) {
    return NextResponse.json({ error: "المعرّف مطلوب" }, { status: 400 })
  }

  if (user.id === userId) {
    return NextResponse.json({ error: "لا يمكن حذف الحساب الحالي" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("app_users").delete().eq("id", userId).eq("role", "admin")

  if (error) {
    return NextResponse.json({ error: getReadableDatabaseError(error) }, { status: 400 })
  }

  const permissionsContent = await getSiteSectionContent("permissions")
  await upsertSiteSectionContent("permissions", {
    accounts: permissionsContent.accounts.filter((account) => account.userId !== userId),
  })

  return NextResponse.json({ ok: true })
}