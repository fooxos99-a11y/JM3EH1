import { NextResponse } from "next/server"

import { hasPermission, isPhoneValid, normalizePhone, requireCurrentUser } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { isWhatsAppWorkerReady, WHATSAPP_HISTORY_TABLE, WHATSAPP_QUEUE_TABLE } from "@/lib/whatsapp-config"
import { readWhatsAppWorkerStatus } from "@/lib/whatsapp-worker-status"

type RecipientInput = {
  phoneNumber?: string | null
  message?: string | null
}

type RequestPayload = {
  phoneNumber?: string | null
  message?: string | null
  recipients?: RecipientInput[]
}

function buildMissingTableMessage() {
  return "جداول واتساب غير موجودة بعد. شغّل تحديث قاعدة البيانات الخاص بواتساب ثم أعد المحاولة."
}

export async function POST(request: Request) {
  const user = await requireCurrentUser()
  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({})) as RequestPayload
    const defaultMessage = typeof body.message === "string" ? body.message.trim() : ""
    const workerStatus = await readWhatsAppWorkerStatus()

    if (!isWhatsAppWorkerReady(workerStatus)) {
      return NextResponse.json({ error: "واتساب غير مرتبط حاليًا. اربط واتساب أولًا ثم أعد الإرسال." }, { status: 409 })
    }

    const rawRecipients = Array.isArray(body.recipients)
      ? body.recipients
      : [{ phoneNumber: body.phoneNumber ?? null, message: body.message ?? null }]

    if (rawRecipients.length === 0) {
      return NextResponse.json({ error: "اختر مستلمًا واحدًا على الأقل" }, { status: 400 })
    }

    const validRows: Array<{ id: string; phoneNumber: string; message: string }> = []
    let invalidPhoneCount = 0
    let missingPhoneCount = 0

    for (const recipient of rawRecipients) {
      const phoneNumber = typeof recipient.phoneNumber === "string" ? normalizePhone(recipient.phoneNumber) : ""
      const message = typeof recipient.message === "string" && recipient.message.trim() ? recipient.message.trim() : defaultMessage

      if (!phoneNumber) {
        missingPhoneCount += 1
        continue
      }

      if (!isPhoneValid(phoneNumber)) {
        invalidPhoneCount += 1
        continue
      }

      if (!message) {
        continue
      }

      validRows.push({
        id: crypto.randomUUID(),
        phoneNumber,
        message,
      })
    }

    if (validRows.length === 0) {
      return NextResponse.json({ error: "لم يتم العثور على أرقام صالحة للإرسال" }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const queueRows = validRows.map((row) => ({
      id: row.id,
      phone_number: row.phoneNumber,
      message: row.message,
      status: "pending",
      error_message: null,
    }))
    const historyRows = validRows.map((row) => ({
      id: row.id,
      phone_number: row.phoneNumber,
      message_text: row.message,
      status: "pending",
      message_id: null,
      error_message: null,
      sent_by: user.id,
      sent_at: null,
    }))

    const { error: queueError } = await supabase.from(WHATSAPP_QUEUE_TABLE).insert(queueRows)
    if (queueError) {
      if (queueError.code === "42P01") {
        return NextResponse.json({ error: buildMissingTableMessage() }, { status: 409 })
      }

      throw queueError
    }

    const { error: historyError } = await supabase.from(WHATSAPP_HISTORY_TABLE).insert(historyRows)
    if (historyError) {
      if (historyError.code === "42P01") {
        return NextResponse.json({ error: buildMissingTableMessage() }, { status: 409 })
      }

      throw historyError
    }

    return NextResponse.json({
      success: true,
      queuedCount: validRows.length,
      queuedIds: validRows.map((row) => row.id),
      invalidPhoneCount,
      missingPhoneCount,
      message: `تمت إضافة ${validRows.length} رسالة إلى طابور الإرسال`,
    })
  } catch (error) {
    console.error("[WhatsApp] Send error:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تجهيز الرسائل للإرسال" }, { status: 500 })
  }
}