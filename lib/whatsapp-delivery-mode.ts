import "server-only"

import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { normalizeWhatsAppDeliveryMode, type WhatsAppDeliveryMode, WHATSAPP_DELIVERY_MODE_SETTING_ID } from "@/lib/whatsapp-config"

const DEFAULT_MODE: WhatsAppDeliveryMode = "cloud"

export async function readWhatsAppDeliveryMode() {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("id", WHATSAPP_DELIVERY_MODE_SETTING_ID)
      .maybeSingle<{ value: unknown }>()

    if (error || !data) {
      return DEFAULT_MODE
    }

    return normalizeWhatsAppDeliveryMode(data.value)
  } catch {
    return DEFAULT_MODE
  }
}

export async function writeWhatsAppDeliveryMode(mode: WhatsAppDeliveryMode) {
  const normalizedMode = normalizeWhatsAppDeliveryMode(mode)
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("site_settings").upsert(
    {
      id: WHATSAPP_DELIVERY_MODE_SETTING_ID,
      value: normalizedMode,
    },
    { onConflict: "id" },
  )

  if (error) {
    throw error
  }

  return normalizedMode
}