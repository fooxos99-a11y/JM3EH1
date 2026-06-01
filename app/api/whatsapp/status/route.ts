import { NextResponse } from "next/server"

import { hasPermission, requireCurrentUser } from "@/lib/auth"
import { readWhatsAppWorkerStatus } from "@/lib/whatsapp-worker-status"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const user = await requireCurrentUser()
  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  try {
    return NextResponse.json(await readWhatsAppWorkerStatus())
  } catch (error) {
    console.error("[WhatsApp] Status error:", error)
    return NextResponse.json({ error: "تعذر قراءة حالة واتساب" }, { status: 500 })
  }
}