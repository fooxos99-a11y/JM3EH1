import { NextResponse } from "next/server"

import { hasPermission, requireCurrentUser } from "@/lib/auth"
import { normalizeWhatsAppDeliveryMode } from "@/lib/whatsapp-config"
import { readWhatsAppDeliveryMode, writeWhatsAppDeliveryMode } from "@/lib/whatsapp-delivery-mode"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const user = await requireCurrentUser()
  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const mode = await readWhatsAppDeliveryMode()
  return NextResponse.json({ mode })
}

export async function PATCH(request: Request) {
  const user = await requireCurrentUser()
  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({})) as { mode?: unknown }
    const mode = normalizeWhatsAppDeliveryMode(body.mode)
    const savedMode = await writeWhatsAppDeliveryMode(mode)
    return NextResponse.json({ success: true, mode: savedMode })
  } catch (error) {
    console.error("[WhatsApp] Mode update error:", error)
    return NextResponse.json({ error: "تعذر تحديث وضع الإرسال" }, { status: 500 })
  }
}