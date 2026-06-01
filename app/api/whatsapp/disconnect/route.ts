import { NextResponse } from "next/server"

import { hasPermission, requireCurrentUser } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { WHATSAPP_WORKER_COMMAND_SETTING_ID } from "@/lib/whatsapp-config"
import { readWhatsAppWorkerStatus } from "@/lib/whatsapp-worker-status"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function POST() {
  const user = await requireCurrentUser()
  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  try {
    const status = await readWhatsAppWorkerStatus()
    const isConnected = Boolean(status.workerOnline && status.ready && status.authenticated && status.status === "connected")

    if (!status.workerOnline) {
      return NextResponse.json({ error: "عامل واتساب غير متصل حالياً" }, { status: 409 })
    }

    if (!isConnected) {
      return NextResponse.json({ error: "لا توجد جلسة واتساب متصلة ليتم إلغاء ربطها حالياً" }, { status: 409 })
    }

    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from("site_settings").upsert(
      {
        id: WHATSAPP_WORKER_COMMAND_SETTING_ID,
        value: { action: "disconnect", requestedAt: new Date().toISOString() },
      },
      { onConflict: "id" },
    )

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, message: "تم إرسال طلب إلغاء الربط" })
  } catch (error) {
    console.error("[WhatsApp] Disconnect error:", error)
    return NextResponse.json({ error: "تعذر إلغاء الربط حالياً" }, { status: 500 })
  }
}