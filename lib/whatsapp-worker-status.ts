import "server-only"

import fs from "node:fs"
import path from "node:path"

import { createSupabaseAdminClient } from "@/lib/supabase/server"
import { getDefaultWhatsAppWorkerStatus, type WhatsAppWorkerStatus, WHATSAPP_WORKER_STATE_SETTING_ID } from "@/lib/whatsapp-config"

type WorkerStatusPayload = Partial<Omit<WhatsAppWorkerStatus, "workerOnline" | "qrImageUrl">>

function sanitizeInstanceSlug(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getSupabaseProjectRef(url: string | undefined) {
  try {
    const hostname = new URL(String(url || "")).hostname
    return hostname.split(".")[0] || null
  } catch {
    return null
  }
}

export function getDefaultWhatsAppInstanceSlug() {
  const explicitSlug = sanitizeInstanceSlug(process.env.WHATSAPP_INSTANCE_SLUG)
  if (explicitSlug) {
    return explicitSlug
  }

  const configuredClientId = sanitizeInstanceSlug(process.env.WHATSAPP_CLIENT_ID)
  if (configuredClientId) {
    return configuredClientId
  }

  const projectRef = sanitizeInstanceSlug(process.env.SUPABASE_PROJECT_REF || getSupabaseProjectRef(process.env.NEXT_PUBLIC_SUPABASE_URL))
  if (projectRef) {
    return projectRef
  }

  return "default"
}

const INSTANCE_SLUG = getDefaultWhatsAppInstanceSlug()
const STATUS_FILE_PATH = process.env.WHATSAPP_STATUS_FILE_PATH || path.join(process.cwd(), "whatsapp-worker", `status-${INSTANCE_SLUG}.json`)
const HEARTBEAT_INTERVAL_MS = Number(process.env.WHATSAPP_HEARTBEAT_INTERVAL_MS || 15000)
const ONLINE_THRESHOLD_MS = Number(process.env.WHATSAPP_ONLINE_THRESHOLD_MS || Math.max(HEARTBEAT_INTERVAL_MS * 6, 90000))

function getStatusTimestamp(status: WhatsAppWorkerStatus) {
  const value = status.lastUpdatedAt || status.lastHeartbeatAt || status.qrUpdatedAt || status.connectedAt || status.disconnectedAt || status.authFailedAt || null
  return value ? new Date(value).getTime() : 0
}

function finalizeStatus(payload: WorkerStatusPayload) {
  const fallback = getDefaultWhatsAppWorkerStatus()
  const heartbeatTime = payload.lastHeartbeatAt ? new Date(payload.lastHeartbeatAt).getTime() : 0
  const workerOnline = Boolean(heartbeatTime) && Date.now() - heartbeatTime <= ONLINE_THRESHOLD_MS
  const normalizedStatus = String(payload.status || "not_started").trim().toLowerCase() || "not_started"
  const hasQr = Boolean(workerOnline && payload.qrValue && !payload.ready)
  const isConnected = Boolean(workerOnline && payload.ready && payload.authenticated && normalizedStatus === "connected")

  return {
    ...fallback,
    ...payload,
    status: hasQr && ["starting", "disconnected", "not_started"].includes(normalizedStatus) ? "waiting_for_qr" : normalizedStatus,
    ready: isConnected,
    authenticated: isConnected,
    qrAvailable: hasQr,
    workerOnline,
    qrImageUrl: hasQr ? `/api/whatsapp/qr?t=${encodeURIComponent(payload.qrUpdatedAt || payload.lastUpdatedAt || Date.now().toString())}` : null,
  } satisfies WhatsAppWorkerStatus
}

function readLocalWhatsAppWorkerStatus() {
  try {
    if (!fs.existsSync(STATUS_FILE_PATH)) {
      return getDefaultWhatsAppWorkerStatus()
    }

    const rawStatus = fs.readFileSync(STATUS_FILE_PATH, "utf8")
    const payload = JSON.parse(rawStatus) as WorkerStatusPayload
    return finalizeStatus(payload)
  } catch {
    return getDefaultWhatsAppWorkerStatus()
  }
}

export async function readWhatsAppWorkerStatus() {
  const localStatus = readLocalWhatsAppWorkerStatus()

  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("id", WHATSAPP_WORKER_STATE_SETTING_ID)
      .maybeSingle<{ value: WorkerStatusPayload }>()

    if (!error && data?.value) {
      const sharedStatus = finalizeStatus(data.value)
      return getStatusTimestamp(localStatus) > getStatusTimestamp(sharedStatus) ? localStatus : sharedStatus
    }
  } catch {
    // Keep local status when shared state is unavailable.
  }

  return localStatus
}