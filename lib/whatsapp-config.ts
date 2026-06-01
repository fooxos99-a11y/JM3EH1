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