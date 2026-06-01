import { NextResponse } from "next/server"

import { hasPermission, requireCurrentUser } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { WHATSAPP_QUEUE_TABLE } from "@/lib/whatsapp-config"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await requireCurrentUser()
  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()
  const { count, error } = await supabase
    .from(WHATSAPP_QUEUE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")

  if (error && error.code !== "42P01") {
    return NextResponse.json({ error: "تعذر قراءة حالة طابور الرسائل" }, { status: 500 })
  }

  return NextResponse.json({
    pendingCount: count || 0,
    checkedAt: new Date().toISOString(),
  })
}