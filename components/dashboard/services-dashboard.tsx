"use client"

import { Download, FileImage, FilePenLine, FileText, LoaderCircle, Plus, Save, Stamp, Trash2, Upload, X } from "lucide-react"
import { degrees, PDFDocument, StandardFonts, rgb } from "pdf-lib"
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
  rotationDegrees: number
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

function normalizeRotationDegrees(value: number) {
  return ((value % 360) + 360) % 360
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

function getFileExtension(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase()
  const lastDotIndex = normalizedName.lastIndexOf(".")

  if (lastDotIndex === -1) {
    return ""
  }

  return normalizedName.slice(lastDotIndex + 1)
}

function isPdfFile(file: File) {
  return file.type === "application/pdf" || getFileExtension(file.name) === "pdf"
}

function isImageFile(file: File) {
  if (file.type.startsWith("image/")) {
    return true
  }

  const extension = getFileExtension(file.name)
  return extension === "png" || extension === "jpg" || extension === "jpeg" || extension === "webp" || extension === "gif" || extension === "svg" || extension === "bmp" || extension === "avif"
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
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`
  }
  return pdfjs
}

async function embedAssetImageForPdf(pdf: PDFDocument, imageUrl: string) {
  const response = await fetch(imageUrl)
  if (!response.ok) {
    throw new Error("تعذر تحميل صورة الختم أو التوقيع")
  }

  const blob = await response.blob()
  const bytes = await blob.arrayBuffer()

  if (blob.type === "image/png") {
    return pdf.embedPng(bytes)
  }

  if (blob.type === "image/jpeg") {
    return pdf.embedJpg(bytes)
  }

  const image = await loadImage(URL.createObjectURL(blob))
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("تعذر تجهيز صورة الختم أو التوقيع")
  }

  canvas.width = image.width
  canvas.height = image.height
  context.drawImage(image, 0, 0)

  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (!nextBlob) {
        reject(new Error("تعذر تحويل صورة الختم أو التوقيع"))
        return
      }

      resolve(nextBlob)
    }, "image/png")
  })

  return pdf.embedPng(await pngBlob.arrayBuffer())
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
  const writerTemplateFileInputRef = useRef<HTMLInputElement>(null)

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
  const [isAssetLibraryOpen, setIsAssetLibraryOpen] = useState(false)
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false)
  const [assetPickerMode, setAssetPickerMode] = useState<"add" | "saved">("add")
  const [selectedPickerAssetId, setSelectedPickerAssetId] = useState<string | null>(null)
  const [selectedPickerPageNumber, setSelectedPickerPageNumber] = useState<number>(1)
  const [isPreparingStampPreview, setIsPreparingStampPreview] = useState(false)
  const [draggingPlacedAssetId, setDraggingPlacedAssetId] = useState<string | null>(null)
  const [resizingPlacedAssetId, setResizingPlacedAssetId] = useState<string | null>(null)
  const [rotatingPlacedAssetId, setRotatingPlacedAssetId] = useState<string | null>(null)

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

  useEffect(() => {
    if (!isAssetPickerOpen || assetPickerMode !== "add") {
      return
    }

    setSelectedPickerAssetId((current) => current ?? data?.assets[0]?.id ?? null)
    setSelectedPickerPageNumber((current) => {
      const firstPageNumber = stampPreviewPages[0]?.pageNumber ?? 1
      return stampPreviewPages.some((page) => page.pageNumber === current) ? current : firstPageNumber
    })
  }, [assetPickerMode, data?.assets, isAssetPickerOpen, stampPreviewPages])

  const editTargetIsPdf = editTargetFile ? isPdfFile(editTargetFile) : false
  const stampTargetIsPdf = stampTargetFile ? isPdfFile(stampTargetFile) : false

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
    setMessage(null)

    if (!isImageFile(file)) {
      setAssetImageUrl("")
      setMessage({ type: "error", text: "ملف الختم أو التوقيع يجب أن يكون صورة" })
      return
    }

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
    } catch (error) {
      setAssetImageUrl("")
      setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر رفع الصورة" })
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

  async function prepareWriterBackground(file: File) {
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
        setWriterBackgroundKind("image")
        setWriterBackgroundValue(canvas.toDataURL("image/png"))
      } finally {
        setIsPreparingWriterBackground(false)
      }

      return
    }

    if (file.name.toLowerCase().endsWith(".docx")) {
      setIsPreparingWriterBackground(true)
      try {
        const mammoth = await import("mammoth/mammoth.browser")
        const bytes = await readFileAsArrayBuffer(file)
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes })
        setWriterBackgroundKind("html")
        setWriterBackgroundValue(result.value)
      } finally {
        setIsPreparingWriterBackground(false)
      }

      return
    }

    if (file.name.toLowerCase().endsWith(".doc")) {
      throw new Error("صيغة DOC القديمة غير مدعومة حاليًا، استخدم DOCX أو PDF أو صورة")
    }

    setWriterBackgroundKind("image")
    setWriterBackgroundValue(await readFileAsDataUrl(file))
  }

  async function handleWriterBackgroundChange(file: File) {
    await prepareWriterBackground(file)
    setWriterTextLayers([])
    setActiveWriterTextLayerId(null)
    setWriterTemplateTitle((current) => current.trim() ? current : file.name.replace(/\.[^.]+$/, ""))
  }

  function openWriterTemplatePicker(resetEditor: boolean) {
    if (resetEditor) {
      resetWriterTemplateEditor()
    }

    writerTemplateFileInputRef.current?.click()
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
      rotationDegrees: 0,
    }
  }

  function updatePlacedAsset(id: string, updates: Partial<PlacedAsset>) {
    setPlacedAssets((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item))
  }

  function removePlacedAsset(id: string) {
    setPlacedAssets((current) => current.filter((item) => item.id !== id))
    setActivePlacedAssetId((current) => current === id ? null : current)
  }

  function handleAddAssetToSelectedPage() {
    if (!selectedPickerAssetId) {
      setMessage({ type: "error", text: "اختر ختمًا أو توقيعًا أولًا" })
      return
    }

    const newPlacedAsset = createPlacedAsset(selectedPickerAssetId, selectedPickerPageNumber)
    setPlacedAssets((current) => [...current, newPlacedAsset])
    setActivePlacedAssetId(newPlacedAsset.id)
    setIsAssetPickerOpen(false)
  }

  async function handleSaveTemplate() {
    if (!writerTemplateTitle.trim()) {
      throw new Error("أدخل عنوانًا للقالب أولًا")
    }

    if (!writerBackgroundValue.trim()) {
      throw new Error("ارفع ملف القالب أولًا")
    }

    const contentHtml = serializeWriterTemplateConfig({
      version: 1,
      backgroundKind: writerBackgroundKind,
      backgroundValue: writerBackgroundValue,
      textLayers: writerTextLayers,
    })

    const isNew = selectedWriterTemplateId === "new"
    const response = await fetch("/api/admin/services", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "template",
        ...(isNew ? null : { id: selectedWriterTemplateId }),
        title: writerTemplateTitle,
        description: "",
        contentHtml,
      }),
    })

    const payload = await response.json() as ServicesDashboardData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حفظ القالب")
    }

    setData(payload)
    const latestTemplate = payload.templates.find((template) => template.title === writerTemplateTitle) ?? payload.templates[0]
    if (latestTemplate) {
      loadWriterTemplate(latestTemplate)
    }
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

  async function handlePdfToImages() {
    if (!pdfToImagesFile) {
      throw new Error("ارفع ملف PDF أولًا")
    }

    setIsConvertingPdfPages(true)
    try {
      const pdfjs = await loadPdfJs()
      const bytes = await readFileAsArrayBuffer(pdfToImagesFile)
      const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise
      const nextPages: PdfImagePage[] = []

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber)
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")

        if (!context) {
          throw new Error("تعذر تجهيز الرسم للصفحة")
        }

        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: context, viewport }).promise
        nextPages.push({ pageNumber, dataUrl: canvas.toDataURL("image/png") })
      }

      setPdfImagePages(nextPages)

      for (const page of nextPages) {
        const blob = await fetch(page.dataUrl).then((response) => response.blob())
        downloadBlob(blob, `page-${page.pageNumber}.png`)
      }

      setMessage({ type: "success", text: `تم تنزيل ${nextPages.length} صورة من ملف PDF` })
    } finally {
      setIsConvertingPdfPages(false)
    }
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
    const pdfjs = await loadPdfJs()
    const bytes = await readFileAsArrayBuffer(file)
    const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise
    const outputPdf = await PDFDocument.create()

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 1.35 })
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      if (!context) {
        throw new Error("تعذر تجهيز صفحات PDF للضغط")
      }

      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: context, viewport }).promise

      const pageBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((nextBlob) => {
          if (!nextBlob) {
            reject(new Error("تعذر ضغط صفحة PDF"))
            return
          }

          resolve(nextBlob)
        }, "image/jpeg", 0.8)
      })

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

    const output = await outputPdf.save()
    downloadBlob(new Blob([output], { type: "application/pdf" }), `${file.name.replace(/\.pdf$/i, "")}-compressed.pdf`)
    setMessage({ type: "success", text: "تم ضغط ملف PDF وتنزيله" })
  }

  async function handleCompressFile() {
    if (!compressTargetFile) {
      throw new Error("ارفع صورة أو ملف PDF أولًا")
    }

    if (isPdfFile(compressTargetFile)) {
      await compressPdfFile(compressTargetFile)
      return
    }

    if (isImageFile(compressTargetFile)) {
      await compressImageFile(compressTargetFile)
      return
    }

    throw new Error("الملف المدعوم يجب أن يكون صورة أو PDF")
  }

  async function prepareEditPreview(file: File) {
    if (isPdfFile(file)) {
      setIsPreparingEditPreview(true)
      try {
        const pdfjs = await loadPdfJs()
        const bytes = await readFileAsArrayBuffer(file)
        const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise
        const nextPages: PdfImagePage[] = []

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber)
          const viewport = page.getViewport({ scale: 1.3 })
          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d")

          if (!context) {
            throw new Error("تعذر تجهيز معاينة الملف")
          }

          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: context, viewport }).promise
          nextPages.push({ pageNumber, dataUrl: canvas.toDataURL("image/png") })
        }

        setEditPreviewPages(nextPages)
      } finally {
        setIsPreparingEditPreview(false)
      }

      return
    }

    if (!isImageFile(file)) {
      throw new Error("الملف المدعوم يجب أن يكون صورة أو PDF")
    }

    setEditPreviewPages([{ pageNumber: 1, dataUrl: await readFileAsDataUrl(file) }])
  }

  async function handleEditTargetChange(file: File) {
    setMessage(null)

    try {
      setEditTargetFile(file)
      setEditTextLayers([])
      setActiveEditTextLayerId(null)
      await prepareEditPreview(file)
    } catch (error) {
      setEditTargetFile(null)
      setEditPreviewPages([])
      setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر تجهيز الملف" })
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

    if (editTargetIsPdf) {
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
        const pdfjs = await loadPdfJs()
        const bytes = await readFileAsArrayBuffer(file)
        const pdf = await pdfjs.getDocument({ data: bytes, disableWorker: true }).promise
        const nextPages: PdfImagePage[] = []

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber)
          const viewport = page.getViewport({ scale: 1.25 })
          const canvas = document.createElement("canvas")
          const context = canvas.getContext("2d")

          if (!context) {
            throw new Error("تعذر تجهيز معاينة PDF")
          }

          canvas.width = viewport.width
          canvas.height = viewport.height
          await page.render({ canvasContext: context, viewport }).promise
          nextPages.push({ pageNumber, dataUrl: canvas.toDataURL("image/png") })
        }

        setStampPreviewPages(nextPages)
      } finally {
        setIsPreparingStampPreview(false)
      }

      return
    }

    if (!isImageFile(file)) {
      throw new Error("الملف المدعوم يجب أن يكون صورة أو PDF")
    }

    setStampPreviewPages([{ pageNumber: 1, dataUrl: await readFileAsDataUrl(file) }])
  }

  async function handleStampTargetChange(file: File) {
    setMessage(null)

    try {
      setStampTargetFile(file)
      setPlacedAssets([])
      setActivePlacedAssetId(null)
      await prepareStampPreview(file)
    } catch (error) {
      setStampTargetFile(null)
      setStampPreviewPages([])
      setPlacedAssets([])
      setActivePlacedAssetId(null)
      setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر تجهيز الملف" })
    }
  }

  function updateStampPositionFromPointer(rect: DOMRect, clientX: number, clientY: number) {
    const xPercent = ((clientX - rect.left) / rect.width) * 100
    const yPercent = ((clientY - rect.top) / rect.height) * 100
    return { xPercent: clamp(xPercent, 0, 100), yPercent: clamp(yPercent, 0, 100) }
  }

  function getRotationDegreesFromPointer(rect: DOMRect, clientX: number, clientY: number) {
    const centerX = rect.left + (rect.width / 2)
    const centerY = rect.top + (rect.height / 2)
    const angle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI + 90
    return normalizeRotationDegrees(angle)
  }

  function isPointerNearAssetEdge(rect: DOMRect, clientX: number, clientY: number) {
    const edgeThreshold = 14
    const horizontalDistance = Math.min(Math.abs(clientX - rect.left), Math.abs(clientX - rect.right))
    const verticalDistance = Math.min(Math.abs(clientY - rect.top), Math.abs(clientY - rect.bottom))
    return Math.min(horizontalDistance, verticalDistance) <= edgeThreshold
  }

  function getScalePercentFromPointer(previewRect: DOMRect, placedAsset: PlacedAsset, clientX: number) {
    const centerX = previewRect.left + ((placedAsset.xPercent / 100) * previewRect.width)
    const halfWidth = Math.max(Math.abs(clientX - centerX), 18)
    return clamp(((halfWidth * 2) / previewRect.width) * 100, 8, 60)
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
        const embeddedAsset = await embedAssetImageForPdf(pdf, asset.imageUrl)
        const stampWidth = page.getWidth() * (placedAsset.scalePercent / 100)
        const scaledHeight = (stampWidth / assetImage.width) * assetImage.height
        const centerX = (placedAsset.xPercent / 100) * page.getWidth()
        const centerY = page.getHeight() - ((placedAsset.yPercent / 100) * page.getHeight())
        const rotationRadians = (placedAsset.rotationDegrees * Math.PI) / 180
        const rotatedCenterOffsetX = (stampWidth / 2) * Math.cos(rotationRadians) - (scaledHeight / 2) * Math.sin(rotationRadians)
        const rotatedCenterOffsetY = (stampWidth / 2) * Math.sin(rotationRadians) + (scaledHeight / 2) * Math.cos(rotationRadians)
        const x = centerX - rotatedCenterOffsetX
        const y = centerY - rotatedCenterOffsetY

        page.drawImage(embeddedAsset, {
          x,
          y,
          width: stampWidth,
          height: scaledHeight,
          rotate: degrees(placedAsset.rotationDegrees),
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
      const centerX = (placedAsset.xPercent / 100) * targetImage.width
      const centerY = (placedAsset.yPercent / 100) * targetImage.height

      context.save()
      context.translate(centerX, centerY)
      context.rotate((placedAsset.rotationDegrees * Math.PI) / 180)
      context.drawImage(assetImage, -(stampWidth / 2), -(stampHeight / 2), stampWidth, stampHeight)
      context.restore()
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
              {imageToPdfFiles.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {imageToPdfFiles.map((file) => <div key={`${file.name}-${file.size}`} className="rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-sm text-foreground">{file.name}</div>)}
                </div>
              ) : null}
              <div className="flex justify-end"><Button type="button" className="rounded-xl" onClick={() => runTask(handleImageToPdf)} disabled={isPending}><FileImage className="h-4 w-4" />تحويل وتنزيل PDF</Button></div>
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
                <Input type="file" accept="application/pdf" onChange={(event) => { setPdfToImagesFile(event.target.files?.[0] ?? null); setPdfImagePages([]) }} />
                <Button type="button" className="rounded-xl" onClick={() => runTask(handlePdfToImages)} disabled={isPending || isConvertingPdfPages}>{isConvertingPdfPages ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}تنزيل الصور</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pdfImagePages.map((page) => (
                  <div key={page.pageNumber} className="overflow-hidden rounded-[1.25rem] border border-border/60 bg-white">
                    <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="h-64 w-full object-contain bg-muted/10" />
                    <div className="flex items-center justify-between px-4 py-3">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => fetch(page.dataUrl).then((response) => response.blob()).then((blob) => downloadBlob(blob, `page-${page.pageNumber}.png`))}><Download className="h-4 w-4" />تنزيل</Button>
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
                <Button type="button" className="rounded-xl" onClick={() => runTask(handleCompressFile)} disabled={isPending}><Download className="h-4 w-4" />تنزيل الملف</Button>
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
                              className={`absolute min-w-[120px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-dashed px-3 py-2 text-right shadow-sm ${activeEditTextLayerId === layer.id ? "border-primary bg-white/95" : "border-slate-300/80 bg-white/85"}`}
                              style={{
                                left: `${layer.xPercent}%`,
                                top: `${layer.yPercent}%`,
                                color: layer.color,
                                fontSize: `${layer.fontSize}px`,
                                lineHeight: 1.35,
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
                              {layer.text || "نص جديد"}
                            </button>
                          ))}
                        </button>
                          {editTargetIsPdf ? <Badge className="absolute left-4 top-4 rounded-full">الصفحة {page.pageNumber}</Badge> : null}
                      </div>
                    ))}
                  </div>
                ) : <div className="flex h-[420px] items-center justify-center rounded-[1.25rem] border border-dashed border-border/70 bg-white text-sm text-muted-foreground">ارفع صورة أو PDF لبدء التعديل.</div>}
              </div>
              <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{activeEditTextLayer ? `النص المحدد على الصفحة ${activeEditTextLayer.pageNumber}` : `عدد النصوص المضافة: ${editTextLayers.length}`}</p><Button type="button" className="rounded-xl" onClick={() => runTask(handleApplyDocumentEdits)} disabled={isPending}><FilePenLine className="h-4 w-4" />تنزيل الملف</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stamps" className="space-y-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Button type="button" className="rounded-xl px-6" onClick={() => setIsAssetLibraryOpen(true)}>
                    <Upload className="h-4 w-4" />مكتبة الختم والتواقيع
                  </Button>
                  <div className="text-right">
                    <CardTitle>تطبيق الختم أو التوقيع</CardTitle>
                    <CardDescription className="mt-2">ارفع صورة أو ملف PDF، ثم اختر الأصل المحفوظ واضغط على مكان المعاينة لتحديد موضعه قبل التنزيل.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <Input type="file" accept="image/*,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void handleStampTargetChange(file) } }} />
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      setAssetPickerMode("add")
                      setIsAssetPickerOpen(true)
                    }}
                    disabled={stampPreviewPages.length === 0}
                  ><Plus className="h-4 w-4" />إضافة</Button>
                </div>
                {placedAssets.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-border/60 bg-muted/10 p-3">
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
                            <span
                              className="flex h-5 w-5 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-red-200 hover:text-red-600"
                              onClick={(event) => {
                                event.stopPropagation()
                                removePlacedAsset(placedAsset.id)
                              }}
                              aria-label={`حذف ${asset.name}`}
                              role="button"
                            >
                              <X className="h-3 w-3" />
                            </span>
                            <img src={asset.imageUrl} alt={asset.name} className="h-8 w-8 rounded-full bg-white object-contain" />
                            <span className="text-sm font-medium text-foreground">{asset.name}</span>
                          </button>
                        )
                      })}
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
                              if (!draggingPlacedAssetId) {
                                return
                              }

                              const nextPosition = updateStampPositionFromPointer(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY)
                              updatePlacedAsset(draggingPlacedAssetId, { ...nextPosition, pageNumber: page.pageNumber })
                              event.currentTarget.setPointerCapture(event.pointerId)
                            }}
                            onPointerMove={(event) => {
                              if (rotatingPlacedAssetId || resizingPlacedAssetId) {
                                return
                              }

                              if (!draggingPlacedAssetId) {
                                return
                              }

                              const nextPosition = updateStampPositionFromPointer(event.currentTarget.getBoundingClientRect(), event.clientX, event.clientY)
                              updatePlacedAsset(draggingPlacedAssetId, { ...nextPosition, pageNumber: page.pageNumber })
                            }}
                            onPointerUp={() => {
                              setDraggingPlacedAssetId(null)
                              setResizingPlacedAssetId(null)
                              setRotatingPlacedAssetId(null)
                            }}
                            onPointerCancel={() => {
                              setDraggingPlacedAssetId(null)
                              setResizingPlacedAssetId(null)
                              setRotatingPlacedAssetId(null)
                            }}
                          >
                            <img src={page.dataUrl} alt={`Preview ${page.pageNumber}`} className="w-full object-contain" />
                            {placedAssets.filter((placedAsset) => placedAsset.pageNumber === page.pageNumber).map((placedAsset) => {
                              const asset = assetMap.get(placedAsset.assetId)
                              if (!asset) {
                                return null
                              }

                              return (
                                <div
                                  key={placedAsset.id}
                                  className={`absolute overflow-visible border border-dashed opacity-85 transition-shadow ${activePlacedAssetId === placedAsset.id ? "border-primary/70 drop-shadow-[0_14px_28px_rgba(15,23,42,0.28)]" : "border-transparent drop-shadow-[0_10px_22px_rgba(15,23,42,0.22)]"}`}
                                  style={{
                                    width: `${placedAsset.scalePercent}%`,
                                    left: `${placedAsset.xPercent}%`,
                                    top: `${placedAsset.yPercent}%`,
                                    transform: `translate(-50%, -50%) rotate(${placedAsset.rotationDegrees}deg)`,
                                  }}
                                  onPointerDown={(event) => {
                                    event.stopPropagation()
                                    setActivePlacedAssetId(placedAsset.id)

                                    const assetRect = event.currentTarget.getBoundingClientRect()
                                    const previewRect = event.currentTarget.parentElement?.getBoundingClientRect()
                                    const shouldResize = isPointerNearAssetEdge(assetRect, event.clientX, event.clientY)

                                    if (shouldResize) {
                                      setResizingPlacedAssetId(placedAsset.id)
                                      setDraggingPlacedAssetId(null)

                                      if (previewRect) {
                                        updatePlacedAsset(placedAsset.id, {
                                          scalePercent: getScalePercentFromPointer(previewRect, placedAsset, event.clientX),
                                        })
                                      }
                                    } else {
                                      setDraggingPlacedAssetId(placedAsset.id)
                                      setResizingPlacedAssetId(null)

                                      if (previewRect) {
                                        updatePlacedAsset(placedAsset.id, {
                                          ...updateStampPositionFromPointer(previewRect, event.clientX, event.clientY),
                                          pageNumber: page.pageNumber,
                                        })
                                      }
                                    }

                                    event.currentTarget.setPointerCapture(event.pointerId)
                                  }}
                                  onPointerMove={(event) => {
                                    event.stopPropagation()

                                    const previewRect = event.currentTarget.parentElement?.getBoundingClientRect()
                                    if (!previewRect || rotatingPlacedAssetId === placedAsset.id) {
                                      return
                                    }

                                    if (resizingPlacedAssetId === placedAsset.id) {
                                      updatePlacedAsset(placedAsset.id, {
                                        scalePercent: getScalePercentFromPointer(previewRect, placedAsset, event.clientX),
                                      })
                                      return
                                    }

                                    if (draggingPlacedAssetId !== placedAsset.id) {
                                      return
                                    }

                                    updatePlacedAsset(placedAsset.id, {
                                      ...updateStampPositionFromPointer(previewRect, event.clientX, event.clientY),
                                      pageNumber: page.pageNumber,
                                    })
                                  }}
                                  onPointerUp={(event) => {
                                    event.stopPropagation()
                                    setDraggingPlacedAssetId(null)
                                    setResizingPlacedAssetId(null)
                                  }}
                                  onPointerCancel={(event) => {
                                    event.stopPropagation()
                                    setDraggingPlacedAssetId(null)
                                    setResizingPlacedAssetId(null)
                                  }}
                                >
                                  <img src={asset.imageUrl} alt={asset.name} className="block w-full object-contain" />
                                  <span
                                    className={`absolute left-1/2 top-0 flex h-5 w-5 -translate-x-1/2 -translate-y-[140%] items-center justify-center rounded-full border bg-white text-[10px] font-bold text-foreground shadow ${activePlacedAssetId === placedAsset.id ? "border-primary" : "border-border/60"}`}
                                    onPointerDown={(event) => {
                                      event.stopPropagation()
                                      setActivePlacedAssetId(placedAsset.id)
                                      setRotatingPlacedAssetId(placedAsset.id)
                                      const parentRect = event.currentTarget.parentElement?.getBoundingClientRect()
                                      if (parentRect) {
                                        updatePlacedAsset(placedAsset.id, {
                                          rotationDegrees: getRotationDegreesFromPointer(parentRect, event.clientX, event.clientY),
                                        })
                                      }
                                      event.currentTarget.setPointerCapture(event.pointerId)
                                    }}
                                    onPointerMove={(event) => {
                                      event.stopPropagation()
                                      if (rotatingPlacedAssetId !== placedAsset.id) {
                                        return
                                      }

                                      const parentRect = event.currentTarget.parentElement?.getBoundingClientRect()
                                      if (!parentRect) {
                                        return
                                      }

                                      updatePlacedAsset(placedAsset.id, {
                                        rotationDegrees: getRotationDegreesFromPointer(parentRect, event.clientX, event.clientY),
                                      })
                                    }}
                                    onPointerUp={(event) => {
                                      event.stopPropagation()
                                      setRotatingPlacedAssetId(null)
                                    }}
                                    onPointerCancel={(event) => {
                                      event.stopPropagation()
                                      setRotatingPlacedAssetId(null)
                                    }}
                                  >
                                    ↻
                                  </span>
                                  {activePlacedAssetId === placedAsset.id ? <span className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 rounded-full border border-primary bg-white shadow" /> : null}
                                </div>
                              )
                            })}
                          </div>
                          {stampTargetIsPdf ? <Badge className="absolute left-4 top-4 rounded-full">الصفحة {page.pageNumber}</Badge> : null}
                        </div>
                      ))}
                    </div>
                  ) : <div className="flex h-[420px] items-center justify-center rounded-[1.25rem] border border-dashed border-border/70 bg-white text-sm text-muted-foreground">ارفع ملفًا ثم اضغط داخل المعاينة لتحديد مكان الختم.</div>}
                </div>
                <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{activePlacedAsset ? `المحدد: X ${activePlacedAsset.xPercent.toFixed(1)}% • Y ${activePlacedAsset.yPercent.toFixed(1)}%${stampTargetIsPdf ? ` • الصفحة ${activePlacedAsset.pageNumber}` : ""}` : `عدد العناصر المضافة: ${placedAssets.length}`}</p><Button type="button" className="rounded-xl" onClick={() => runTask(handleApplyStamp)} disabled={isPending}><Stamp className="h-4 w-4" />تنزيل الملف</Button></div>
              </CardContent>
          </Card>

          <Dialog open={isAssetPickerOpen} onOpenChange={setIsAssetPickerOpen}>
            <DialogContent className="max-w-6xl rounded-[1.75rem] p-0 text-right">
              <div className="p-6">
                <DialogHeader className="text-right">
                  <DialogTitle>{assetPickerMode === "saved" ? "المحفوظات" : "اختر ختمًا أو توقيعًا"}</DialogTitle>
                </DialogHeader>
                {data.assets.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">لا توجد عناصر محفوظة بعد.</p> : <div className="mt-5 space-y-5">
                  <div>
                    <p className="mb-3 text-sm font-medium text-foreground">{assetPickerMode === "saved" ? "الأختام والتواقيع المحفوظة" : "1. اختر الختم أو التوقيع"}</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                      {data.assets.map((asset) => (
                        assetPickerMode === "saved" ? (
                          <div key={asset.id} className="rounded-[1rem] border border-border/60 p-2.5 text-right">
                            <div className="flex flex-col items-center gap-1.5 text-center">
                              <img src={asset.imageUrl} alt={asset.name} className="h-16 w-16 rounded-lg bg-white object-contain" />
                              <p className="text-xs font-semibold leading-5 text-foreground">{asset.name}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-auto rounded-xl px-3 py-1 text-red-600 hover:text-red-700"
                                onClick={() => runTask(() => handleDeleteAsset(asset.id))}
                              >
                                <Trash2 className="h-4 w-4" />حذف
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            key={asset.id}
                            type="button"
                            className={`rounded-[1rem] border p-2.5 text-right transition-colors ${selectedPickerAssetId === asset.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/20"}`}
                            onClick={() => setSelectedPickerAssetId(asset.id)}
                          >
                            <div className="flex flex-col items-center gap-1.5 text-center">
                              <img src={asset.imageUrl} alt={asset.name} className="h-16 w-16 rounded-lg bg-white object-contain" />
                              <p className="text-xs font-semibold leading-5 text-foreground">{asset.name}</p>
                            </div>
                          </button>
                        )
                      ))}
                    </div>
                  </div>

                  {assetPickerMode === "add" ? (
                    <>
                      <div>
                        <p className="mb-3 text-sm font-medium text-foreground">2. اختر الصفحة</p>
                        {stampPreviewPages.length > 0 ? (
                          <div className="grid max-h-[360px] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-5">
                            {stampPreviewPages.map((page) => (
                              <button
                                key={page.pageNumber}
                                type="button"
                                className={`overflow-hidden rounded-[1rem] border bg-white text-right transition-colors ${selectedPickerPageNumber === page.pageNumber ? "border-primary shadow-[0_16px_35px_rgba(15,23,42,0.12)]" : "border-border/60 hover:bg-muted/20"}`}
                                onClick={() => setSelectedPickerPageNumber(page.pageNumber)}
                              >
                                <img src={page.dataUrl} alt={`Page ${page.pageNumber}`} className="h-32 w-full object-contain bg-muted/10" />
                                <div className="px-3 py-2 text-sm font-medium text-foreground">الصفحة {page.pageNumber}</div>
                              </button>
                            ))}
                          </div>
                        ) : <p className="text-sm text-muted-foreground">ارفع ملف PDF أو صورة أولًا لعرض الصفحات.</p>}
                      </div>

                      <div className="flex justify-end">
                        <Button type="button" className="rounded-xl" onClick={handleAddAssetToSelectedPage} disabled={!selectedPickerAssetId || stampPreviewPages.length === 0}>
                          <Plus className="h-4 w-4" />إضافة إلى الصفحة المحددة
                        </Button>
                      </div>
                    </>
                  ) : null}
                </div>}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isAssetLibraryOpen} onOpenChange={setIsAssetLibraryOpen}>
            <DialogContent className="max-w-4xl rounded-[1.75rem] p-0 text-right">
              <div className="p-6">
                <DialogHeader className="text-right">
                  <DialogTitle>مكتبة الختم والتواقيع</DialogTitle>
                </DialogHeader>
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 text-right md:order-1"><Label className="block text-right">النوع</Label><Select value={assetKind} onValueChange={(value) => setAssetKind(value as ServiceAssetKind)}><SelectTrigger className="w-full flex-row-reverse text-right [&>span]:text-right"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stamp">ختم</SelectItem><SelectItem value="signature">توقيع</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2 text-right md:order-2"><Label className="block text-right">الاسم</Label><Input className="text-right" value={assetName} onChange={(event) => setAssetName(event.target.value)} /></div>
                  </div>
                  <div className="space-y-3 rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 p-4">
                    <Input className="text-right file:text-right" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void uploadAssetFile(file) } }} />
                    {assetImageUrl ? <img src={assetImageUrl} alt="Preview" className="h-40 w-full rounded-[1rem] object-contain bg-white" /> : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => runTask(handleCreateAsset)} disabled={isPending || isUploadingAsset}>{isUploadingAsset ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}حفظ</Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => {
                          setAssetPickerMode("saved")
                          setIsAssetPickerOpen(true)
                        }}
                      >عرض المحفوظات</Button>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="writer" className="space-y-4">
          <input
            ref={writerTemplateFileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleWriterBackgroundChange(file)
              }

              event.currentTarget.value = ""
            }}
          />

          <div className="flex items-center justify-start">
            <Button type="button" className="rounded-xl" onClick={() => openWriterTemplatePicker(true)}><Plus className="h-4 w-4" />إضافة قالب</Button>
          </div>

          {data.templates.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {data.templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => loadWriterTemplate(template)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${selectedWriterTemplateId === template.id ? "border-primary bg-primary/5 text-primary" : "border-border/60 bg-white hover:bg-muted/20"}`}
                >
                  {template.title}
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
              <Input value={writerTemplateTitle} onChange={(event) => setWriterTemplateTitle(event.target.value)} placeholder="عنوان القالب" />
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => openWriterTemplatePicker(false)}>{writerBackgroundValue ? "تغيير ملف القالب" : "اختيار ملف القالب"}</Button>
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
                <Button type="button" variant="outline" className="rounded-xl" onClick={exportTemplateAsWord}><FileText className="h-4 w-4" />تنزيل Word</Button>
                <Button type="button" className="rounded-xl" onClick={() => runTask(handleSaveTemplate)} disabled={isPending}><Save className="h-4 w-4" />حفظ القالب</Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
