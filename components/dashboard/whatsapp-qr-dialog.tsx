"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, LoaderCircle, LogOut, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { type WhatsAppDeliveryMode, type WhatsAppWorkerStatus, getDefaultWhatsAppWorkerStatus } from "@/lib/whatsapp-config"

type WhatsAppQrDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStatus?: Partial<WhatsAppWorkerStatus> | null
}

const QR_WARNING_MESSAGE = [
  "إذا كان الجوال غير متصل بالإنترنت أو خرجت جلسة واتساب من الأجهزة المرتبطة، سيتوقف الإرسال حتى تعود الحالة إلى تم الربط.",
  "",
  "لثبات الإرسال:",
  "- أبق الجوال متصلاً بالإنترنت.",
  "- لا تسجل خروجاً من واتساب ويب أو الأجهزة المرتبطة.",
  "- إذا انقطعت الجلسة، امسح الباركود من جديد.",
].join("\n")

function getAutoRefreshIntervalMs(status: WhatsAppWorkerStatus, isStartingWorker: boolean) {
  if (isStartingWorker) {
    return 1200
  }

  if (status.workerOnline && status.ready && status.authenticated && status.status === "connected") {
    return 4000
  }

  switch (status.status) {
    case "authenticating":
    case "disconnecting":
    case "fetching_qr":
    case "starting":
      return 1200
    default:
      return 5000
  }
}

function getStatusUi(status: WhatsAppWorkerStatus, isStartingWorker: boolean, startupError: string | null) {
  if (startupError) {
    return {
      label: "تعذر تشغيل عامل واتساب المحلي",
      description: startupError,
    }
  }

  if (isStartingWorker) {
    return {
      label: "جاري تشغيل عامل واتساب المحلي",
      description: "يتم تشغيل العامل المحلي تلقائياً على هذا الجهاز، انتظر قليلاً ليظهر الباركود.",
    }
  }

  if (status.workerOnline && status.ready && status.authenticated && status.status === "connected") {
    return {
      label: "تم الربط",
      description: "الواتساب متصل الآن وجاهز للإرسال الجماعي.",
    }
  }

  if (!status.workerOnline) {
    return {
      label: status.workerMode === "local" ? "العامل المحلي غير متصل" : "العامل السحابي غير متصل",
      description: "الخادم المسؤول عن واتساب غير متصل حالياً.",
    }
  }

  switch (status.status) {
    case "waiting_for_qr":
      return {
        label: "الباركود جاهز",
        description: "امسح الباركود من تطبيق واتساب لإكمال الربط.",
      }
    case "authenticating":
      return {
        label: "جاري التحقق",
        description: "تمت قراءة الباركود. انتظر حتى يكتمل الربط.",
      }
    case "disconnecting":
    case "fetching_qr":
      return {
        label: "جاري جلب باركود جديد",
        description: "يتم إنهاء الجلسة الحالية وتجهيز باركود جديد.",
      }
    case "auth_failed":
      return {
        label: "فشل الربط",
        description: "فشل التحقق من الجلسة وقد تحتاج إلى تحديث الباركود أو إعادة الربط.",
      }
    default:
      return {
        label: "بانتظار الباركود",
        description: "لم يظهر باركود جاهز حتى الآن.",
      }
  }
}

export function WhatsAppQrDialog({ open, onOpenChange, initialStatus }: WhatsAppQrDialogProps) {
  const [status, setStatus] = useState<WhatsAppWorkerStatus>(getDefaultWhatsAppWorkerStatus())
  const [deliveryMode, setDeliveryMode] = useState<WhatsAppDeliveryMode>("cloud")
  const [isLoadingStatus, setIsLoadingStatus] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isStartingWorker, setIsStartingWorker] = useState(false)
  const [isUpdatingMode, setIsUpdatingMode] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)
  const hasAttemptedAutoStartRef = useRef(false)

  const statusUi = useMemo(() => getStatusUi(status, isStartingWorker, startupError), [isStartingWorker, startupError, status])
  const isConnected = status.workerOnline && status.ready && status.authenticated && status.status === "connected"
  const canDisconnect = isConnected && !isDisconnecting
  const autoRefreshIntervalMs = getAutoRefreshIntervalMs(status, isStartingWorker)

  const fetchDeliveryMode = async () => {
    try {
      const response = await fetch(`/api/whatsapp/mode?t=${Date.now()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("تعذر جلب وضع الإرسال")
      }

      const data = (await response.json()) as { mode?: string }
      setDeliveryMode(data.mode === "cloud" ? "cloud" : "local")
    } catch (error) {
      console.error("[whatsapp-qr-dialog] fetch mode:", error)
    }
  }

  const fetchStatus = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) {
        setIsLoadingStatus(true)
      }

      const response = await fetch(`/api/whatsapp/status?t=${Date.now()}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("تعذر جلب حالة واتساب")
      }

      const data = (await response.json()) as WhatsAppWorkerStatus
      setStatus({ ...getDefaultWhatsAppWorkerStatus(), ...data })
      setImageFailed(false)
      if (data.workerOnline) {
        setStartupError(null)
      }
    } catch (error) {
      console.error("[whatsapp-qr-dialog] fetch status:", error)
    } finally {
      if (!silent) {
        setIsLoadingStatus(false)
      }
    }
  }

  const ensureWorkerStarted = async () => {
    try {
      setIsStartingWorker(true)

      const response = await fetch("/api/whatsapp/ensure-worker", {
        method: "POST",
        cache: "no-store",
      })

      const data = await response.json().catch(() => null) as { error?: string; alreadyRunning?: boolean }
      if (!response.ok) {
        return {
          success: false,
          error: data?.error || "تعذر تشغيل عامل واتساب المحلي",
        }
      }

      return {
        success: true,
        message: data?.alreadyRunning ? "عامل واتساب المحلي شغال بالفعل." : "تم إرسال طلب تشغيل عامل واتساب المحلي.",
      }
    } catch {
      return {
        success: false,
        error: "تعذر الوصول إلى خدمة تشغيل عامل واتساب المحلي",
      }
    } finally {
      window.setTimeout(() => setIsStartingWorker(false), 2500)
    }
  }

  useEffect(() => {
    if (!open) {
      hasAttemptedAutoStartRef.current = false
      setIsStartingWorker(false)
      setStartupError(null)
      return
    }

    if (initialStatus) {
      setStatus((current) => ({ ...getDefaultWhatsAppWorkerStatus(), ...current, ...initialStatus }))
      if (initialStatus.workerMode === "local" || initialStatus.workerMode === "cloud") {
        setDeliveryMode(initialStatus.workerMode)
      }
    }

    void fetchDeliveryMode()
    void fetchStatus()
  }, [open, initialStatus])

  useEffect(() => {
    if (!open || deliveryMode !== "local" || status.workerOnline || hasAttemptedAutoStartRef.current) {
      return
    }

    hasAttemptedAutoStartRef.current = true
    void ensureWorkerStarted().then((result) => {
      if (result.success) {
        setStartupError(null)
        void fetchStatus({ silent: true })
        return
      }

      setStartupError(result.error)
    })
  }, [deliveryMode, open, status.workerOnline])

  useEffect(() => {
    if (!open || autoRefreshIntervalMs <= 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      void fetchStatus({ silent: true })
    }, autoRefreshIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [open, autoRefreshIntervalMs])

  const handleDeliveryModeChange = async (nextMode: WhatsAppDeliveryMode) => {
    if (nextMode === deliveryMode || isUpdatingMode) {
      return
    }

    try {
      setIsUpdatingMode(true)
      const response = await fetch("/api/whatsapp/mode", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      })

      const data = await response.json().catch(() => null) as { error?: string }
      if (!response.ok) {
        throw new Error(data?.error || "تعذر تحديث وضع الإرسال")
      }

      setDeliveryMode(nextMode)
      setStartupError(null)

      if (nextMode === "local") {
        const result = await ensureWorkerStarted()
        if (!result.success) {
          setStartupError(result.error)
        }
      }

      await fetchStatus()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "تعذر تحديث وضع الإرسال")
    } finally {
      setIsUpdatingMode(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm("سيتم فصل الجهاز الحالي وإنشاء باركود جديد. هل تريد المتابعة؟")) {
      return
    }

    try {
      setIsDisconnecting(true)
      const response = await fetch("/api/whatsapp/disconnect", { method: "POST" })
      const data = await response.json().catch(() => null) as { error?: string }
      if (!response.ok) {
        throw new Error(data?.error || "تعذر إلغاء الربط")
      }

      setStatus((current) => ({
        ...current,
        status: "fetching_qr",
        ready: false,
        authenticated: false,
        qrAvailable: false,
        qrImageUrl: null,
      }))

      window.alert("تم إرسال طلب إلغاء الربط. حدّث الباركود بعد لحظات لعرض الكود الجديد.")
      onOpenChange(false)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "تعذر إلغاء الربط حالياً")
    } finally {
      setIsDisconnecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden rounded-[28px] border-[#d8e0f0] bg-white p-0" showCloseButton={false}>
        <div className="space-y-0" dir="rtl">
          <DialogHeader className="border-b border-[#e6edf8] px-5 py-4">
            <div className="flex flex-col gap-3">
              <div className="relative flex min-h-9 items-start justify-center">
                <DialogTitle className="text-center text-xl font-black leading-tight text-[#1a2332]">
                  باركود الواتساب
                </DialogTitle>

                <div className="absolute left-0 top-0 flex items-center justify-start">
                  {status.qrAvailable ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => window.alert(QR_WARNING_MESSAGE)}
                      className="h-9 w-9 rounded-2xl border-[#cfe0ff] bg-[#eef5ff] text-[#3453a7] hover:bg-[#e2eeff] hover:text-[#3453a7]"
                      aria-label="عرض تنبيه مهم عن ربط واتساب"
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <div className="h-9 w-9 shrink-0" aria-hidden="true" />
                  )}
                </div>
              </div>

              <p className="text-right text-sm font-bold leading-7 text-[#64748b]">
                يجب أن يكون الهاتف والجهاز المرتبط به الباركود متصلين بالإنترنت أثناء إرسال الرسائل.
              </p>

              <p className="text-right text-sm font-bold leading-7 text-[#64748b]">
                إذا لم يعمل العامل السحابي استخدم العامل المحلي من نفس النافذة.
              </p>

              <div className="flex items-center justify-start gap-2">
                <Button
                  type="button"
                  variant={deliveryMode === "local" ? "default" : "outline"}
                  onClick={() => void handleDeliveryModeChange("local")}
                  disabled={isUpdatingMode}
                  className="h-10 rounded-2xl px-4 text-sm font-black"
                >
                  العامل المحلي
                </Button>
                <Button
                  type="button"
                  variant={deliveryMode === "cloud" ? "default" : "outline"}
                  onClick={() => void handleDeliveryModeChange("cloud")}
                  disabled={isUpdatingMode}
                  className="h-10 rounded-2xl px-4 text-sm font-black"
                >
                  العامل السحابي
                </Button>
              </div>

              {canDisconnect ? (
                <div className="flex justify-start">
                  <Button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isDisconnecting}
                    variant="outline"
                    className="h-10 rounded-2xl border-rose-200 bg-rose-50 px-3 text-sm font-black text-rose-700 hover:bg-rose-100 hover:text-rose-700"
                  >
                    <LogOut className="me-1.5 h-4 w-4" />
                    {isDisconnecting ? "جاري الإلغاء..." : "إلغاء الربط"}
                  </Button>
                </div>
              ) : null}
            </div>
          </DialogHeader>

          <div className="space-y-4 p-5">
            {status.qrAvailable && status.qrImageUrl && !imageFailed ? (
              <div className="relative flex justify-center rounded-[24px] border border-dashed border-[#cfdcf2] bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8fbff_55%,#eef3ff_100%)] p-4">
                <img
                  src={status.qrImageUrl}
                  alt="باركود واتساب"
                  className="h-auto w-full max-w-[280px] rounded-2xl bg-white p-3 shadow-[0_14px_40px_rgba(20,39,92,0.10)]"
                  onError={() => {
                    setImageFailed(true)
                    void fetchStatus({ silent: true })
                  }}
                />
              </div>
            ) : (
              <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed border-[#d5dfef] bg-[linear-gradient(180deg,#fbfcff_0%,#f2f6ff_100%)] px-5 py-8 text-center">
                {isLoadingStatus ? (
                  <LoaderCircle className="h-10 w-10 animate-spin text-[#3453a7]" />
                ) : isConnected ? (
                  <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                ) : (
                  <Smartphone className="h-14 w-14 text-[#3453a7]" />
                )}
                <div className="space-y-2">
                  <p className="text-lg font-black text-[#1a2332]">{statusUi.label}</p>
                  <p className="text-sm font-bold text-[#64748b]">{statusUi.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}