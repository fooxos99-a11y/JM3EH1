import { NextResponse } from "next/server"
import { z } from "zod"

import { getSiteSectionContent } from "@/lib/site-content"
import { isPhoneValid, normalizePhone } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const submitSchema = z.object({
  itemId: z.number().int().positive(),
  donorName: z.string().trim().min(2),
  recipientName: z.string().trim().min(2),
  recipientPhone: z.string().trim().min(8),
  labelId: z.number().int().positive().nullable(),
  amount: z.number().nonnegative(),
})

function isSchemaMissing(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false
  }

  return error.code === "42P01" || error.code === "42703"
}

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = submitSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الإهداء غير صحيحة" }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(parsed.data.recipientPhone)
  if (!isPhoneValid(normalizedPhone)) {
    return NextResponse.json({ error: "رقم جوال المُهدى له غير صحيح" }, { status: 400 })
  }

  const content = await getSiteSectionContent("giftings")
  const item = content.items.find((entry) => entry.id === parsed.data.itemId && !entry.hideDonation)

  if (!item) {
    return NextResponse.json({ error: "بطاقة الإهداء غير متاحة الآن" }, { status: 404 })
  }

  const label = parsed.data.labelId ? item.labels.find((entry) => entry.id === parsed.data.labelId) ?? null : null
  const supabase = createSupabaseAdminClient()

  const { error } = await supabase.from("gifting_requests").insert({
    item_id: item.id,
    item_title: item.title,
    donor_name: parsed.data.donorName,
    recipient_name: parsed.data.recipientName,
    recipient_phone: normalizedPhone,
    donation_label: label?.label ?? null,
    amount: parsed.data.amount,
    section_key: "giftings",
    sms_status: "pending",
    sms_template: item.smsTemplate,
    metadata: {
      senderPrefix: item.senderPrefix,
      recipientPrefix: item.recipientPrefix,
      senderPlacement: item.senderPlacement,
      recipientPlacement: item.recipientPlacement,
    },
  })

  if (error) {
    if (isSchemaMissing(error)) {
      return NextResponse.json({ error: "يجب تطبيق آخر تحديث لقاعدة البيانات قبل استخدام الإهداءات" }, { status: 503 })
    }

    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, message: item.confirmationMessage })
}
