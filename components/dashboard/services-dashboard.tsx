"use client"

import { LoaderCircle, Plus, Save, Stamp, Trash2, Upload } from "lucide-react"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { ServiceAsset, ServiceAssetKind, ServiceDocumentTemplate, ServicesDashboardData } from "@/lib/services"

type MessageState = { type: "success" | "error"; text: string } | null

type PdfImagePage = {
  pageNumber: number
  dataUrl: string
  blob?: Blob
}

type StampPosition = {
  xPercent: number
  yPercent: number
}

type PlacedAsset = {
  id: string
  assetId: string
  pageNumber: number
  xPercent: number
  yPercent: number
  scalePercent: number
}

type EditableTextLayer = {
  id: string
  pageNumber: number
  text: string
  xPercent: number
  yPercent: number
  fontSize: number
  color: string
}

type WriterTemplateConfig = {
  version: 1
  backgroundKind: "image" | "html"
  backgroundValue: string
  textLayers: EditableTextLayer[]
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = "none"
  document.body.appendChild(anchor)
  anchor.click()
  window.setTimeout(() => {
    anchor.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

const crc32Table = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let crc = index
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1)
    }
    table[index] = crc >>> 0
  }
  return table
})()

function calculateCrc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const value of data) {
    crc = crc32Table[(crc ^ value) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function getZipDosDateParts(date: Date) {
  const year = Math.max(1980, date.getFullYear())
  const dosTime = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | Math.floor(date.getSeconds() / 2)
  const dosDate = (((year - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f)
  return { dosTime, dosDate }
}

function setUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true)
}

function setUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true)
}

function createStoredZip(files: Array<{ name: string; data: Uint8Array }>) {
  const encoder = new TextEncoder()
  const zipDate = getZipDosDateParts(new Date())
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  let centralDirectorySize = 0

  for (const file of files) {
    const nameBytes = encoder.encode(file.name)
    const crc32 = calculateCrc32(file.data)

    const localHeader = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(localHeader.buffer)
    setUint32(localView, 0, 0x04034b50)
    setUint16(localView, 4, 20)
    setUint16(localView, 6, 0)
    setUint16(localView, 8, 0)
    setUint16(localView, 10, zipDate.dosTime)
    setUint16(localView, 12, zipDate.dosDate)
    setUint32(localView, 14, crc32)
    setUint32(localView, 18, file.data.length)
    setUint32(localView, 22, file.data.length)
    setUint16(localView, 26, nameBytes.length)
    setUint16(localView, 28, 0)
    localHeader.set(nameBytes, 30)
    localParts.push(localHeader, file.data)

    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(centralHeader.buffer)
    setUint32(centralView, 0, 0x02014b50)
    setUint16(centralView, 4, 20)
    setUint16(centralView, 6, 20)
    setUint16(centralView, 8, 0)
    setUint16(centralView, 10, 0)
    setUint16(centralView, 12, zipDate.dosTime)
    setUint16(centralView, 14, zipDate.dosDate)
    setUint32(centralView, 16, crc32)
    setUint32(centralView, 20, file.data.length)
    setUint32(centralView, 24, file.data.length)
    setUint16(centralView, 28, nameBytes.length)
    setUint16(centralView, 30, 0)
    setUint16(centralView, 32, 0)
    setUint16(centralView, 34, 0)
    setUint16(centralView, 36, 0)
    setUint32(centralView, 38, 0)
    setUint32(centralView, 42, offset)
    centralHeader.set(nameBytes, 46)
    centralParts.push(centralHeader)

    offset += localHeader.length + file.data.length
    centralDirectorySize += centralHeader.length
  }

  const endRecord = new Uint8Array(22)
  const endView = new DataView(endRecord.buffer)
  setUint32(endView, 0, 0x06054b50)
  setUint16(endView, 4, 0)
  setUint16(endView, 6, 0)
  setUint16(endView, 8, files.length)
  setUint16(endView, 10, files.length)
  setUint32(endView, 12, centralDirectorySize)
  setUint32(endView, 16, offset)
  setUint16(endView, 20, 0)

  return new Blob([...localParts, ...centralParts, endRecord], { type: "application/zip" })
}

async function downloadPdfImagePages(pages: PdfImagePage[], baseFileName: string) {
  const zipFiles = await Promise.all(
    pages.map(async (page) => ({
      name: `${baseFileName}-page-${page.pageNumber}.png`,
      data: new Uint8Array(await (page.blob ?? fetch(page.dataUrl).then((response) => response.blob())).arrayBuffer()),
    })),
  )

  const zipBlob = createStoredZip(zipFiles)
  downloadBlob(zipBlob, `${baseFileName}-images.zip`)
}

async function renderPdfPreviewPages(file: File, scale: number, errorMessage: string) {
  const pdfjs = await loadPdfJs()
  const bytes = await readFileAsArrayBuffer(file)
  const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise
  const nextPages: PdfImagePage[] = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error(errorMessage)
    }

    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: context, viewport }).promise
    const blob = await canvasToPngBlob(canvas)
    nextPages.push({ pageNumber, dataUrl: URL.createObjectURL(blob), blob })
  }

  if (nextPages.length === 0) {
    throw new Error("تعذر استخراج صفحات PDF للمعاينة")
  }

  return nextPages
}

function readFileAsArrayBuffer(file: File) {
  return file.arrayBuffer()
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("تعذر إنشاء صورة الصفحة"))
        return
      }

      resolve(nextBlob)
    }, "image/png")
  })
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.72) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("تعذر إنشاء صورة الصفحة"))
        return
      }

      resolve(nextBlob)
    }, "image/jpeg", quality)
  })
}

function isPdfFile(file: File | null | undefined) {
  return Boolean(file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")))
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const loadFromSource = (source: string, revoke?: () => void) => {
      const image = new Image()
      image.crossOrigin = "anonymous"
      image.onload = () => {
        revoke?.()
        resolve(image)
      }
      image.onerror = () => {
        revoke?.()
        reject(new Error("تعذر تحميل الصورة"))
      }
      image.src = source
    }

    if (url.startsWith("data:") || url.startsWith("blob:")) {
      loadFromSource(url)
      return
    }

    fetch(url, { mode: "cors" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("تعذر تحميل الصورة")
        }

        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)
        loadFromSource(objectUrl, () => URL.revokeObjectURL(objectUrl))
      })
      .catch(() => {
        loadFromSource(url)
      })
  })
}

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString()
  }
  return pdfjs
}

function parseWriterTemplateConfig(value: string): WriterTemplateConfig {
  try {
    const parsed = JSON.parse(value) as Partial<WriterTemplateConfig>
    if (parsed && parsed.version === 1 && (parsed.backgroundKind === "image" || parsed.backgroundKind === "html") && typeof parsed.backgroundValue === "string" && Array.isArray(parsed.textLayers)) {
      return {
        version: 1,
        backgroundKind: parsed.backgroundKind,
        backgroundValue: parsed.backgroundValue,
        textLayers: parsed.textLayers.map((layer) => ({
          id: String(layer.id ?? `layer-${Math.random().toString(36).slice(2, 8)}`),
          pageNumber: Number(layer.pageNumber ?? 1) || 1,
          text: String(layer.text ?? ""),
          xPercent: Number(layer.xPercent ?? 50) || 50,
          yPercent: Number(layer.yPercent ?? 20) || 20,
          fontSize: Number(layer.fontSize ?? 28) || 28,
          color: String(layer.color ?? "#111827"),
        })),
      }
    }
  } catch {
    // Fall through to legacy template support.
  }

  return {
    version: 1,
    backgroundKind: "html",
    backgroundValue: value || "<div></div>",
    textLayers: [],
  }
}

function serializeWriterTemplateConfig(config: WriterTemplateConfig) {
  return JSON.stringify(config)
}

export function ServicesDashboard({ initialTab = "image_to_pdf" }: { initialTab?: string } = {}) {
  const [data, setData] = useState<ServicesDashboardData | null>(null)
  const [message, setMessage] = useState<MessageState>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [assetName, setAssetName] = useState("")
  const [assetKind, setAssetKind] = useState<ServiceAssetKind>("stamp")
  const [assetImageUrl, setAssetImageUrl] = useState("")
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)

  const [selectedWriterTemplateId, setSelectedWriterTemplateId] = useState<string>("new")
  const [writerTemplateTitle, setWriterTemplateTitle] = useState("")
  const [writerBackgroundKind, setWriterBackgroundKind] = useState<"image" | "html">("html")
  const [writerBackgroundValue, setWriterBackgroundValue] = useState("")
  const [writerTextLayers, setWriterTextLayers] = useState<EditableTextLayer[]>([])
  const [activeWriterTextLayerId, setActiveWriterTextLayerId] = useState<string | null>(null)
  const [draggingWriterTextLayerId, setDraggingWriterTextLayerId] = useState<string | null>(null)
  const [isPreparingWriterBackground, setIsPreparingWriterBackground] = useState(false)
  const [isWriterTemplateManagerOpen, setIsWriterTemplateManagerOpen] = useState(false)
  const [writerTemplateDraftTitle, setWriterTemplateDraftTitle] = useState("")
  const [writerTemplateDraftFile, setWriterTemplateDraftFile] = useState<File | null>(null)

  const [imageToPdfFiles, setImageToPdfFiles] = useState<File[]>([])
  const [pdfToImagesFile, setPdfToImagesFile] = useState<File | null>(null)
  const [pdfImagePages, setPdfImagePages] = useState<PdfImagePage[]>([])
  const [isConvertingPdfPages, setIsConvertingPdfPages] = useState(false)
  const [compressTargetFile, setCompressTargetFile] = useState<File | null>(null)

  const [editTargetFile, setEditTargetFile] = useState<File | null>(null)
  const [editPreviewPages, setEditPreviewPages] = useState<PdfImagePage[]>([])
  const [isPreparingEditPreview, setIsPreparingEditPreview] = useState(false)
  const [editTextLayers, setEditTextLayers] = useState<EditableTextLayer[]>([])
  const [activeEditTextLayerId, setActiveEditTextLayerId] = useState<string | null>(null)
  const [draggingEditTextLayerId, setDraggingEditTextLayerId] = useState<string | null>(null)

  const [stampTargetFile, setStampTargetFile] = useState<File | null>(null)
  const [stampPreviewPages, setStampPreviewPages] = useState<PdfImagePage[]>([])
  const [placedAssets, setPlacedAssets] = useState<PlacedAsset[]>([])
  const [activePlacedAssetId, setActivePlacedAssetId] = useState<string | null>(null)
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false)
  const [assetDialogMode, setAssetDialogMode] = useState<"picker" | "manager">("picker")
  const [isPreparingStampPreview, setIsPreparingStampPreview] = useState(false)
  const [draggingPlacedAssetId, setDraggingPlacedAssetId] = useState<string | null>(null)
  const stampDragOffsetRef = useRef<StampPosition>({ xPercent: 0, yPercent: 0 })
  const stampDragFrameRef = useRef<number | null>(null)
  const stampDragPendingRef = useRef<{ id: string; pageNumber: number; position: StampPosition } | null>(null)
  const placedAssetElementRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const stampDragMetaRef = useRef<{ pageNumber: number; surfaceElement: HTMLDivElement | null } | null>(null)

  function revokePreviewUrls(pages: PdfImagePage[]) {
    for (const page of pages) {
      if (page.dataUrl.startsWith("blob:")) {
        URL.revokeObjectURL(page.dataUrl)
      }
    }
  }

  async function loadData() {
    setLoading(true)
    const response = await fetch("/api/admin/services", { cache: "no-store" })
    const payload = await response.json() as ServicesDashboardData & { error?: string }

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "تعذر تحميل قسم الخدمات" })
      setLoading(false)
      return
    }

    setData(payload)
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    return () => {
      if (stampDragFrameRef.current !== null) {
        window.cancelAnimationFrame(stampDragFrameRef.current)
      }
    }
  }, [])

  const assetStats = useMemo(() => ({
    total: data?.assets.length ?? 0,
    stamps: data?.assets.filter((asset) => asset.kind === "stamp").length ?? 0,
    signatures: data?.assets.filter((asset) => asset.kind === "signature").length ?? 0,
    templates: data?.templates.length ?? 0,
  }), [data])

  const selectedWriterTemplate = useMemo(
    () => data?.templates.find((template) => template.id === selectedWriterTemplateId) ?? null,
    [data, selectedWriterTemplateId],
  )

  const assetMap = useMemo(
    () => new Map((data?.assets ?? []).map((asset) => [asset.id, asset])),
    [data],
  )

  const signatureAssets = useMemo(
    () => (data?.assets ?? []).filter((asset) => asset.kind === "signature"),
    [data],
  )

  const activePlacedAsset = useMemo(
    () => placedAssets.find((item) => item.id === activePlacedAssetId) ?? null,
    [placedAssets, activePlacedAssetId],
  )

  const activeEditTextLayer = useMemo(
    () => editTextLayers.find((item) => item.id === activeEditTextLayerId) ?? null,
    [editTextLayers, activeEditTextLayerId],
  )

  const activeWriterTextLayer = useMemo(
    () => writerTextLayers.find((item) => item.id === activeWriterTextLayerId) ?? null,
    [writerTextLayers, activeWriterTextLayerId],
  )

  const imageToPdfPreviews = useMemo(
    () => imageToPdfFiles.map((file, index) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${index}`,
      file,
      url: URL.createObjectURL(file),
    })),
    [imageToPdfFiles],
  )

  useEffect(() => {
    return () => {
      imageToPdfPreviews.forEach((preview) => URL.revokeObjectURL(preview.url))
    }
  }, [imageToPdfPreviews])

  useEffect(() => {
    if (!draggingPlacedAssetId) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      const dragMeta = stampDragMetaRef.current
      if (!dragMeta?.surfaceElement) {
        return
      }

      const nextPosition = updateStampPositionFromPointer(
        dragMeta.surfaceElement.getBoundingClientRect(),
        event.clientX,
        event.clientY,
        stampDragOffsetRef.current,
      )
      queuePlacedAssetUpdate(draggingPlacedAssetId, dragMeta.pageNumber, nextPosition)
    }

    const handlePointerEnd = () => {
      stopPlacedAssetDragging()
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerEnd)
    window.addEventListener("pointercancel", handlePointerEnd)

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerEnd)
      window.removeEventListener("pointercancel", handlePointerEnd)
    }
  }, [draggingPlacedAssetId])

  function runTask(task: () => Promise<void>) {
    setMessage(null)
    startTransition(async () => {
      try {
        await task()
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
      }
    })
  }

  async function uploadAssetFile(file: File) {
    setIsUploadingAsset(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      })

      const payload = await response.json() as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "تعذر رفع الصورة")
      }

      setAssetImageUrl(payload.url)
      setMessage({ type: "success", text: "تم رفع صورة الأصل، ويمكنك الآن حفظها في المكتبة" })
    } finally {
      setIsUploadingAsset(false)
    }
  }

  function resetWriterTemplateEditor() {
    setSelectedWriterTemplateId("new")
    setWriterTemplateTitle("")
    setWriterBackgroundKind("html")
    setWriterBackgroundValue("")
    setWriterTextLayers([])
    setActiveWriterTextLayerId(null)
  }

  function loadWriterTemplate(template: ServiceDocumentTemplate) {
    const config = parseWriterTemplateConfig(template.contentHtml)
    setSelectedWriterTemplateId(template.id)
    setWriterTemplateTitle(template.title)
    setWriterBackgroundKind(config.backgroundKind)
    setWriterBackgroundValue(config.backgroundValue)
    setWriterTextLayers(config.textLayers)
    setActiveWriterTextLayerId(config.textLayers[0]?.id ?? null)
  }

  async function prepareWriterBackground(file: File): Promise<WriterTemplateConfig> {
    if (isPdfFile(file)) {
      setIsPreparingWriterBackground(true)
      try {
        const pdfjs = await loadPdfJs()
        const bytes = await readFileAsArrayBuffer(file)
        const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")

        if (!context) {
          throw new Error("تعذر تجهيز الصفحة كقالب")
        }

        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: context, viewport }).promise
        const backgroundValue = canvas.toDataURL("image/png")
        setWriterBackgroundKind("image")
        setWriterBackgroundValue(backgroundValue)
        return {
          version: 1,
          backgroundKind: "image",
          backgroundValue,
          textLayers: [],
        }
      } finally {
        setIsPreparingWriterBackground(false)
      }
    }

    if (file.name.toLowerCase().endsWith(".docx")) {
      setIsPreparingWriterBackground(true)
      try {
        const mammoth = await import("mammoth/mammoth.browser")
        const bytes = await readFileAsArrayBuffer(file)
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes })
        setWriterBackgroundKind("html")
        setWriterBackgroundValue(result.value)
        return {
          version: 1,
          backgroundKind: "html",
          backgroundValue: result.value,
          textLayers: [],
        }
      } finally {
        setIsPreparingWriterBackground(false)
      }
    }

    if (file.name.toLowerCase().endsWith(".doc")) {
      throw new Error("صيغة DOC القديمة غير مدعومة حاليًا، استخدم DOCX أو PDF أو صورة")
    }

    const backgroundValue = await readFileAsDataUrl(file)
    setWriterBackgroundKind("image")
    setWriterBackgroundValue(backgroundValue)
    return {
      version: 1,
      backgroundKind: "image",
      backgroundValue,
      textLayers: [],
    }
  }

  async function handleWriterBackgroundChange(file: File) {
    await prepareWriterBackground(file)
    setWriterTextLayers([])
    setActiveWriterTextLayerId(null)
    setWriterTemplateTitle((current) => current.trim() ? current : file.name.replace(/\.[^.]+$/, ""))
  }

  async function saveWriterTemplate(config: WriterTemplateConfig, options?: { templateId?: string; title?: string; description?: string }) {
    const templateTitle = options?.title?.trim() || writerTemplateTitle.trim()
    if (!templateTitle) {
      throw new Error("أدخل عنوانًا للقالب أولًا")
    }

    if (!config.backgroundValue.trim()) {
      throw new Error("ارفع ملف القالب أولًا")
    }

    const templateId = options?.templateId ?? (selectedWriterTemplateId === "new" ? undefined : selectedWriterTemplateId)
    const isNew = !templateId
    const response = await fetch("/api/admin/services", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "template",
        ...(templateId ? { id: templateId } : null),
        title: templateTitle,
        description: options?.description ?? "",
        contentHtml: serializeWriterTemplateConfig(config),
      }),
    })

    const payload = await response.json() as ServicesDashboardData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حفظ القالب")
    }

    setData(payload)
    const latestTemplate = templateId
      ? payload.templates.find((template) => template.id === templateId)
      : payload.templates.find((template) => template.title === templateTitle) ?? payload.templates[0]

    if (latestTemplate) {
      loadWriterTemplate(latestTemplate)
    }

    return { isNew, latestTemplate }
  }

  function resetWriterTemplateDraft() {
    setWriterTemplateDraftTitle("")
    setWriterTemplateDraftFile(null)
  }

  async function handleCreateWriterTemplate(file: File, title?: string) {
    resetWriterTemplateEditor()
    const nextTitle = title?.trim() || file.name.replace(/\.[^.]+$/, "")
    const config = await prepareWriterBackground(file)
    setWriterTemplateTitle(nextTitle)
    setWriterTextLayers([])
    setActiveWriterTextLayerId(null)
    await saveWriterTemplate(config, { title: nextTitle, description: file.name })
    resetWriterTemplateDraft()
    setIsWriterTemplateManagerOpen(false)
    setMessage({ type: "success", text: "تم رفع القالب وحفظه في الموقع" })
  }

  async function handleCreateWriterTemplateFromDialog() {
    if (!writerTemplateDraftFile) {
      throw new Error("اختر ملف القالب أولًا")
    }

    if (!writerTemplateDraftTitle.trim()) {
      throw new Error("أدخل اسم القالب أولًا")
    }

    await handleCreateWriterTemplate(writerTemplateDraftFile, writerTemplateDraftTitle)
  }

  function createWriterTextLayer(): EditableTextLayer {
    return {
      id: `writer-text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pageNumber: 1,
      text: "نص جديد",
      xPercent: 50,
      yPercent: 18,
      fontSize: 28,
      color: "#111827",
    }
  }

  function addWriterTextLayer() {
    const nextLayer = createWriterTextLayer()
    setWriterTextLayers((current) => [...current, nextLayer])
    setActiveWriterTextLayerId(nextLayer.id)
  }

  function updateWriterTextLayer(id: string, updates: Partial<EditableTextLayer>) {
    setWriterTextLayers((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item))
  }

  function removeWriterTextLayer(id: string) {
    setWriterTextLayers((current) => current.filter((item) => item.id !== id))
    setActiveWriterTextLayerId((current) => current === id ? null : current)
  }

  function getWriterLayerPosition(rect: DOMRect, clientX: number, clientY: number) {
    const xPercent = ((clientX - rect.left) / rect.width) * 100
    const yPercent = ((clientY - rect.top) / rect.height) * 100
    return { xPercent: clamp(xPercent, 0, 100), yPercent: clamp(yPercent, 0, 100) }
  }

  async function handleCreateAsset() {
    if (!assetName.trim() || !assetImageUrl) {
      throw new Error("ارفع صورة وأدخل اسم الأصل قبل الحفظ")
    }

    const response = await fetch("/api/admin/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "asset", name: assetName, kind: assetKind, imageUrl: assetImageUrl }),
    })

    const payload = await response.json() as ServicesDashboardData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حفظ الأصل")
    }

    setData(payload)
    setAssetName("")
    setAssetImageUrl("")
    setMessage({ type: "success", text: "تم حفظ الأصل في مكتبة الأختام والتواقيع" })
  }

  async function handleDeleteAsset(id: string) {
    const response = await fetch("/api/admin/services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "asset", id }),
    })
    const payload = await response.json() as ServicesDashboardData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حذف الأصل")
    }

    setData(payload)
    setPlacedAssets((current) => current.filter((item) => item.assetId !== id))
    setActivePlacedAssetId((current) => {
      if (!current) {
        return null
      }

      const activeItem = placedAssets.find((item) => item.id === current)
      return activeItem?.assetId === id ? null : current
    })
    setMessage({ type: "success", text: "تم حذف الأصل من المكتبة" })
  }

  function createPlacedAsset(assetId: string, pageNumber: number): PlacedAsset {
    return {
      id: `${assetId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      assetId,
      pageNumber,
      xPercent: 50,
      yPercent: 50,
      scalePercent: 22,
    }
  }

  function updatePlacedAsset(id: string, updates: Partial<PlacedAsset>) {
    setPlacedAssets((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item))
  }

  function removePlacedAsset(id: string) {
    setPlacedAssets((current) => current.filter((item) => item.id !== id))
    setActivePlacedAssetId((current) => current === id ? null : current)
  }

  function queuePlacedAssetUpdate(id: string, pageNumber: number, position: StampPosition) {
    stampDragPendingRef.current = { id, pageNumber, position }

    if (stampDragFrameRef.current !== null) {
      return
    }

    stampDragFrameRef.current = window.requestAnimationFrame(() => {
      const nextUpdate = stampDragPendingRef.current
      stampDragFrameRef.current = null

      if (!nextUpdate) {
        return
      }

      const assetElement = placedAssetElementRefs.current[nextUpdate.id]
      if (assetElement) {
        assetElement.style.left = `${nextUpdate.position.xPercent}%`
        assetElement.style.top = `${nextUpdate.position.yPercent}%`
      }
    })
  }

  function stopPlacedAssetDragging() {
    const draggingId = draggingPlacedAssetId
    setDraggingPlacedAssetId(null)
    stampDragOffsetRef.current = { xPercent: 0, yPercent: 0 }
    stampDragMetaRef.current = null

    if (stampDragFrameRef.current !== null) {
      window.cancelAnimationFrame(stampDragFrameRef.current)
      stampDragFrameRef.current = null
    }

    const nextUpdate = stampDragPendingRef.current
    stampDragPendingRef.current = null

    if (nextUpdate) {
      updatePlacedAsset(nextUpdate.id, { ...nextUpdate.position, pageNumber: nextUpdate.pageNumber })
    }

    if (draggingId) {
      const assetElement = placedAssetElementRefs.current[draggingId]
      if (assetElement) {
        assetElement.style.willChange = "auto"
      }
    }
  }

  async function handleSaveTemplate() {
    const config: WriterTemplateConfig = {
      version: 1,
      backgroundKind: writerBackgroundKind,
      backgroundValue: writerBackgroundValue,
      textLayers: writerTextLayers,
    }

    const { isNew } = await saveWriterTemplate(config)
    setMessage({ type: "success", text: isNew ? "تم إنشاء القالب" : "تم تحديث القالب" })
  }

  async function handleDeleteTemplate(id: string) {
    const response = await fetch("/api/admin/services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "template", id }),
    })
    const payload = await response.json() as ServicesDashboardData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حذف القالب")
    }

    setData(payload)
    if (selectedWriterTemplateId === id) {
      resetWriterTemplateEditor()
    }
    setMessage({ type: "success", text: "تم حذف القالب" })
  }

  async function handleImageToPdf() {
    if (imageToPdfFiles.length === 0) {
      throw new Error("اختر صورة واحدة على الأقل")
    }

    const pdf = await PDFDocument.create()

    for (const file of imageToPdfFiles) {
      const bytes = await readFileAsArrayBuffer(file)
      const image = file.type.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
      const page = pdf.addPage([image.width, image.height])
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
    }

    const output = await pdf.save()
    downloadBlob(new Blob([output], { type: "application/pdf" }), `images-${Date.now()}.pdf`)
    setMessage({ type: "success", text: "تم تحويل الصور إلى PDF وتنزيل الملف" })
  }

  function moveImageToPdfFile(index: number, direction: "forward" | "backward") {
    setImageToPdfFiles((current) => {
      const targetIndex = direction === "forward" ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= current.length) {
        return current
      }

      const nextFiles = [...current]
      const [movedFile] = nextFiles.splice(index, 1)
      nextFiles.splice(targetIndex, 0, movedFile)
      return nextFiles
    })
  }

  function removeImageToPdfFile(index: number) {
    setImageToPdfFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))
  }

  async function handlePdfToImages() {
    if (!pdfToImagesFile) {
      throw new Error("ارفع ملف PDF أولًا")
    }

    setIsConvertingPdfPages(true)
    try {
      const nextPages = await renderPdfPreviewPages(pdfToImagesFile, 2, "تعذر تجهيز الرسم للصفحة")

      revokePreviewUrls(pdfImagePages)
      setPdfImagePages(nextPages)
      await downloadPdfImagePages(nextPages, pdfToImagesFile.name.replace(/\.pdf$/i, ""))
      setMessage({ type: "success", text: `تم تحويل ${nextPages.length} صفحة وتنزيل ملف ZIP` })
    } finally {
      setIsConvertingPdfPages(false)
    }
  }

  function handlePdfToImagesFileChange(file: File | null) {
    revokePreviewUrls(pdfImagePages)
    setPdfToImagesFile(file)
    setPdfImagePages([])
    setMessage(null)
  }

  async function compressImageFile(file: File) {
    const image = await loadImage(await readFileAsDataUrl(file))
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("تعذر تجهيز الصورة للضغط")
    }

    const maxDimension = 2200
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height))
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error("تعذر ضغط الصورة"))
          return
        }

        resolve(nextBlob)
      }, file.type === "image/png" ? "image/webp" : "image/jpeg", 0.82)
    })

    const extension = file.type === "image/png" ? "webp" : "jpg"
    downloadBlob(blob, `${file.name.replace(/\.[^.]+$/, "")}-compressed.${extension}`)
    setMessage({ type: "success", text: "تم ضغط الصورة وتنزيلها" })
  }

  async function compressPdfFile(file: File) {
    const bytes = await readFileAsArrayBuffer(file)
    const pdfjs = await loadPdfJs()
    const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise
    const compressionPresets = [
      { scale: 1, quality: 0.68 },
      { scale: 0.85, quality: 0.55 },
      { scale: 0.7, quality: 0.42 },
    ]

    let bestOutput: Uint8Array | null = null
    let bestSize = Number.POSITIVE_INFINITY

    for (const preset of compressionPresets) {
      const outputPdf = await PDFDocument.create()

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: preset.scale })
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")

        if (!context) {
          throw new Error("تعذر تجهيز صفحات PDF للضغط")
        }

        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, canvas.width, canvas.height)
        await page.render({ canvasContext: context, viewport }).promise

        const pageBlob = await canvasToJpegBlob(canvas, preset.quality)
        const pageBytes = await pageBlob.arrayBuffer()
        const embeddedImage = await outputPdf.embedJpg(pageBytes)
        const outputPage = outputPdf.addPage([embeddedImage.width, embeddedImage.height])
        outputPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: embeddedImage.width,
          height: embeddedImage.height,
        })
      }

      if (outputPdf.getPageCount() === 0) {
        continue
      }

      const candidateOutput = await outputPdf.save({ useObjectStreams: true })
      if (candidateOutput.byteLength < bestSize) {
        bestOutput = candidateOutput
        bestSize = candidateOutput.byteLength
      }

      if (candidateOutput.byteLength <= bytes.byteLength * 0.8) {
        break
      }
    }

    if (!bestOutput) {
      throw new Error("تعذر ضغط ملف PDF")
    }

    downloadBlob(new Blob([bestOutput], { type: "application/pdf" }), `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf`)
    if (bestSize < bytes.byteLength) {
      const reductionPercent = Math.max(1, Math.round((1 - (bestSize / bytes.byteLength)) * 100))
      setMessage({ type: "success", text: `تم ضغط ملف PDF وتقليل حجمه بنسبة ${reductionPercent}%` })
      return
    }

    setMessage({ type: "success", text: "تم تجهيز ملف PDF وتنزيله، لكن الحجم لم ينخفض بشكل ملحوظ" })
  }

  async function handleCompressFile() {
    if (!compressTargetFile) {
      throw new Error("ارفع صورة أو ملف PDF أولًا")
    }

    if (isPdfFile(compressTargetFile)) {
      await compressPdfFile(compressTargetFile)
      return
    }

    if (compressTargetFile.type.startsWith("image/")) {
      await compressImageFile(compressTargetFile)
      return
    }

    throw new Error("الملف المدعوم يجب أن يكون صورة أو PDF")
  }

  async function prepareEditPreview(file: File) {
    if (isPdfFile(file)) {
      setIsPreparingEditPreview(true)
      try {
        const nextPages = await renderPdfPreviewPages(file, 1.3, "تعذر تجهيز معاينة الملف")

        revokePreviewUrls(editPreviewPages)
        setEditPreviewPages(nextPages)
      } finally {
        setIsPreparingEditPreview(false)
      }

      return
    }

    setEditPreviewPages([{ pageNumber: 1, dataUrl: await readFileAsDataUrl(file) }])
  }

  async function handleEditTargetChange(file: File) {
    setEditTargetFile(file)
    setEditTextLayers([])
    setActiveEditTextLayerId(null)
    setMessage(null)
    try {
      await prepareEditPreview(file)
    } catch (error) {
      revokePreviewUrls(editPreviewPages)
      setEditPreviewPages([])
      setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر تجهيز الملف للمعاينة" })
    }
  }

  function createEditTextLayer(pageNumber: number): EditableTextLayer {
    return {
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      pageNumber,
      text: "نص جديد",
      xPercent: 50,
      yPercent: 20,
      fontSize: 28,
      color: "#111827",
    }
  }

  function addEditTextLayer(pageNumber = 1) {
    const newLayer = createEditTextLayer(pageNumber)
    setEditTextLayers((current) => [...current, newLayer])
    setActiveEditTextLayerId(newLayer.id)
  }

  function updateEditTextLayer(id: string, updates: Partial<EditableTextLayer>) {
    setEditTextLayers((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item))
  }

  function removeEditTextLayer(id: string) {
    setEditTextLayers((current) => current.filter((item) => item.id !== id))
    setActiveEditTextLayerId((current) => current === id ? null : current)
  }

  function getEditPositionFromPointer(rect: DOMRect, clientX: number, clientY: number) {
    const xPercent = ((clientX - rect.left) / rect.width) * 100
    const yPercent = ((clientY - rect.top) / rect.height) * 100
    return { xPercent: clamp(xPercent, 0, 100), yPercent: clamp(yPercent, 0, 100) }
  }

  function drawTextLayersOnCanvas(context: CanvasRenderingContext2D, width: number, height: number, pageNumber: number) {
    context.textAlign = "right"
    context.textBaseline = "top"
    context.direction = "rtl"

    for (const layer of editTextLayers.filter((item) => item.pageNumber === pageNumber && item.text.trim())) {
      context.fillStyle = layer.color
      context.font = `${layer.fontSize}px Arial`
      const x = (layer.xPercent / 100) * width
      const y = (layer.yPercent / 100) * height
      const lines = layer.text.split("\n")

      lines.forEach((line, index) => {
        context.fillText(line, x, y + (index * layer.fontSize * 1.35))
      })
    }
  }

  async function handleApplyDocumentEdits() {
    if (!editTargetFile) {
      throw new Error("ارفع صورة أو ملف PDF أولًا")
    }

    if (editPreviewPages.length === 0) {
      throw new Error("تعذر تجهيز الملف للتحرير")
    }

    if (isPdfFile(editTargetFile)) {
      const outputPdf = await PDFDocument.create()

      for (const previewPage of editPreviewPages) {
        const baseImage = await loadImage(previewPage.dataUrl)
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")

        if (!context) {
          throw new Error("تعذر تجهيز صفحة PDF النهائية")
        }

        canvas.width = baseImage.width
        canvas.height = baseImage.height
        context.drawImage(baseImage, 0, 0)
        drawTextLayersOnCanvas(context, canvas.width, canvas.height, previewPage.pageNumber)

        const pngDataUrl = canvas.toDataURL("image/png")
        const pngBytes = await fetch(pngDataUrl).then((response) => response.arrayBuffer())
        const embeddedPage = await outputPdf.embedPng(pngBytes)
        const page = outputPdf.addPage([embeddedPage.width, embeddedPage.height])
        page.drawImage(embeddedPage, { x: 0, y: 0, width: embeddedPage.width, height: embeddedPage.height })
      }

      const output = await outputPdf.save()
      downloadBlob(new Blob([output], { type: "application/pdf" }), `edited-${editTargetFile.name.replace(/\.pdf$/i, "")}.pdf`)
      setMessage({ type: "success", text: "تم تعديل الملف وتنزيله" })
      return
    }

    const imagePreview = editPreviewPages[0]?.dataUrl
    if (!imagePreview) {
      throw new Error("تعذر تجهيز الصورة للتحرير")
    }

    const targetImage = await loadImage(imagePreview)
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("تعذر تجهيز الصورة النهائية")
    }

    canvas.width = targetImage.width
    canvas.height = targetImage.height
    context.drawImage(targetImage, 0, 0)
    drawTextLayersOnCanvas(context, canvas.width, canvas.height, 1)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error("تعذر إنشاء الصورة النهائية"))
          return
        }
        resolve(nextBlob)
      }, "image/png")
    })

    downloadBlob(blob, `edited-${editTargetFile.name.replace(/\.[^.]+$/, "")}.png`)
    setMessage({ type: "success", text: "تم تعديل الملف وتنزيله" })
  }

  async function prepareStampPreview(file: File) {
    if (isPdfFile(file)) {
      setIsPreparingStampPreview(true)
      try {
        const nextPages = await renderPdfPreviewPages(file, 1.25, "تعذر تجهيز معاينة PDF")

        revokePreviewUrls(stampPreviewPages)
        setStampPreviewPages(nextPages)
      } finally {
        setIsPreparingStampPreview(false)
      }

      return
    }

    revokePreviewUrls(stampPreviewPages)
    setStampPreviewPages([{ pageNumber: 1, dataUrl: await readFileAsDataUrl(file) }])
  }

  async function handleStampTargetChange(file: File) {
    setStampTargetFile(file)
    setPlacedAssets([])
    setActivePlacedAssetId(null)
    setMessage(null)
    try {
      await prepareStampPreview(file)
    } catch (error) {
      revokePreviewUrls(stampPreviewPages)
      setStampPreviewPages([])
      setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر تجهيز الملف للمعاينة" })
    }
  }

  function updateStampPositionFromPointer(rect: DOMRect, clientX: number, clientY: number, offset: StampPosition = { xPercent: 0, yPercent: 0 }) {
    const xPercent = (((clientX - rect.left) / rect.width) * 100) - offset.xPercent
    const yPercent = (((clientY - rect.top) / rect.height) * 100) - offset.yPercent
    return { xPercent: clamp(xPercent, 0, 100), yPercent: clamp(yPercent, 0, 100) }
  }

  function resizeStamp(step: number) {
    if (!activePlacedAssetId) {
      return
    }

    setPlacedAssets((current) => current.map((item) => item.id === activePlacedAssetId ? { ...item, scalePercent: clamp(item.scalePercent + step, 8, 60) } : item))
  }

  function setActivePlacedAssetScale(scalePercent: number) {
    if (!activePlacedAssetId) {
      return
    }

    setPlacedAssets((current) => current.map((item) => item.id === activePlacedAssetId ? { ...item, scalePercent: clamp(scalePercent, 8, 60) } : item))
  }

  async function handleApplyStamp() {
    if (!stampTargetFile) {
      throw new Error("ارفع الملف المستهدف أولًا")
    }

    if (placedAssets.length === 0) {
      throw new Error("أضف ختمًا أو توقيعًا واحدًا على الأقل")
    }

    if (isPdfFile(stampTargetFile)) {
      const bytes = await readFileAsArrayBuffer(stampTargetFile)
      const pdf = await PDFDocument.load(bytes)
      const pages = pdf.getPages()

      for (const placedAsset of placedAssets) {
        const asset = assetMap.get(placedAsset.assetId)
        if (!asset) {
          continue
        }

        const pageIndex = clamp(placedAsset.pageNumber, 1, pages.length) - 1
        const page = pages[pageIndex]
        const assetImage = await loadImage(asset.imageUrl)
        const assetBytes = await fetch(asset.imageUrl).then((response) => response.arrayBuffer())
        const embeddedAsset = asset.imageUrl.includes(".png") ? await pdf.embedPng(assetBytes) : await pdf.embedJpg(assetBytes)
        const stampWidth = page.getWidth() * (placedAsset.scalePercent / 100)
        const scaledHeight = (stampWidth / assetImage.width) * assetImage.height
        const x = (placedAsset.xPercent / 100) * page.getWidth() - (stampWidth / 2)
        const y = page.getHeight() - ((placedAsset.yPercent / 100) * page.getHeight()) - (scaledHeight / 2)

        page.drawImage(embeddedAsset, {
          x: clamp(x, 0, Math.max(0, page.getWidth() - stampWidth)),
          y: clamp(y, 0, Math.max(0, page.getHeight() - scaledHeight)),
          width: stampWidth,
          height: scaledHeight,
        })
      }

      const output = await pdf.save()
      downloadBlob(new Blob([output], { type: "application/pdf" }), `stamped-${stampTargetFile.name.replace(/\.pdf$/i, "")}.pdf`)
      setMessage({ type: "success", text: "تم تطبيق الختم أو التوقيع على ملف PDF" })
      return
    }

    const imagePreview = stampPreviewPages[0]?.dataUrl
    if (!imagePreview) {
      throw new Error("تعذر تجهيز معاينة الملف")
    }

    const targetImage = await loadImage(imagePreview)
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("تعذر تجهيز الصورة النهائية")
    }

    canvas.width = targetImage.width
    canvas.height = targetImage.height
    context.drawImage(targetImage, 0, 0)

    for (const placedAsset of placedAssets) {
      const asset = assetMap.get(placedAsset.assetId)
      if (!asset) {
        continue
      }

      const assetImage = await loadImage(asset.imageUrl)
      const stampWidth = targetImage.width * (placedAsset.scalePercent / 100)
      const stampHeight = (stampWidth / assetImage.width) * assetImage.height
      const x = ((placedAsset.xPercent / 100) * targetImage.width) - (stampWidth / 2)
      const y = ((placedAsset.yPercent / 100) * targetImage.height) - (stampHeight / 2)
      context.drawImage(assetImage, clamp(x, 0, Math.max(0, targetImage.width - stampWidth)), clamp(y, 0, Math.max(0, targetImage.height - stampHeight)), stampWidth, stampHeight)
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error("تعذر إنشاء الصورة النهائية"))
          return
        }
        resolve(nextBlob)
      }, "image/png")
    })

    downloadBlob(blob, `stamped-${stampTargetFile.name.replace(/\.[^.]+$/, "")}.png`)
    setMessage({ type: "success", text: "تم تطبيق الختم أو التوقيع على الصورة" })
  }

  function exportTemplateAsWord() {
    if (!writerTemplateTitle.trim()) {
      setMessage({ type: "error", text: "أدخل عنوان القالب قبل التصدير" })
      return
    }

    if (!writerBackgroundValue.trim()) {
      setMessage({ type: "error", text: "ارفع ملف القالب أولًا" })
      return
    }

    const textLayersHtml = writerTextLayers.map((layer) => `
      <div style="position:absolute; right:${100 - layer.xPercent}%; top:${layer.yPercent}%; transform:translate(50%, -50%); color:${layer.color}; font-size:${layer.fontSize}px; line-height:1.35; white-space:pre-wrap; text-align:right;">
        ${layer.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />")}
      </div>
    `).join("")

    const backgroundHtml = writerBackgroundKind === "image"
      ? `<div style="position:relative; min-height:1100px; background:url('${writerBackgroundValue}') center/contain no-repeat;">${textLayersHtml}</div>`
      : `<div style="position:relative; min-height:1100px;"><div>${writerBackgroundValue}</div>${textLayersHtml}</div>`

    const documentHtml = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${writerTemplateTitle}</title></head><body>${backgroundHtml}</body></html>`
    downloadBlob(new Blob([documentHtml], { type: "application/msword;charset=utf-8" }), `${writerTemplateTitle}.doc`)
    setMessage({ type: "success", text: "تم تصدير القالب كملف Word قابل للفتح والتعديل" })
  }

  if (loading) {
    return (
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!data) {
    return (
      <Alert variant="destructive" className="rounded-[1.5rem] text-right">
        <AlertTitle>تعذر تحميل القسم</AlertTitle>
        <AlertDescription>{message?.text ?? "حدث خطأ غير متوقع أثناء تحميل أدوات الخدمات."}</AlertDescription>
      </Alert>
    )
  }

  const pageTitleByTab: Record<string, string> = {
    image_to_pdf: "تحويل إلى PDF",
    pdf_to_images: "تحويل إلى صورة",
    pdf_editor: "التعديل على PDF أو صورة",
    compress: "ضغط الملف",
    stamps: "الختم والتواقيع",
    writer: "الكتابة على الوورد",
  }

  const pageDescriptionByTab: Record<string, string> = {
    image_to_pdf: "تحويل صورة واحدة أو عدة صور إلى ملف PDF جاهز للتنزيل.",
    pdf_to_images: "استخراج صفحات PDF وتحويلها إلى صور منفصلة قابلة للتنزيل.",
    pdf_editor: "رفع صورة أو PDF ثم إضافة النصوص وتحريكها وتعديل حجمها ولونها قبل تنزيل الملف النهائي.",
    compress: "رفع صورة أو PDF ثم ضغطه بأعلى قدر ممكن مع الحفاظ على جودة جيدة قبل التنزيل.",
    stamps: "إدارة مكتبة الأختام والتواقيع وتطبيقها على الصور وملفات PDF.",
    writer: "إنشاء قوالب كتابة محفوظة وتحريرها ثم تصديرها إلى Word.",
  }

  const isCompactServiceView = initialTab === "stamps" || initialTab === "image_to_pdf" || initialTab === "pdf_to_images" || initialTab === "pdf_editor" || initialTab === "writer" || initialTab === "compress"

  return (
    <section className="space-y-6 text-right">
      {isCompactServiceView ? null : (
        <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <h1 className="text-2xl font-bold text-foreground">{pageTitleByTab[initialTab] ?? "الخدمات"}</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {pageDescriptionByTab[initialTab] ?? "أدوات داخلية للتعامل مع الملفات والقوالب داخل لوحة التحكم."}
          </p>
        </div>
      )}

      {message ? (
        <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          <AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      {isCompactServiceView ? null : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">إجمالي الأصول المحفوظة</p><p className="mt-2 text-3xl font-bold text-foreground">{assetStats.total}</p></CardContent></Card>
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">الأختام</p><p className="mt-2 text-3xl font-bold text-foreground">{assetStats.stamps}</p></CardContent></Card>
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">التواقيع</p><p className="mt-2 text-3xl font-bold text-foreground">{assetStats.signatures}</p></CardContent></Card>
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">قوالب الكتابة</p><p className="mt-2 text-3xl font-bold text-foreground">{assetStats.templates}</p></CardContent></Card>
        </div>
      )}

      <Tabs value={initialTab} className="gap-4">

        <TabsContent value="image_to_pdf" className="space-y-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>تحويل من صورة إلى PDF</CardTitle>
              <CardDescription>ارفع صورة واحدة أو عدة صور، وسيتم دمجها في ملف PDF واحد جاهز للتنزيل.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-[1.25rem] border border-dashed border-border/80 bg-muted/15 p-5">
                <Label htmlFor="image-to-pdf-upload" className="mb-3 block">الصور</Label>
                <Input id="image-to-pdf-upload" type="file" accept="image/*" multiple onChange={(event) => setImageToPdfFiles(Array.from(event.target.files ?? []))} />
                <p className="mt-3 text-sm text-muted-foreground">عدد الملفات المحددة: {imageToPdfFiles.length}</p>
              </div>
              {imageToPdfPreviews.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {imageToPdfPreviews.map((preview, index) => (
                    <div key={preview.key} className="overflow-hidden rounded-[1.25rem] border border-border/60 bg-white">
                      <img src={preview.url} alt={preview.file.name} className="h-56 w-full object-contain bg-muted/10" />
                      <div className="space-y-3 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">الصفحة {index + 1}</span>
                          <span className="text-xs text-muted-foreground">{preview.file.name}</span>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => moveImageToPdfFile(index, "forward")} disabled={index === 0}>تقديم</Button>
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => moveImageToPdfFile(index, "backward")} disabled={index === imageToPdfPreviews.length - 1}>تأخير</Button>
                          <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeImageToPdfFile(index)}><Trash2 className="h-4 w-4" />حذف</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex justify-end"><Button type="button" className="rounded-xl" onClick={() => runTask(handleImageToPdf)} disabled={isPending}>تنزيل</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf_to_images" className="space-y-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>تحويل PDF إلى صور</CardTitle>
              <CardDescription>ارفع ملف PDF وسيتم استخراج صفحات الملف كصور PNG يمكن تنزيل كل صفحة منها بشكل مستقل.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <Input type="file" accept="application/pdf" onChange={(event) => handlePdfToImagesFileChange(event.target.files?.[0] ?? null)} />
                <Button type="button" className="rounded-xl" onClick={() => runTask(handlePdfToImages)} disabled={isPending || isConvertingPdfPages}>{isConvertingPdfPages ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}تنزيل</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pdfImagePages.map((page) => (
                  <div key={page.pageNumber} className="overflow-hidden rounded-[1.25rem] border border-border/60 bg-white">
                    <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="h-64 w-full object-contain bg-muted/10" />
                    <div className="flex items-center justify-between px-4 py-3">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => page.blob ? downloadBlob(page.blob, `page-${page.pageNumber}.png`) : fetch(page.dataUrl).then((response) => response.blob()).then((blob) => downloadBlob(blob, `page-${page.pageNumber}.png`))}>تنزيل</Button>
                      <Badge variant="secondary">الصفحة {page.pageNumber}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compress" className="space-y-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>ضغط الملف</CardTitle>
              <CardDescription>ارفع صورة أو PDF، ثم اضغط الملف مع الحفاظ على جودة عالية قدر الإمكان قبل التنزيل.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <Input type="file" accept="image/*,application/pdf" onChange={(event) => setCompressTargetFile(event.target.files?.[0] ?? null)} />
                <Button type="button" className="rounded-xl" onClick={() => runTask(handleCompressFile)} disabled={isPending}>تنزيل</Button>
              </div>
              {compressTargetFile ? <div className="rounded-[1.25rem] border border-border/60 bg-muted/10 px-4 py-3 text-sm text-foreground">{compressTargetFile.name}</div> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf_editor" className="space-y-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>التعديل على PDF أو صورة</CardTitle>
              <CardDescription>ارفع صورة أو PDF، ثم أضف النصوص وحرّكها داخل المعاينة مع التحكم بالحجم واللون قبل التنزيل.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <Input type="file" accept="image/*,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void handleEditTargetChange(file) } }} />
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => addEditTextLayer(activeEditTextLayer?.pageNumber ?? 1)} disabled={editPreviewPages.length === 0}><Plus className="h-4 w-4" />إضافة نص</Button>
              </div>
              {activeEditTextLayer ? (
                <div className="grid gap-4 rounded-[1.25rem] border border-border/60 bg-muted/10 p-4 md:grid-cols-2 xl:grid-cols-[1.4fr,0.7fr,0.7fr,auto]">
                  <div className="space-y-2 md:col-span-2 xl:col-span-1"><Label>النص</Label><Textarea rows={3} value={activeEditTextLayer.text} onChange={(event) => updateEditTextLayer(activeEditTextLayer.id, { text: event.target.value })} /></div>
                  <div className="space-y-2"><Label>حجم الخط</Label><Input type="number" min={8} value={activeEditTextLayer.fontSize} onChange={(event) => updateEditTextLayer(activeEditTextLayer.id, { fontSize: Number(event.target.value) || 16 })} /></div>
                  <div className="space-y-2"><Label>لون الخط</Label><Input type="color" value={activeEditTextLayer.color} onChange={(event) => updateEditTextLayer(activeEditTextLayer.id, { color: event.target.value })} /></div>
                  <div className="flex items-end"><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeEditTextLayer(activeEditTextLayer.id)}><Trash2 className="h-4 w-4" />حذف النص</Button></div>
                </div>
              ) : null}
              <div className="rounded-[1.25rem] border border-border/60 bg-muted/10 p-4">
                {isPreparingEditPreview ? <div className="flex h-[420px] items-center justify-center"><LoaderCircle className="h-5 w-5 animate-spin text-primary" /></div> : editPreviewPages.length > 0 ? (
                  <div className="space-y-5">
                    {editPreviewPages.map((page) => (
                      <div key={page.pageNumber} className="relative mx-auto max-w-3xl overflow-hidden rounded-[1.25rem] border border-white bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                        <button
                          type="button"
                          className="relative block w-full touch-none"
                          onPointerMove={(event) => {
                            if (!draggingEditTextLayerId) {
                              return
                            }

                            const nextPosition = getEditPositionFromPointer(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY)
                            updateEditTextLayer(draggingEditTextLayerId, { ...nextPosition, pageNumber: page.pageNumber })
                          }}
                          onPointerUp={() => setDraggingEditTextLayerId(null)}
                          onPointerCancel={() => setDraggingEditTextLayerId(null)}
                        >
                          <img src={page.dataUrl} alt={`Preview ${page.pageNumber}`} className="w-full object-contain" />
                          {editTextLayers.filter((item) => item.pageNumber === page.pageNumber).map((layer) => (
                            <button
                              key={layer.id}
                              type="button"
                              className={`absolute min-w-[40px] -translate-x-1/2 -translate-y-1/2 cursor-grab bg-transparent px-1 py-0 text-right shadow-none ${activeEditTextLayerId === layer.id ? "opacity-100" : "opacity-95"}`}
                              style={{
                                left: `${layer.xPercent}%`,
                                top: `${layer.yPercent}%`,
                                color: layer.color,
                                fontSize: `${layer.fontSize}px`,
                                lineHeight: 1.35,
                                textShadow: activeEditTextLayerId === layer.id ? "0 0 10px rgba(255,255,255,0.95)" : "0 0 8px rgba(255,255,255,0.85)",
                              }}
                              onPointerDown={(event) => {
                                event.stopPropagation()
                                setActiveEditTextLayerId(layer.id)
                                setDraggingEditTextLayerId(layer.id)
                                event.currentTarget.setPointerCapture(event.pointerId)
                              }}
                              onPointerUp={(event) => {
                                event.stopPropagation()
                                setDraggingEditTextLayerId(null)
                              }}
                            >
                              <span className="whitespace-pre-wrap bg-transparent">{layer.text || "نص جديد"}</span>
                            </button>
                          ))}
                        </button>
                        {isPdfFile(editTargetFile) ? <Badge className="absolute left-4 top-4 rounded-full">الصفحة {page.pageNumber}</Badge> : null}
                      </div>
                    ))}
                  </div>
                ) : <div className="flex h-[420px] items-center justify-center rounded-[1.25rem] border border-dashed border-border/70 bg-white text-sm text-muted-foreground">ارفع صورة أو PDF لبدء التعديل.</div>}
              </div>
              <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{activeEditTextLayer ? `النص المحدد على الصفحة ${activeEditTextLayer.pageNumber}` : `عدد النصوص المضافة: ${editTextLayers.length}`}</p><Button type="button" className="rounded-xl" onClick={() => runTask(handleApplyDocumentEdits)} disabled={isPending}>تنزيل</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stamps" className="space-y-4">
          <div>
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setAssetDialogMode("manager"); setIsAssetPickerOpen(true) }}><Plus className="h-4 w-4" />إضافة ختم او توقيع</Button>
                  <div className="text-right">
                    <CardTitle>تطبيق الختم أو التوقيع</CardTitle>
                    <CardDescription>ارفع صورة أو ملف PDF، ثم اختر الأصل المحفوظ واضغط على مكان المعاينة لتحديد موضعه قبل التنزيل.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <Input type="file" accept="image/*,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void handleStampTargetChange(file) } }} />
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setAssetDialogMode("picker"); setIsAssetPickerOpen(true) }}><Plus className="h-4 w-4" />إضافة</Button>
                </div>
                {placedAssets.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] border border-border/60 bg-muted/10 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {placedAssets.map((placedAsset) => {
                        const asset = assetMap.get(placedAsset.assetId)
                        if (!asset) {
                          return null
                        }

                        return (
                          <button
                            key={placedAsset.id}
                            type="button"
                            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-right transition-colors ${activePlacedAssetId === placedAsset.id ? "border-primary bg-primary/5" : "border-border/60 bg-white hover:bg-muted/20"}`}
                            onClick={() => setActivePlacedAssetId(placedAsset.id)}
                          >
                            <img src={asset.imageUrl} alt={asset.name} className="h-8 w-8 rounded-full bg-white object-contain" />
                            <span className="text-sm font-medium text-foreground">{asset.name}</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {activePlacedAsset ? (
                        <div className="flex min-w-[220px] items-center gap-3 rounded-full border border-border/60 bg-white px-3 py-2">
                          <span className="text-xs font-medium text-muted-foreground">الحجم</span>
                          <Input type="range" min={8} max={60} step={1} value={activePlacedAsset.scalePercent} onChange={(event) => setActivePlacedAssetScale(Number(event.target.value) || activePlacedAsset.scalePercent)} className="h-2 border-0 bg-transparent p-0" />
                          <span className="w-10 text-left text-xs font-semibold text-foreground">{activePlacedAsset.scalePercent}%</span>
                        </div>
                      ) : null}
                      <div className="flex items-center gap-2">
                      <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => activePlacedAssetId ? removePlacedAsset(activePlacedAssetId) : null} disabled={!activePlacedAssetId}><Trash2 className="h-4 w-4" />حذف المحدد</Button>
                      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => resizeStamp(-2)} aria-label="تصغير الأصل">-</Button>
                      <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => resizeStamp(2)} aria-label="تكبير الأصل">+</Button>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="rounded-[1.25rem] border border-border/60 bg-muted/10 p-4">
                  {isPreparingStampPreview ? <div className="flex h-[420px] items-center justify-center"><LoaderCircle className="h-5 w-5 animate-spin text-primary" /></div> : stampPreviewPages.length > 0 ? (
                    <div className="space-y-5">
                      {stampPreviewPages.map((page) => (
                        <div
                          key={page.pageNumber}
                          className={`relative mx-auto max-w-3xl overflow-hidden rounded-[1.25rem] border bg-white ${(activePlacedAsset?.pageNumber === page.pageNumber) ? "border-primary/50 shadow-[0_20px_45px_rgba(15,23,42,0.12)]" : "border-white"}`}
                        >
                          <div
                            className="relative block w-full touch-none"
                            onPointerDown={(event) => {
                              if (!activePlacedAssetId) {
                                return
                              }

                              const target = event.target
                              if (target instanceof HTMLElement && target.closest("[data-placed-asset='true']")) {
                                return
                              }

                              event.preventDefault()
                              setDraggingPlacedAssetId(activePlacedAssetId)
                              stampDragOffsetRef.current = { xPercent: 0, yPercent: 0 }
                              stampDragMetaRef.current = { pageNumber: page.pageNumber, surfaceElement: event.currentTarget }
                              const nextPosition = updateStampPositionFromPointer(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY)
                              queuePlacedAssetUpdate(activePlacedAssetId, page.pageNumber, nextPosition)
                              event.currentTarget.setPointerCapture(event.pointerId)
                            }}
                            onPointerMove={(event) => {
                              if (!draggingPlacedAssetId) {
                                return
                              }

                              const nextPosition = updateStampPositionFromPointer(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY, stampDragOffsetRef.current)
                              queuePlacedAssetUpdate(draggingPlacedAssetId, page.pageNumber, nextPosition)
                            }}
                            onPointerUp={stopPlacedAssetDragging}
                            onPointerCancel={stopPlacedAssetDragging}
                          >
                            <img src={page.dataUrl} alt={`Preview ${page.pageNumber}`} className="w-full object-contain" draggable={false} onDragStart={(event) => event.preventDefault()} />
                            {placedAssets.filter((placedAsset) => placedAsset.pageNumber === page.pageNumber).map((placedAsset) => {
                              const asset = assetMap.get(placedAsset.assetId)
                              if (!asset) {
                                return null
                              }

                              return (
                                <button
                                  key={placedAsset.id}
                                  type="button"
                                  data-placed-asset="true"
                                  ref={(element) => {
                                    placedAssetElementRefs.current[placedAsset.id] = element
                                  }}
                                  className={`absolute select-none opacity-85 ${draggingPlacedAssetId === placedAsset.id ? "cursor-grabbing transition-none" : "cursor-grab transition-shadow"} ${activePlacedAssetId === placedAsset.id ? "drop-shadow-[0_14px_28px_rgba(15,23,42,0.28)]" : "drop-shadow-[0_10px_22px_rgba(15,23,42,0.22)]"}`}
                                  style={{
                                    width: `${placedAsset.scalePercent}%`,
                                    left: `${placedAsset.xPercent}%`,
                                    top: `${placedAsset.yPercent}%`,
                                    transform: "translate(-50%, -50%)",
                                    touchAction: "none",
                                    willChange: draggingPlacedAssetId === placedAsset.id ? "left, top" : undefined,
                                  }}
                                  onPointerDown={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    setActivePlacedAssetId(placedAsset.id)
                                    setDraggingPlacedAssetId(placedAsset.id)
                                    event.currentTarget.style.willChange = "left, top"
                                    const surfaceElement = event.currentTarget.parentElement instanceof HTMLDivElement ? event.currentTarget.parentElement : null
                                    const rect = surfaceElement?.getBoundingClientRect()
                                    stampDragMetaRef.current = { pageNumber: page.pageNumber, surfaceElement }
                                    if (rect) {
                                      const pointerPosition = updateStampPositionFromPointer(rect, event.clientX, event.clientY)
                                      stampDragOffsetRef.current = {
                                        xPercent: pointerPosition.xPercent - placedAsset.xPercent,
                                        yPercent: pointerPosition.yPercent - placedAsset.yPercent,
                                      }
                                    }
                                    event.currentTarget.setPointerCapture(event.pointerId)
                                  }}
                                  onPointerUp={(event) => {
                                    event.stopPropagation()
                                    stopPlacedAssetDragging()
                                  }}
                                  onPointerCancel={(event) => {
                                    event.stopPropagation()
                                    stopPlacedAssetDragging()
                                  }}
                                  onDragStart={(event) => event.preventDefault()}
                                >
                                  <img src={asset.imageUrl} alt={asset.name} className={`w-full object-contain ${activePlacedAssetId === placedAsset.id ? "ring-2 ring-primary/50" : ""}`} draggable={false} onDragStart={(event) => event.preventDefault()} />
                                </button>
                              )
                            })}
                          </div>
                          {isPdfFile(stampTargetFile) ? <Badge className="absolute left-4 top-4 rounded-full">الصفحة {page.pageNumber}</Badge> : null}
                        </div>
                      ))}
                    </div>
                  ) : <div className="flex h-[420px] items-center justify-center rounded-[1.25rem] border border-dashed border-border/70 bg-white text-sm text-muted-foreground">ارفع ملفًا ثم اضغط داخل المعاينة لتحديد مكان الختم.</div>}
                </div>
                <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{activePlacedAsset ? `المحدد: X ${activePlacedAsset.xPercent.toFixed(1)}% • Y ${activePlacedAsset.yPercent.toFixed(1)}%${isPdfFile(stampTargetFile) ? ` • الصفحة ${activePlacedAsset.pageNumber}` : ""}` : `عدد العناصر المضافة: ${placedAssets.length}`}</p><Button type="button" className="rounded-xl" onClick={() => runTask(handleApplyStamp)} disabled={isPending}><Stamp className="h-4 w-4" />تنزيل الملف</Button></div>
              </CardContent>
            </Card>
          </div>

          <Dialog open={isAssetPickerOpen} onOpenChange={setIsAssetPickerOpen}>
            <DialogContent className="max-w-3xl rounded-[1.75rem] p-0 text-right">
              <div className="p-6">
                <DialogHeader className="text-right">
                  <DialogTitle>{assetDialogMode === "manager" ? "مكتبة الأختام والتواقيع" : "اختر توقيعًا"}</DialogTitle>
                </DialogHeader>
                <div className="mt-5 space-y-5">
                  {assetDialogMode === "manager" ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 text-right md:order-1"><Label className="block text-right">النوع</Label><Select value={assetKind} onValueChange={(value) => setAssetKind(value as ServiceAssetKind)}><SelectTrigger className="w-full flex-row-reverse text-right [&>span]:text-right"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stamp">ختم</SelectItem><SelectItem value="signature">توقيع</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2 text-right md:order-2"><Label className="block text-right">اسم الأصل</Label><Input className="text-right" value={assetName} onChange={(event) => setAssetName(event.target.value)} /></div>
                      </div>

                      <div className="space-y-3 rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 p-4">
                        <Input className="text-right file:text-right" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void uploadAssetFile(file) } }} />
                        {assetImageUrl ? <p className="text-sm text-muted-foreground">تم اختيار الملف وجاهز للحفظ.</p> : null}
                        <div className="flex justify-end">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => runTask(handleCreateAsset)} disabled={isPending || isUploadingAsset}>{isUploadingAsset ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}حفظ</Button>
                        </div>
                      </div>
                    </>
                  ) : null}

                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">{assetDialogMode === "manager" ? "العناصر المحفوظة متاحة للحذف فقط من هذه النافذة." : "اضغط على العنصر لإضافته للمعاينة"}</p>
                    {(assetDialogMode === "manager" ? data.assets.length === 0 : signatureAssets.length === 0) ? <p className="text-sm text-muted-foreground">لا توجد عناصر محفوظة بعد.</p> : assetDialogMode === "manager" ? <div className="space-y-3">
                      {data.assets.map((asset) => (
                        <div key={asset.id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/60 bg-white px-4 py-3">
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{asset.name}</p>
                            <p className="text-sm text-muted-foreground">{asset.kind === "stamp" ? "ختم" : "توقيع"}</p>
                          </div>
                          <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => runTask(() => handleDeleteAsset(asset.id))}><Trash2 className="h-4 w-4" />حذف</Button>
                        </div>
                      ))}
                    </div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {signatureAssets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          className="rounded-[1.25rem] border border-border/60 p-4 text-right transition-colors hover:bg-muted/20"
                          onClick={() => {
                            const newPlacedAsset = createPlacedAsset(asset.id, 1)
                            setPlacedAssets((current) => [...current, newPlacedAsset])
                            setActivePlacedAssetId(newPlacedAsset.id)
                            setIsAssetPickerOpen(false)
                          }}
                        >
                          <div className="flex flex-col items-center gap-3 text-center">
                            <img src={asset.imageUrl} alt={asset.name} className="h-24 w-24 rounded-2xl bg-white object-contain" />
                            <p className="font-semibold text-foreground">{asset.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="writer" className="space-y-4">
          <div className="flex items-center justify-start">
            <Button type="button" className="rounded-xl" onClick={() => setIsWriterTemplateManagerOpen(true)}><Plus className="h-4 w-4" />إضافة قالب</Button>
          </div>

          <Dialog
            open={isWriterTemplateManagerOpen}
            onOpenChange={(open) => {
              setIsWriterTemplateManagerOpen(open)
              if (!open) {
                resetWriterTemplateDraft()
              }
            }}
          >
            <DialogContent className="max-w-3xl rounded-[1.75rem] p-0 text-right">
              <div className="p-6">
                <DialogHeader className="text-right">
                  <DialogTitle>إدارة قوالب الوورد</DialogTitle>
                </DialogHeader>

                <div className="mt-5 space-y-5">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">القوالب الحالية</p>
                    {data.templates.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد قوالب محفوظة بعد.</p> : <div className="space-y-3">
                      {data.templates.map((template) => (
                        <div key={template.id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/60 bg-white px-4 py-3">
                          <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => runTask(() => handleDeleteTemplate(template.id))}><Trash2 className="h-4 w-4" />حذف</Button>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{template.title}</p>
                            <p className="text-sm text-muted-foreground">قالب محفوظ</p>
                          </div>
                        </div>
                      ))}
                    </div>}
                  </div>

                  <div className="space-y-4 rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 p-4">
                    <div className="space-y-2 text-right">
                      <Label className="block text-right">اسم القالب</Label>
                      <Input className="text-right" value={writerTemplateDraftTitle} onChange={(event) => setWriterTemplateDraftTitle(event.target.value)} placeholder="اسم القالب" />
                    </div>
                    <div className="space-y-2 text-right">
                      <Label className="block text-right">ملف القالب</Label>
                      <Input
                        className="text-right file:text-right"
                        type="file"
                        accept="image/*,application/pdf,.doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null
                          setWriterTemplateDraftFile(file)
                          if (file && !writerTemplateDraftTitle.trim()) {
                            setWriterTemplateDraftTitle(file.name.replace(/\.[^.]+$/, ""))
                          }
                        }}
                      />
                    </div>
                    {writerTemplateDraftFile ? <p className="text-sm text-muted-foreground">الملف المحدد: {writerTemplateDraftFile.name}</p> : null}
                    <div className="flex justify-end">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => runTask(handleCreateWriterTemplateFromDialog)} disabled={isPending || isPreparingWriterBackground}>{isPreparingWriterBackground ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}حفظ القالب</Button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="space-y-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
              <Input value={writerTemplateTitle} onChange={(event) => setWriterTemplateTitle(event.target.value)} placeholder="عنوان القالب" />
              <Select
                value={selectedWriterTemplateId}
                onValueChange={(value) => {
                  if (value === "new") {
                    resetWriterTemplateEditor()
                    return
                  }

                  const template = data.templates.find((item) => item.id === value)
                  if (template) {
                    loadWriterTemplate(template)
                  }
                }}
              >
                <SelectTrigger className="w-full rounded-xl text-right [&>span]:text-right">
                  <SelectValue placeholder="اختيار قالب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">اختيار قالب</SelectItem>
                  {data.templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>{template.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" className="rounded-xl" onClick={addWriterTextLayer} disabled={!writerBackgroundValue || isPreparingWriterBackground}><Plus className="h-4 w-4" />إضافة نص</Button>
            </div>

            {activeWriterTextLayer ? (
              <div className="grid gap-4 rounded-[1.25rem] border border-border/60 bg-muted/10 p-4 md:grid-cols-2 xl:grid-cols-[1.4fr,0.7fr,0.7fr,auto]">
                <div className="space-y-2 md:col-span-2 xl:col-span-1"><Label>النص</Label><Textarea rows={3} value={activeWriterTextLayer.text} onChange={(event) => updateWriterTextLayer(activeWriterTextLayer.id, { text: event.target.value })} /></div>
                <div className="space-y-2"><Label>حجم الخط</Label><Input type="number" min={8} value={activeWriterTextLayer.fontSize} onChange={(event) => updateWriterTextLayer(activeWriterTextLayer.id, { fontSize: Number(event.target.value) || 16 })} /></div>
                <div className="space-y-2"><Label>لون الخط</Label><Input type="color" value={activeWriterTextLayer.color} onChange={(event) => updateWriterTextLayer(activeWriterTextLayer.id, { color: event.target.value })} /></div>
                <div className="flex items-end"><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeWriterTextLayer(activeWriterTextLayer.id)}><Trash2 className="h-4 w-4" />حذف النص</Button></div>
              </div>
            ) : null}

            <div className="rounded-[1.25rem] border border-border/60 bg-muted/10 p-4">
              {isPreparingWriterBackground ? <div className="flex h-[520px] items-center justify-center"><LoaderCircle className="h-5 w-5 animate-spin text-primary" /></div> : writerBackgroundValue ? (
                <div className="mx-auto max-w-4xl overflow-hidden rounded-[1.25rem] border border-white bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                  <div
                    className="relative min-h-[720px] w-full overflow-hidden bg-white"
                    onPointerMove={(event) => {
                      if (!draggingWriterTextLayerId) {
                        return
                      }

                      const nextPosition = getWriterLayerPosition(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY)
                      updateWriterTextLayer(draggingWriterTextLayerId, nextPosition)
                    }}
                    onPointerUp={() => setDraggingWriterTextLayerId(null)}
                    onPointerCancel={() => setDraggingWriterTextLayerId(null)}
                  >
                    {writerBackgroundKind === "image" ? (
                      <img src={writerBackgroundValue} alt="Template background" className="w-full object-contain" />
                    ) : (
                      <div className="pointer-events-none min-h-[720px] p-10" dangerouslySetInnerHTML={{ __html: writerBackgroundValue }} />
                    )}

                    {writerTextLayers.map((layer) => (
                      <button
                        key={layer.id}
                        type="button"
                        className={`absolute min-w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-dashed px-3 py-2 text-right shadow-sm ${activeWriterTextLayerId === layer.id ? "border-primary bg-white/95" : "border-slate-300/80 bg-white/85"}`}
                        style={{
                          left: `${layer.xPercent}%`,
                          top: `${layer.yPercent}%`,
                          color: layer.color,
                          fontSize: `${layer.fontSize}px`,
                          lineHeight: 1.35,
                        }}
                        onPointerDown={(event) => {
                          event.stopPropagation()
                          setActiveWriterTextLayerId(layer.id)
                          setDraggingWriterTextLayerId(layer.id)
                          event.currentTarget.setPointerCapture(event.pointerId)
                        }}
                        onPointerUp={(event) => {
                          event.stopPropagation()
                          setDraggingWriterTextLayerId(null)
                        }}
                      >
                        {layer.text || "نص جديد"}
                      </button>
                    ))}
                  </div>
                </div>
              ) : <div className="flex h-[520px] items-center justify-center rounded-[1.25rem] border border-dashed border-border/70 bg-white text-sm text-muted-foreground">ارفع صورة أو صفحة PDF أو ملف Word بصيغة DOCX ليكون خلفية للقالب.</div>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{activeWriterTextLayer ? `النص المحدد: ${activeWriterTextLayer.text || "نص جديد"}` : `عدد النصوص المضافة: ${writerTextLayers.length}`}</p>
              <div className="flex flex-wrap gap-2">
                {selectedWriterTemplate ? <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => runTask(() => handleDeleteTemplate(selectedWriterTemplate.id))}><Trash2 className="h-4 w-4" />حذف القالب</Button> : null}
                <Button type="button" variant="outline" className="rounded-xl" onClick={exportTemplateAsWord}>تنزيل</Button>
                <Button type="button" className="rounded-xl" onClick={() => runTask(handleSaveTemplate)} disabled={isPending}><Save className="h-4 w-4" />حفظ القالب</Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
