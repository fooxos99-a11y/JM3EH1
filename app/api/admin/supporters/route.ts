import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUser, hasPermission, isPhoneValid, normalizePhone } from "@/lib/auth"
import type { SupporterAccountType, SupporterRecord, SupportersDashboardData } from "@/lib/supporters"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const supporterAccountTypeSchema = z.enum(["individual", "institution", "charity"])

const supporterInputSchema = z.object({
  name: z.string().trim().min(2),
  accountType: supporterAccountTypeSchema,
  phone: z.string().trim().min(8),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  notes: z.string().trim().optional(),
})

const createSupporterSchema = z.object({
  action: z.literal("create_manual_supporter"),
  supporter: supporterInputSchema,
})

const importSupportersSchema = z.object({
  action: z.literal("import_supporters"),
  supporters: z.array(supporterInputSchema).min(1),
})

const updateSupporterSchema = z.object({
  id: z.string().uuid(),
  source: z.enum(["registered", "manual"]),
  name: z.string().trim().min(2),
  accountType: supporterAccountTypeSchema,
  phone: z.string().trim().min(8),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  notes: z.string().trim().optional(),
})

const createPayloadSchema = z.union([createSupporterSchema, importSupportersSchema])

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
  supporter_account_type: SupporterAccountType | null
  phone: string
  email: string | null
  created_at: string
}

type SupporterContactRow = {
  id: string
  full_name: string
  account_type: SupporterAccountType | null
  phone: string
  email: string | null
  notes: string | null
  created_at: string
}

async function buildSupportersData(): Promise<SupportersDashboardData> {
  const supabase = createSupabaseAdminClient()

  const { data: users, error: usersError } = await supabase
    .from("app_users")
    .select("id,full_name,supporter_account_type,phone,email,created_at")
    .eq("role", "user")
    .order("created_at", { ascending: false })

  if (usersError) {
    throw new Error(usersError.message)
  }

  const { data: manualContacts, error: contactsError } = await supabase
    .from("supporter_contacts")
    .select("id,full_name,account_type,phone,email,notes,created_at")
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
    accountType: user.supporter_account_type ?? "individual",
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
    accountType: contact.account_type ?? "individual",
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
      accountType: supporter.accountType,
      phone: supporter.phone,
      email: supporter.email,
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
  const parsed = createPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الداعم غير صحيحة" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  if (parsed.data.action === "import_supporters") {
    const normalizedEntries = parsed.data.supporters.map((supporter) => ({
      name: supporter.name,
      accountType: supporter.accountType,
      phone: normalizePhone(supporter.phone),
      email: supporter.email ? supporter.email.toLowerCase() : null,
      notes: supporter.notes || null,
    }))

    const invalidEntry = normalizedEntries.find((supporter) => !isPhoneValid(supporter.phone))
    if (invalidEntry) {
      return NextResponse.json({ error: `رقم الجوال غير صحيح للداعم ${invalidEntry.name}` }, { status: 400 })
    }

    const dedupedEntries = Array.from(new Map(normalizedEntries.map((supporter) => [supporter.phone, supporter])).values())
    const phones = dedupedEntries.map((supporter) => supporter.phone)

    const { data: existingManualContacts, error: existingManualError } = await supabase
      .from("supporter_contacts")
      .select("id,phone")
      .in("phone", phones)

    if (existingManualError) {
      if (isSchemaMissing(existingManualError)) {
        return schemaResponse()
      }

      return NextResponse.json({ error: existingManualError.message }, { status: 400 })
    }

    const existingManualByPhone = new Map(((existingManualContacts ?? []) as Array<{ id: string; phone: string }>).map((row) => [row.phone, row.id]))
    const rowsToInsert = dedupedEntries.filter((supporter) => !existingManualByPhone.has(supporter.phone)).map((supporter) => ({
      full_name: supporter.name,
      account_type: supporter.accountType,
      phone: supporter.phone,
      email: supporter.email,
      notes: supporter.notes,
      created_by: user.id,
    }))

    const rowsToUpdate = dedupedEntries.filter((supporter) => existingManualByPhone.has(supporter.phone))

    if (rowsToInsert.length > 0) {
      const { error } = await supabase.from("supporter_contacts").insert(rowsToInsert)

      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }

        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    for (const supporter of rowsToUpdate) {
      const supporterId = existingManualByPhone.get(supporter.phone)
      if (!supporterId) {
        continue
      }

      const { error } = await supabase
        .from("supporter_contacts")
        .update({
          full_name: supporter.name,
          account_type: supporter.accountType,
          phone: supporter.phone,
          email: supporter.email,
          notes: supporter.notes,
        })
        .eq("id", supporterId)

      if (error) {
        if (isSchemaMissing(error)) {
          return schemaResponse()
        }

        return NextResponse.json({ error: error.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, inserted: rowsToInsert.length, updated: rowsToUpdate.length })
  }

  const normalizedPhone = normalizePhone(parsed.data.supporter.phone)
  if (!isPhoneValid(normalizedPhone)) {
    return NextResponse.json({ error: "رقم الجوال غير صحيح" }, { status: 400 })
  }

  const { error } = await supabase.from("supporter_contacts").insert({
    full_name: parsed.data.supporter.name,
    account_type: parsed.data.supporter.accountType,
    phone: normalizedPhone,
    email: parsed.data.supporter.email ? parsed.data.supporter.email.toLowerCase() : null,
    notes: parsed.data.supporter.notes || null,
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
  const tableName = parsed.data.source === "registered" ? "app_users" : "supporter_contacts"
  const payload = parsed.data.source === "registered"
    ? {
        full_name: parsed.data.name,
        supporter_account_type: parsed.data.accountType,
        phone: normalizedPhone,
        email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
      }
    : {
        full_name: parsed.data.name,
        account_type: parsed.data.accountType,
        phone: normalizedPhone,
        email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
        notes: parsed.data.notes || null,
      }

  const { error } = await supabase.from(tableName).update(payload).eq("id", parsed.data.id)

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
