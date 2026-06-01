try {
  const envFile = String(process.env.WORKER_ENV_FILE || "").trim()
  if (envFile) {
    require("dotenv").config({ path: envFile })
  } else {
    require("dotenv").config()
  }
} catch {
  // Continue with existing environment variables.
}

const fs = require("node:fs")
const path = require("node:path")
const QRCode = require("qrcode")
const qrcodeTerminal = require("qrcode-terminal")
const { Client, LocalAuth } = require("whatsapp-web.js")
const { createClient } = require("@supabase/supabase-js")

const PROJECT_ROOT = path.resolve(__dirname, "..")
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WHATSAPP_QUEUE_TABLE = process.env.WHATSAPP_QUEUE_TABLE || "whatsapp_queue"
const WHATSAPP_HISTORY_TABLE = process.env.WHATSAPP_HISTORY_TABLE || "whatsapp_messages"
const WHATSAPP_WORKER_STATE_SETTING_ID = process.env.WHATSAPP_WORKER_STATE_SETTING_ID || "whatsapp_worker_state"
const WHATSAPP_WORKER_COMMAND_SETTING_ID = process.env.WHATSAPP_WORKER_COMMAND_SETTING_ID || "whatsapp_worker_command"
const QUEUE_POLL_INTERVAL_MS = Number(process.env.WHATSAPP_QUEUE_POLL_INTERVAL_MS || 5000)
const COMMAND_POLL_INTERVAL_MS = Number(process.env.WHATSAPP_COMMAND_POLL_INTERVAL_MS || 3000)
const HEARTBEAT_INTERVAL_MS = Number(process.env.WHATSAPP_HEARTBEAT_INTERVAL_MS || 15000)
const WORKER_MODE = String(process.env.WHATSAPP_WORKER_MODE || "local").trim() || "local"
const DEVICE_LABEL = String(process.env.WHATSAPP_DEVICE_LABEL || "الجهاز الحالي").trim() || "الجهاز الحالي"

function sanitizeInstanceSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function getSupabaseProjectRef(url) {
  try {
    return new URL(String(url || "")).hostname.split(".")[0] || null
  } catch {
    return null
  }
}

function getDefaultInstanceSlug() {
  const explicitSlug = sanitizeInstanceSlug(process.env.WHATSAPP_INSTANCE_SLUG)
  if (explicitSlug) {
    return explicitSlug
  }

  const configuredClientId = sanitizeInstanceSlug(process.env.WHATSAPP_CLIENT_ID)
  if (configuredClientId) {
    return configuredClientId
  }

  const projectRef = sanitizeInstanceSlug(process.env.SUPABASE_PROJECT_REF || getSupabaseProjectRef(SUPABASE_URL))
  if (projectRef) {
    return projectRef
  }

  return "default"
}

const INSTANCE_SLUG = getDefaultInstanceSlug()
const STATUS_FILE_PATH = process.env.WHATSAPP_STATUS_FILE_PATH || path.join(PROJECT_ROOT, "whatsapp-worker", `status-${INSTANCE_SLUG}.json`)
const QR_IMAGE_PATH = process.env.WHATSAPP_QR_IMAGE_PATH || path.join(PROJECT_ROOT, "whatsapp-worker", `current-qr-${INSTANCE_SLUG}.png`)
const LOCK_FILE_PATH = process.env.WHATSAPP_LOCK_FILE_PATH || path.join(PROJECT_ROOT, "whatsapp-worker", `worker-${INSTANCE_SLUG}.lock`)
const AUTH_DATA_PATH = process.env.WHATSAPP_AUTH_DATA_PATH || path.join(PROJECT_ROOT, "whatsapp-worker", ".wwebjs_auth")

function ensureDirectory(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
}

function getCandidateBrowserPaths() {
  const programFiles = process.env.PROGRAMFILES || "C:\\Program Files"
  const programFilesX86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)"
  const localAppData = process.env.LOCALAPPDATA || ""

  return [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
    process.env.GOOGLE_CHROME_BIN,
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
  ].filter(Boolean)
}

function resolveBrowserExecutablePath() {
  for (const candidatePath of getCandidateBrowserPaths()) {
    if (fs.existsSync(candidatePath)) {
      return candidatePath
    }
  }

  return undefined
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase credentials for WhatsApp worker.")
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

let client = null
let isProcessingQueue = false
let isRestarting = false
let lastHandledCommandAt = ""
let heartbeatInterval = null
let queueInterval = null
let commandInterval = null

let workerState = {
  instanceSlug: INSTANCE_SLUG,
  workerMode: WORKER_MODE,
  deviceLabel: DEVICE_LABEL,
  status: "starting",
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
  qrValue: null,
}

function log(...args) {
  console.log("[WhatsApp Worker]", ...args)
}

function removeQrImage() {
  try {
    if (fs.existsSync(QR_IMAGE_PATH)) {
      fs.unlinkSync(QR_IMAGE_PATH)
    }
  } catch {
    // Ignore cleanup failure.
  }
}

async function persistSharedState() {
  try {
    await supabase.from("site_settings").upsert(
      {
        id: WHATSAPP_WORKER_STATE_SETTING_ID,
        value: workerState,
      },
      { onConflict: "id" },
    )
  } catch (error) {
    log("Failed to persist shared worker state.", error)
  }
}

async function writeQrImage(qrValue) {
  if (!qrValue) {
    removeQrImage()
    return
  }

  ensureDirectory(QR_IMAGE_PATH)
  try {
    await QRCode.toFile(QR_IMAGE_PATH, qrValue, {
      margin: 2,
      width: 420,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })
  } catch (error) {
    log("Failed to write QR image.", error)
  }
}

async function updateState(patch) {
  workerState = {
    ...workerState,
    ...patch,
    lastUpdatedAt: new Date().toISOString(),
  }

  ensureDirectory(STATUS_FILE_PATH)
  fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(workerState, null, 2), "utf8")
  await writeQrImage(workerState.qrValue)
  await persistSharedState()
}

function touchHeartbeat() {
  workerState.lastHeartbeatAt = new Date().toISOString()
  workerState.lastUpdatedAt = workerState.lastHeartbeatAt
  ensureDirectory(STATUS_FILE_PATH)
  fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(workerState, null, 2), "utf8")
  void persistSharedState()
}

function writeLockFile() {
  ensureDirectory(LOCK_FILE_PATH)
  fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2), "utf8")
}

function removeLockFile() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH)
    }
  } catch {
    // Ignore cleanup failure.
  }
}

function getChatIdFromPhone(phoneNumber) {
  return `${String(phoneNumber || "").replace(/^\+/, "")}@c.us`
}

async function markQueueResult(id, status, errorMessage, whatsappMessageId) {
  const nowIso = new Date().toISOString()
  await supabase.from(WHATSAPP_QUEUE_TABLE).update({
    status,
    error_message: errorMessage || null,
    updated_at: nowIso,
  }).eq("id", id)

  await supabase.from(WHATSAPP_HISTORY_TABLE).update({
    status,
    error_message: errorMessage || null,
    message_id: whatsappMessageId || null,
    sent_at: status === "sent" ? nowIso : null,
    updated_at: nowIso,
  }).eq("id", id)
}

async function processQueue() {
  if (!client || !workerState.ready || isProcessingQueue) {
    return
  }

  isProcessingQueue = true

  try {
    const { data: pendingRows, error } = await supabase
      .from(WHATSAPP_QUEUE_TABLE)
      .select("id, phone_number, message")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5)

    if (error) {
      if (error.code !== "42P01") {
        log("Failed to read WhatsApp queue.", error)
      }
      return
    }

    for (const row of pendingRows || []) {
      const { data: claimedRow, error: claimError } = await supabase
        .from(WHATSAPP_QUEUE_TABLE)
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id, phone_number, message")
        .maybeSingle()

      if (claimError || !claimedRow) {
        continue
      }

      try {
        const sentMessage = await client.sendMessage(getChatIdFromPhone(claimedRow.phone_number), claimedRow.message)
        const whatsappMessageId = sentMessage?.id?._serialized || sentMessage?.id?.id || null
        await markQueueResult(claimedRow.id, "sent", null, whatsappMessageId)
      } catch (error) {
        await markQueueResult(claimedRow.id, "failed", error instanceof Error ? error.message : "تعذر الإرسال", null)
      }
    }
  } catch (error) {
    log("Unexpected queue processing error.", error)
  } finally {
    isProcessingQueue = false
  }
}

async function handleDisconnectCommand() {
  if (!client || isRestarting) {
    return
  }

  isRestarting = true
  try {
    await updateState({
      status: "disconnecting",
      ready: false,
      authenticated: false,
      lastError: null,
    })

    try {
      await client.logout()
    } catch {
      // Ignore logout failures and proceed with destroy.
    }

    try {
      await client.destroy()
    } catch {
      // Ignore destroy failure.
    }

    client = null
    await updateState({
      status: "starting",
      ready: false,
      authenticated: false,
      qrAvailable: false,
      qrValue: null,
      disconnectedAt: new Date().toISOString(),
    })
    setTimeout(() => {
      void startClient()
    }, 1500)
  } finally {
    isRestarting = false
  }
}

async function pollCommands() {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("value")
      .eq("id", WHATSAPP_WORKER_COMMAND_SETTING_ID)
      .maybeSingle()

    if (error || !data?.value || typeof data.value !== "object") {
      return
    }

    const requestedAt = String(data.value.requestedAt || "")
    const action = String(data.value.action || "")
    if (!requestedAt || requestedAt === lastHandledCommandAt) {
      return
    }

    lastHandledCommandAt = requestedAt
    if (action === "disconnect") {
      await handleDisconnectCommand()
    }
  } catch (error) {
    log("Failed to poll WhatsApp commands.", error)
  }
}

function attachClientEvents(nextClient) {
  nextClient.on("qr", async (qr) => {
    qrcodeTerminal.generate(qr, { small: true })
    await updateState({
      status: "waiting_for_qr",
      qrAvailable: true,
      ready: false,
      authenticated: false,
      qrValue: qr,
      qrUpdatedAt: new Date().toISOString(),
      lastError: null,
    })
  })

  nextClient.on("authenticated", async () => {
    await updateState({
      status: "authenticating",
      qrAvailable: false,
      qrValue: null,
      lastError: null,
    })
  })

  nextClient.on("ready", async () => {
    await updateState({
      status: "connected",
      qrAvailable: false,
      ready: true,
      authenticated: true,
      qrValue: null,
      qrUpdatedAt: null,
      connectedAt: new Date().toISOString(),
      lastError: null,
    })
  })

  nextClient.on("auth_failure", async (message) => {
    await updateState({
      status: "auth_failed",
      qrAvailable: false,
      ready: false,
      authenticated: false,
      qrValue: null,
      authFailedAt: new Date().toISOString(),
      lastError: String(message || "فشل التحقق من الجلسة"),
    })
  })

  nextClient.on("disconnected", async (reason) => {
    await updateState({
      status: "disconnected",
      qrAvailable: false,
      ready: false,
      authenticated: false,
      qrValue: null,
      disconnectedAt: new Date().toISOString(),
      lastError: String(reason || "Disconnected"),
    })

    if (!isRestarting) {
      setTimeout(() => {
        void startClient()
      }, 2500)
    }
  })
}

async function startClient() {
  if (client) {
    return
  }

  await updateState({
    status: "starting",
    workerMode: WORKER_MODE,
    deviceLabel: DEVICE_LABEL,
    instanceSlug: INSTANCE_SLUG,
    lastError: null,
  })

  const browserExecutablePath = resolveBrowserExecutablePath()

  const nextClient = new Client({
    authStrategy: new LocalAuth({
      clientId: process.env.WHATSAPP_CLIENT_ID || `jm3eh1-whatsapp-${INSTANCE_SLUG}`,
      dataPath: AUTH_DATA_PATH,
    }),
    puppeteer: {
      headless: true,
      executablePath: browserExecutablePath,
      args: process.platform === "linux"
        ? ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
        : ["--no-first-run"],
    },
  })

  attachClientEvents(nextClient)
  client = nextClient

  try {
    await nextClient.initialize()
  } catch (error) {
    log("WhatsApp client initialization failed.", error)
    await updateState({
      status: "auth_failed",
      ready: false,
      authenticated: false,
      lastError: error instanceof Error ? error.message : "تعذر تشغيل عميل واتساب",
      authFailedAt: new Date().toISOString(),
    })
    client = null
  }
}

async function shutdown() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval)
  }
  if (queueInterval) {
    clearInterval(queueInterval)
  }
  if (commandInterval) {
    clearInterval(commandInterval)
  }

  try {
    if (client) {
      await client.destroy()
    }
  } catch {
    // Ignore destroy failure.
  }

  removeLockFile()
}

process.on("SIGINT", async () => {
  await shutdown()
  process.exit(0)
})

process.on("SIGTERM", async () => {
  await shutdown()
  process.exit(0)
})

async function main() {
  writeLockFile()
  await startClient()
  heartbeatInterval = setInterval(touchHeartbeat, HEARTBEAT_INTERVAL_MS)
  queueInterval = setInterval(() => {
    void processQueue()
  }, QUEUE_POLL_INTERVAL_MS)
  commandInterval = setInterval(() => {
    void pollCommands()
  }, COMMAND_POLL_INTERVAL_MS)
  touchHeartbeat()
  log(`WhatsApp worker started for instance ${INSTANCE_SLUG} (${WORKER_MODE}).`)
}

void main()