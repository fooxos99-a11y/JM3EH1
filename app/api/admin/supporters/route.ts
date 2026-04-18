import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUser, hasPermission, isPhoneValid, normalizePhone } from "@/lib/auth"
import type { SupporterRecord, SupportersDashboardData } from "@/lib/supporters"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const createSupporterSchema = z.object({
  name: z.string().trim().min(2),
  phone: z.string().trim().min(8),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  notes: z.string().trim().optional(),
})

const updateSupporterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2),
  phone: z.string().trim().min(8),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  notes: z.string().trim().optional(),
})

function isSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false
  }

  return error.code === "42P01" || error.code === "42703"
}

function schemaResponse() {
  return NextResponse.json(
    { error: "يجب تطبيق آخر تحديث لملف قاعدة البيانات قبل إدارة بيانات الداعمين" },
    { status: 503 },
  )
}

async function requireSupportersAdmin() {
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    return { user: null, response: NextResponse.json({ error: "غير مصرح" }, { status: 401 }) }
  }

  if (!hasPermission(user, "supporters")) {
    return { user, response: NextResponse.json({ error: "ليس لديك صلاحية لإدارة الداعمين" }, { status: 403 }) }
  }

  return { user, response: null }
}

type AppUserRow = {
  id: string
  full_name: string
  phone: string
  email: string | null
  created_at: string
}

type SupporterContactRow = {
  id: string
  full_name: string
  phone: string
  email: string | null
  notes: string | null
  created_at: string
}

async function buildSupportersData(): Promise<SupportersDashboardData> {
  const supabase = createSupabaseAdminClient()

  const { data: users, error: usersError } = await supabase
    .from("app_users")
    .select("id,full_name,phone,email,created_at")
    .eq("role", "user")
    .order("created_at", { ascending: false })

  if (usersError) {
    throw new Error(usersError.message)
  }

  const { data: manualContacts, error: contactsError } = await supabase
    .from("supporter_contacts")
    .select("id,full_name,phone,email,notes,created_at")
    .order("created_at", { ascending: false })

  if (contactsError) {
    if (isSchemaMissing(contactsError)) {
      throw contactsError
    }

    throw new Error(contactsError.message)
  }

  const registeredSupporters: SupporterRecord[] = ((users ?? []) as AppUserRow[]).map((user) => ({
    id: `user:${user.id}`,
    name: user.full_name,
    phone: user.phone,
    email: user.email,
    createdAt: user.created_at,
    source: "registered",
    linkedUserId: user.id,
    notes: null,
  }))

  const manualSupporters: SupporterRecord[] = ((manualContacts ?? []) as SupporterContactRow[]).map((contact) => ({
    id: `manual:${contact.id}`,
    name: contact.full_name,
    phone: contact.phone,
    email: contact.email,
    createdAt: contact.created_at,
    source: "manual",
    linkedUserId: null,
    notes: contact.notes,
  }))

  const supporters = [...registeredSupporters, ...manualSupporters].sort((left, right) => right.createdAt.localeCompare(left.createdAt))

  return {
    supporters,
    contactOnly: supporters.map((supporter) => ({
      id: supporter.id,
      name: supporter.name,
      phone: supporter.phone,
      source: supporter.source,
    })),
    stats: {
      total: supporters.length,
      registered: registeredSupporters.length,
      manual: manualSupporters.length,
      withEmail: supporters.filter((supporter) => supporter.email).length,
    },
  }
}

export async function GET() {
  const { response } = await requireSupportersAdmin()
  if (response) return response

  try {
    const payload = await buildSupportersData()
    return NextResponse.json(payload)
  } catch (error) {
    if (isSchemaMissing(error as { code?: string; message?: string })) {
      return schemaResponse()
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل الداعمين" }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const { user, response } = await requireSupportersAdmin()
  if (response || !user) return response

  const body = await request.json()
  const parsed = createSupporterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الداعم غير صحيحة" }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(parsed.data.phone)
  if (!isPhoneValid(normalizedPhone)) {
    return NextResponse.json({ error: "رقم الجوال غير صحيح" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("supporter_contacts").insert({
    full_name: parsed.data.name,
    phone: normalizedPhone,
    email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
    notes: parsed.data.notes || null,
    created_by: user.id,
  })

  if (error) {
    if (isSchemaMissing(error)) {
      return schemaResponse()
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
  const { response } = await requireSupportersAdmin()
  if (response) return response

  const body = await request.json()
  const parsed = updateSupporterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الداعم غير صحيحة" }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(parsed.data.phone)
  if (!isPhoneValid(normalizedPhone)) {
    return NextResponse.json({ error: "رقم الجوال غير صحيح" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from("supporter_contacts")
    .update({
      full_name: parsed.data.name,
      phone: normalizedPhone,
      email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
      notes: parsed.data.notes || null,
    })
    .eq("id", parsed.data.id)

  if (error) {
    if (isSchemaMissing(error)) {
      return schemaResponse()
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const { response } = await requireSupportersAdmin()
  if (response) return response

  const { id } = (await request.json()) as { id?: string }
  if (!id) {
    return NextResponse.json({ error: "معرف الداعم مطلوب" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("supporter_contacts").delete().eq("id", id)

  if (error) {
    if (isSchemaMissing(error)) {
      return schemaResponse()
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
