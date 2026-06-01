export const WHATSAPP_QUEUE_TABLE = process.env.WHATSAPP_QUEUE_TABLE || "whatsapp_queue"
export const WHATSAPP_HISTORY_TABLE = process.env.WHATSAPP_HISTORY_TABLE || "whatsapp_messages"
export const WHATSAPP_WORKER_STATE_SETTING_ID = process.env.WHATSAPP_WORKER_STATE_SETTING_ID || "whatsapp_worker_state"
export const WHATSAPP_WORKER_COMMAND_SETTING_ID = process.env.WHATSAPP_WORKER_COMMAND_SETTING_ID || "whatsapp_worker_command"
export const WHATSAPP_DELIVERY_MODE_SETTING_ID = process.env.WHATSAPP_DELIVERY_MODE_SETTING_ID || "whatsapp_delivery_mode"
export const WHATSAPP_RECIPIENT_LISTS_SETTING_ID = process.env.WHATSAPP_RECIPIENT_LISTS_SETTING_ID || "whatsapp_recipient_lists"

export type WhatsAppDeliveryMode = "local" | "cloud"

export type WhatsAppWorkerStatus = {
  instanceSlug: string | null
  workerMode: string | null
  deviceLabel: string | null
  status: string
  qrAvailable: boolean
  ready: boolean
  authenticated: boolean
  lastUpdatedAt: string | null
  lastHeartbeatAt: string | null
  qrUpdatedAt: string | null
  connectedAt: string | null
  disconnectedAt: string | null
  authFailedAt: string | null
  lastError: string | null
  workerOnline: boolean
  qrImageUrl: string | null
  qrValue: string | null
}

export function normalizeWhatsAppDeliveryMode(value: unknown): WhatsAppDeliveryMode {
  return value === "cloud" ? "cloud" : "local"
}

export function getDefaultWhatsAppWorkerStatus(): WhatsAppWorkerStatus {
  return {
    instanceSlug: null,
    workerMode: null,
    deviceLabel: null,
    status: "not_started",
    qrAvailable: false,
    ready: false,
    authenticated: false,
    lastUpdatedAt: null,
    lastHeartbeatAt: null,
    qrUpdatedAt: null,
    connectedAt: null,
    disconnectedAt: null,
    authFailedAt: null,
    lastError: null,
    workerOnline: false,
    qrImageUrl: null,
    qrValue: null,
  }
}

export function isWhatsAppWorkerReady(status: WhatsAppWorkerStatus) {
  return Boolean(status.workerOnline && status.ready && status.authenticated && status.status === "connected")
}