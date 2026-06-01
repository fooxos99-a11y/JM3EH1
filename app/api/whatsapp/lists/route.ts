import { NextResponse } from "next/server"
import { z } from "zod"

import { hasPermission, isPhoneValid, normalizePhone, requireCurrentUser } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { WHATSAPP_RECIPIENT_LISTS_SETTING_ID } from "@/lib/whatsapp-server-config"

const recipientSchema = z.object({
  name: z.string().trim().min(1, "اسم المستلم مطلوب"),
  phone: z.string().trim().min(8, "رقم الجوال غير صالح"),
})

const saveListSchema = z.object({
  name: z.string().trim().min(1, "اسم القائمة مطلوب"),
  recipients: z.array(recipientSchema).min(1, "اختر رقمًا واحدًا على الأقل"),
})

type SavedRecipientList = {
  id: string
  name: string
  createdAt: string
  recipients: Array<{
    name: string
    phone: string
  }>
}

function buildMissingSettingsMessage() {
  return "إعدادات القوائم المحفوظة غير موجودة بعد. شغّل آخر تحديث لقاعدة البيانات ثم أعد المحاولة."
}

function normalizeSavedLists(value: unknown): SavedRecipientList[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return []
    }

    const record = entry as Record<string, unknown>
    const name = String(record.name || "").trim()
    const recipients = Array.isArray(record.recipients)
      ? record.recipients.flatMap((recipient) => {
          if (!recipient || typeof recipient !== "object") {
            return []
          }

          const item = recipient as Record<string, unknown>
          const phone = normalizePhone(String(item.phone || ""))
          if (!isPhoneValid(phone)) {
            return []
          }

          return [{
            name: String(item.name || phone).trim() || phone,
            phone,
          }]
        })
      : []

    if (!name || recipients.length === 0) {
      return []
    }

    return [{
      id: String(record.id || crypto.randomUUID()),
      name,
      createdAt: String(record.createdAt || new Date().toISOString()),
      recipients,
    } satisfies SavedRecipientList]
  })
}

async function readSavedLists() {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("site_settings")
    .select("value")
    .eq("id", WHATSAPP_RECIPIENT_LISTS_SETTING_ID)
    .maybeSingle<{ value: unknown }>()

  if (error) {
    if (error.code === "42P01") {
      throw new Error(buildMissingSettingsMessage())
    }

    throw new Error(error.message)
  }

  return normalizeSavedLists(data?.value)
}

async function requireSupportersPermission() {
  const user = await requireCurrentUser()
  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  return null
}

export async function GET() {
  const unauthorized = await requireSupportersPermission()
  if (unauthorized) {
    return unauthorized
  }

  try {
    return NextResponse.json({ lists: await readSavedLists() })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل القوائم المحفوظة" }, { status: 400 })
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireSupportersPermission()
  if (unauthorized) {
    return unauthorized
  }

  try {
    const parsed = saveListSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات القائمة غير صحيحة" }, { status: 400 })
    }

    const normalizedRecipients = Array.from(
      new Map(
        parsed.data.recipients.map((recipient) => {
          const phone = normalizePhone(recipient.phone)
          return [phone, { name: recipient.name.trim() || phone, phone }]
        }),
      ).values(),
    )

    const invalidPhone = normalizedRecipients.find((recipient) => !isPhoneValid(recipient.phone))
    if (invalidPhone) {
      return NextResponse.json({ error: `رقم الجوال غير صالح: ${invalidPhone.phone}` }, { status: 400 })
    }

    const currentLists = await readSavedLists()
    const nextName = parsed.data.name.trim()
    const existingList = currentLists.find((list) => list.name.trim().toLowerCase() === nextName.toLowerCase())
    const nextList: SavedRecipientList = {
      id: existingList?.id ?? crypto.randomUUID(),
      name: nextName,
      createdAt: existingList?.createdAt ?? new Date().toISOString(),
      recipients: normalizedRecipients,
    }

    const nextLists = existingList
      ? currentLists.map((list) => list.id === existingList.id ? nextList : list)
      : [nextList, ...currentLists]

    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from("site_settings").upsert(
      {
        id: WHATSAPP_RECIPIENT_LISTS_SETTING_ID,
        value: nextLists,
      },
      { onConflict: "id" },
    )

    if (error) {
      if (error.code === "42P01") {
        return NextResponse.json({ error: buildMissingSettingsMessage() }, { status: 409 })
      }

      throw error
    }

    return NextResponse.json({ ok: true, list: nextList, replaced: Boolean(existingList) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ القائمة" }, { status: 400 })
  }
}