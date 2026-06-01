import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"

import { NextResponse } from "next/server"

import { hasPermission, requireCurrentUser } from "@/lib/auth"
import { readWhatsAppDeliveryMode } from "@/lib/whatsapp-delivery-mode"
import { getDefaultWhatsAppInstanceSlug, readWhatsAppWorkerStatus } from "@/lib/whatsapp-worker-status"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0

const PROJECT_ROOT = process.cwd()
const WORKER_ENTRY_PATH = path.join(PROJECT_ROOT, "whatsapp-worker", "index.js")
const LOCAL_ENV_PATH = path.join(PROJECT_ROOT, ".env.local-worker")

function isProcessAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function getRunningWorkerPid(lockFilePath: string) {
  try {
    if (!fs.existsSync(lockFilePath)) {
      return null
    }

    const rawLock = fs.readFileSync(lockFilePath, "utf8")
    const payload = rawLock.trim() ? JSON.parse(rawLock) as { pid?: number } : {}
    const pid = Number(payload.pid)
    return isProcessAlive(pid) ? pid : null
  } catch {
    return null
  }
}

export async function POST() {
  const user = await requireCurrentUser()
  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  try {
    const deliveryMode = await readWhatsAppDeliveryMode()
    if (deliveryMode === "cloud") {
      return NextResponse.json({ error: "وضع الإرسال الحالي سحابي. شغّل العامل السحابي بدل التشغيل المحلي." }, { status: 409 })
    }

    if (process.env.VERCEL) {
      return NextResponse.json({ error: "التشغيل التلقائي للعامل المحلي غير متاح على Vercel" }, { status: 409 })
    }

    if (!fs.existsSync(WORKER_ENTRY_PATH)) {
      return NextResponse.json({ error: "ملف عامل واتساب غير موجود" }, { status: 404 })
    }

    const status = await readWhatsAppWorkerStatus()
    if (status.workerOnline) {
      return NextResponse.json({ success: true, alreadyRunning: true })
    }

    const instanceSlug = getDefaultWhatsAppInstanceSlug()
    const lockFilePath = path.join(PROJECT_ROOT, "whatsapp-worker", `worker-${instanceSlug}.lock`)
    const existingPid = getRunningWorkerPid(lockFilePath)
    if (existingPid) {
      return NextResponse.json({ success: true, alreadyRunning: true, pid: existingPid })
    }

    const child = spawn(process.execPath, [WORKER_ENTRY_PATH], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        WORKER_ENV_FILE: fs.existsSync(LOCAL_ENV_PATH) ? ".env.local-worker" : "",
        WHATSAPP_WORKER_MODE: "local",
        WHATSAPP_DEVICE_LABEL: process.env.WHATSAPP_DEVICE_LABEL || "الجهاز الحالي",
      },
    })

    child.unref()

    return NextResponse.json({ success: true, started: true, pid: child.pid ?? null })
  } catch (error) {
    console.error("[WhatsApp] Ensure worker error:", error)
    return NextResponse.json({ error: "تعذر تشغيل عامل واتساب المحلي تلقائياً" }, { status: 500 })
  }
}