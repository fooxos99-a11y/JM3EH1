"use client"

import { Download, FileImage, FilePenLine, FileText, LoaderCircle, PenSquare, Plus, Save, Stamp, Trash2, Upload } from "lucide-react"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

const defaultTemplateHtml = "<p style=\"font-size:16px;line-height:1.9;text-align:right;\">اكتب هنا محتوى القالب الجاهز، ويمكنك حفظه ثم العودة له وتعديل البيانات في أي وقت.</p>"

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
  anchor.click()
  URL.revokeObjectURL(url)
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

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("تعذر تحميل الصورة"))
    image.src = url
  })
}

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  return pdfjs
}

function applyEditorCommand(command: string, value?: string) {
  document.execCommand(command, false, value)
}

export function ServicesDashboard() {
  const [data, setData] = useState<ServicesDashboardData | null>(null)
  const [message, setMessage] = useState<MessageState>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  const [assetName, setAssetName] = useState("")
  const [assetKind, setAssetKind] = useState<ServiceAssetKind>("stamp")
  const [assetImageUrl, setAssetImageUrl] = useState("")
  const [isUploadingAsset, setIsUploadingAsset] = useState(false)

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("new")
  const [templateTitle, setTemplateTitle] = useState("")
  const [templateDescription, setTemplateDescription] = useState("")
  const [templateHtml, setTemplateHtml] = useState(defaultTemplateHtml)
  const editorRef = useRef<HTMLDivElement>(null)

  const [imageToPdfFiles, setImageToPdfFiles] = useState<File[]>([])
  const [pdfToImagesFile, setPdfToImagesFile] = useState<File | null>(null)
  const [pdfImagePages, setPdfImagePages] = useState<PdfImagePage[]>([])
  const [isConvertingPdfPages, setIsConvertingPdfPages] = useState(false)

  const [pdfEditFile, setPdfEditFile] = useState<File | null>(null)
  const [pdfEditText, setPdfEditText] = useState("")
  const [pdfEditPage, setPdfEditPage] = useState(1)
  const [pdfEditX, setPdfEditX] = useState(60)
  const [pdfEditY, setPdfEditY] = useState(120)
  const [pdfEditSize, setPdfEditSize] = useState(16)
  const [pdfEditColor, setPdfEditColor] = useState("#111827")

  const [stampTargetFile, setStampTargetFile] = useState<File | null>(null)
  const [stampTargetPreview, setStampTargetPreview] = useState<string>("")
  const [selectedAssetId, setSelectedAssetId] = useState<string>("")
  const [stampWidth, setStampWidth] = useState(140)
  const [stampPage, setStampPage] = useState(1)
  const [stampPosition, setStampPosition] = useState<StampPosition>({ xPercent: 50, yPercent: 50 })
  const [isPreparingStampPreview, setIsPreparingStampPreview] = useState(false)

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
    if (!editorRef.current) {
      return
    }

    if (editorRef.current.innerHTML !== templateHtml) {
      editorRef.current.innerHTML = templateHtml
    }
  }, [templateHtml])

  const assetStats = useMemo(() => ({
    total: data?.assets.length ?? 0,
    stamps: data?.assets.filter((asset) => asset.kind === "stamp").length ?? 0,
    signatures: data?.assets.filter((asset) => asset.kind === "signature").length ?? 0,
    templates: data?.templates.length ?? 0,
  }), [data])

  const selectedTemplate = useMemo(
    () => data?.templates.find((template) => template.id === selectedTemplateId) ?? null,
    [data, selectedTemplateId],
  )

  const selectedAsset = useMemo(
    () => data?.assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [data, selectedAssetId],
  )

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

  function resetTemplateEditor() {
    setSelectedTemplateId("new")
    setTemplateTitle("")
    setTemplateDescription("")
    setTemplateHtml(defaultTemplateHtml)
  }

  function loadTemplateIntoEditor(template: ServiceDocumentTemplate) {
    setSelectedTemplateId(template.id)
    setTemplateTitle(template.title)
    setTemplateDescription(template.description)
    setTemplateHtml(template.contentHtml || defaultTemplateHtml)
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
    if (selectedAssetId === id) {
      setSelectedAssetId("")
    }
    setMessage({ type: "success", text: "تم حذف الأصل من المكتبة" })
  }

  async function handleSaveTemplate() {
    const currentHtml = editorRef.current?.innerHTML?.trim() || templateHtml
    if (!templateTitle.trim()) {
      throw new Error("أدخل عنوانًا للقالب أولًا")
    }

    const isNew = selectedTemplateId === "new"
    const response = await fetch("/api/admin/services", {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "template",
        ...(isNew ? null : { id: selectedTemplateId }),
        title: templateTitle,
        description: templateDescription,
        contentHtml: currentHtml,
      }),
    })

    const payload = await response.json() as ServicesDashboardData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حفظ القالب")
    }

    setData(payload)
    const latestTemplate = payload.templates.find((template) => template.title === templateTitle) ?? payload.templates[0]
    if (latestTemplate) {
      loadTemplateIntoEditor(latestTemplate)
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
    if (selectedTemplateId === id) {
      resetTemplateEditor()
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
      const pdf = await pdfjs.getDocument({ data: bytes }).promise
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
      setMessage({ type: "success", text: `تم استخراج ${nextPages.length} صورة من ملف PDF` })
    } finally {
      setIsConvertingPdfPages(false)
    }
  }

  async function handlePdfTextEdit() {
    if (!pdfEditFile) {
      throw new Error("ارفع ملف PDF أولًا")
    }

    if (!pdfEditText.trim()) {
      throw new Error("أدخل النص المراد إضافته")
    }

    const bytes = await readFileAsArrayBuffer(pdfEditFile)
    const pdf = await PDFDocument.load(bytes)
    const pages = pdf.getPages()
    const pageIndex = clamp(pdfEditPage, 1, pages.length) - 1
    const page = pages[pageIndex]
    const font = await pdf.embedFont(StandardFonts.Helvetica)

    const red = Number.parseInt(pdfEditColor.slice(1, 3), 16) / 255
    const green = Number.parseInt(pdfEditColor.slice(3, 5), 16) / 255
    const blue = Number.parseInt(pdfEditColor.slice(5, 7), 16) / 255

    page.drawText(pdfEditText, {
      x: pdfEditX,
      y: page.getHeight() - pdfEditY,
      size: pdfEditSize,
      font,
      color: rgb(red, green, blue),
    })

    const output = await pdf.save()
    downloadBlob(new Blob([output], { type: "application/pdf" }), `edited-${pdfEditFile.name.replace(/\.pdf$/i, "")}.pdf`)
    setMessage({ type: "success", text: "تم تعديل ملف PDF وتنزيل النسخة الجديدة" })
  }

  async function prepareStampPreview(file: File) {
    if (file.type === "application/pdf") {
      setIsPreparingStampPreview(true)
      try {
        const pdfjs = await loadPdfJs()
        const bytes = await readFileAsArrayBuffer(file)
        const pdf = await pdfjs.getDocument({ data: bytes }).promise
        const page = await pdf.getPage(1)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")

        if (!context) {
          throw new Error("تعذر تجهيز معاينة PDF")
        }

        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({ canvasContext: context, viewport }).promise
        setStampTargetPreview(canvas.toDataURL("image/png"))
      } finally {
        setIsPreparingStampPreview(false)
      }

      return
    }

    setStampTargetPreview(await readFileAsDataUrl(file))
  }

  async function handleStampTargetChange(file: File) {
    setStampTargetFile(file)
    setStampPage(1)
    await prepareStampPreview(file)
  }

  async function handleApplyStamp() {
    if (!stampTargetFile) {
      throw new Error("ارفع الملف المستهدف أولًا")
    }

    if (!selectedAsset) {
      throw new Error("اختر ختمًا أو توقيعًا من المكتبة")
    }

    const assetImage = await loadImage(selectedAsset.imageUrl)

    if (stampTargetFile.type === "application/pdf") {
      const bytes = await readFileAsArrayBuffer(stampTargetFile)
      const pdf = await PDFDocument.load(bytes)
      const pages = pdf.getPages()
      const pageIndex = clamp(stampPage, 1, pages.length) - 1
      const page = pages[pageIndex]
      const assetBytes = await fetch(selectedAsset.imageUrl).then((response) => response.arrayBuffer())
      const embeddedAsset = selectedAsset.imageUrl.includes(".png") ? await pdf.embedPng(assetBytes) : await pdf.embedJpg(assetBytes)
      const scaledHeight = (stampWidth / assetImage.width) * assetImage.height
      const x = (stampPosition.xPercent / 100) * page.getWidth() - (stampWidth / 2)
      const y = page.getHeight() - ((stampPosition.yPercent / 100) * page.getHeight()) - (scaledHeight / 2)

      page.drawImage(embeddedAsset, {
        x: clamp(x, 0, Math.max(0, page.getWidth() - stampWidth)),
        y: clamp(y, 0, Math.max(0, page.getHeight() - scaledHeight)),
        width: stampWidth,
        height: scaledHeight,
      })

      const output = await pdf.save()
      downloadBlob(new Blob([output], { type: "application/pdf" }), `stamped-${stampTargetFile.name.replace(/\.pdf$/i, "")}.pdf`)
      setMessage({ type: "success", text: "تم تطبيق الختم أو التوقيع على ملف PDF" })
      return
    }

    const targetImage = await loadImage(stampTargetPreview)
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) {
      throw new Error("تعذر تجهيز الصورة النهائية")
    }

    canvas.width = targetImage.width
    canvas.height = targetImage.height
    context.drawImage(targetImage, 0, 0)
    const stampHeight = (stampWidth / assetImage.width) * assetImage.height
    const x = ((stampPosition.xPercent / 100) * targetImage.width) - (stampWidth / 2)
    const y = ((stampPosition.yPercent / 100) * targetImage.height) - (stampHeight / 2)
    context.drawImage(assetImage, clamp(x, 0, Math.max(0, targetImage.width - stampWidth)), clamp(y, 0, Math.max(0, targetImage.height - stampHeight)), stampWidth, stampHeight)

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
    const currentHtml = editorRef.current?.innerHTML?.trim() || templateHtml
    if (!templateTitle.trim()) {
      setMessage({ type: "error", text: "أدخل عنوان القالب قبل التصدير" })
      return
    }

    const documentHtml = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>${templateTitle}</title></head><body>${currentHtml}</body></html>`
    downloadBlob(new Blob([documentHtml], { type: "application/msword;charset=utf-8" }), `${templateTitle}.doc`)
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

  return (
    <section className="space-y-6 text-right">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <h1 className="text-2xl font-bold text-foreground">الخدمات</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          مركز داخلي لتحويل الصور وملفات PDF، إضافة النصوص والأختام والتواقيع على الملفات، وإنشاء قوالب كتابة دائمة يمكن تعديلها وتصديرها عند الحاجة.
        </p>
      </div>

      {message ? (
        <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          <AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">إجمالي الأصول المحفوظة</p><p className="mt-2 text-3xl font-bold text-foreground">{assetStats.total}</p></CardContent></Card>
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">الأختام</p><p className="mt-2 text-3xl font-bold text-foreground">{assetStats.stamps}</p></CardContent></Card>
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">التواقيع</p><p className="mt-2 text-3xl font-bold text-foreground">{assetStats.signatures}</p></CardContent></Card>
        <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">قوالب الكتابة</p><p className="mt-2 text-3xl font-bold text-foreground">{assetStats.templates}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="image_to_pdf" className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[1.5rem] bg-white/90 p-2">
          <TabsTrigger value="image_to_pdf" className="rounded-xl px-4 py-2">تحويل صورة إلى PDF</TabsTrigger>
          <TabsTrigger value="pdf_to_images" className="rounded-xl px-4 py-2">تحويل PDF إلى صور</TabsTrigger>
          <TabsTrigger value="pdf_editor" className="rounded-xl px-4 py-2">التعديل على PDF</TabsTrigger>
          <TabsTrigger value="stamps" className="rounded-xl px-4 py-2">الختم والتواقيع</TabsTrigger>
          <TabsTrigger value="writer" className="rounded-xl px-4 py-2">الكتابة على الوورد</TabsTrigger>
        </TabsList>

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
              <div className="flex justify-start"><Button type="button" className="rounded-xl" onClick={() => runTask(handleImageToPdf)} disabled={isPending}><FileImage className="h-4 w-4" />تحويل وتنزيل PDF</Button></div>
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
                <Button type="button" className="rounded-xl" onClick={() => runTask(handlePdfToImages)} disabled={isPending || isConvertingPdfPages}>{isConvertingPdfPages ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}استخراج الصور</Button>
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

        <TabsContent value="pdf_editor" className="space-y-4">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>التعديل على PDF</CardTitle>
              <CardDescription>تحرير سريع بإضافة نص مباشر إلى صفحة محددة داخل الملف مع التحكم بالمكان والحجم واللون.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input type="file" accept="application/pdf" onChange={(event) => setPdfEditFile(event.target.files?.[0] ?? null)} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="space-y-2"><Label>رقم الصفحة</Label><Input type="number" min={1} value={pdfEditPage} onChange={(event) => setPdfEditPage(Number(event.target.value) || 1)} /></div>
                <div className="space-y-2"><Label>X</Label><Input type="number" min={0} value={pdfEditX} onChange={(event) => setPdfEditX(Number(event.target.value) || 0)} /></div>
                <div className="space-y-2"><Label>Y</Label><Input type="number" min={0} value={pdfEditY} onChange={(event) => setPdfEditY(Number(event.target.value) || 0)} /></div>
                <div className="space-y-2"><Label>حجم الخط</Label><Input type="number" min={8} value={pdfEditSize} onChange={(event) => setPdfEditSize(Number(event.target.value) || 16)} /></div>
                <div className="space-y-2"><Label>لون الخط</Label><Input type="color" value={pdfEditColor} onChange={(event) => setPdfEditColor(event.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>النص</Label><Textarea rows={4} value={pdfEditText} onChange={(event) => setPdfEditText(event.target.value)} /></div>
              <div className="flex justify-start"><Button type="button" className="rounded-xl" onClick={() => runTask(handlePdfTextEdit)} disabled={isPending}><FilePenLine className="h-4 w-4" />تعديل الملف وتنزيله</Button></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stamps" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>مكتبة الأختام والتواقيع</CardTitle>
                <CardDescription>احفظ صور الأختام والتواقيع مرة واحدة لتبقى جاهزة للاستخدام على الصور وملفات PDF.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>اسم الأصل</Label><Input value={assetName} onChange={(event) => setAssetName(event.target.value)} /></div>
                  <div className="space-y-2"><Label>النوع</Label><Select value={assetKind} onValueChange={(value) => setAssetKind(value as ServiceAssetKind)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="stamp">ختم</SelectItem><SelectItem value="signature">توقيع</SelectItem></SelectContent></Select></div>
                </div>
                <div className="space-y-3 rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 p-4">
                  <Input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void uploadAssetFile(file) } }} />
                  {assetImageUrl ? <img src={assetImageUrl} alt="Preview" className="h-40 w-full rounded-[1rem] object-contain bg-white" /> : null}
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => runTask(handleCreateAsset)} disabled={isPending || isUploadingAsset}>{isUploadingAsset ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}حفظ في المكتبة</Button>
                </div>
                <div className="space-y-3">
                  {data.assets.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد أصول محفوظة بعد.</p> : data.assets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-border/60 bg-muted/10 p-3">
                      <div className="flex items-center gap-3">
                        <img src={asset.imageUrl} alt={asset.name} className="h-16 w-16 rounded-xl object-contain bg-white" />
                        <div className="text-right"><p className="font-semibold text-foreground">{asset.name}</p><p className="text-xs text-muted-foreground">{asset.kind === "stamp" ? "ختم" : "توقيع"} • {formatDateTime(asset.updatedAt)}</p></div>
                      </div>
                      <div className="flex gap-2"><Button type="button" variant={selectedAssetId === asset.id ? "default" : "outline"} className="rounded-xl" onClick={() => setSelectedAssetId(asset.id)}>اختيار</Button><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => runTask(() => handleDeleteAsset(asset.id))}><Trash2 className="h-4 w-4" /></Button></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>تطبيق الختم أو التوقيع</CardTitle>
                <CardDescription>ارفع صورة أو ملف PDF، ثم اختر الأصل المحفوظ واضغط على مكان المعاينة لتحديد موضعه قبل التنزيل.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input type="file" accept="image/*,application/pdf" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void handleStampTargetChange(file) } }} />
                  <div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>عرض الختم</Label><Input type="number" min={40} value={stampWidth} onChange={(event) => setStampWidth(Number(event.target.value) || 140)} /></div><div className="space-y-2"><Label>رقم الصفحة في PDF</Label><Input type="number" min={1} value={stampPage} onChange={(event) => setStampPage(Number(event.target.value) || 1)} /></div></div>
                </div>
                <div className="rounded-[1.25rem] border border-border/60 bg-muted/10 p-4">
                  {isPreparingStampPreview ? <div className="flex h-[420px] items-center justify-center"><LoaderCircle className="h-5 w-5 animate-spin text-primary" /></div> : stampTargetPreview ? (
                    <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[1.25rem] border border-white bg-white">
                      <button
                        type="button"
                        className="relative block w-full"
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect()
                          const xPercent = ((event.clientX - rect.left) / rect.width) * 100
                          const yPercent = ((event.clientY - rect.top) / rect.height) * 100
                          setStampPosition({ xPercent: clamp(xPercent, 0, 100), yPercent: clamp(yPercent, 0, 100) })
                        }}
                      >
                        <img src={stampTargetPreview} alt="Preview" className="w-full object-contain" />
                        {selectedAsset ? (
                          <img
                            src={selectedAsset.imageUrl}
                            alt={selectedAsset.name}
                            className="pointer-events-none absolute opacity-80"
                            style={{
                              width: `${stampWidth}px`,
                              left: `calc(${stampPosition.xPercent}% - ${stampWidth / 2}px)`,
                              top: `calc(${stampPosition.yPercent}% - ${(stampWidth * 0.35)}px)`,
                            }}
                          />
                        ) : null}
                      </button>
                    </div>
                  ) : <div className="flex h-[420px] items-center justify-center rounded-[1.25rem] border border-dashed border-border/70 bg-white text-sm text-muted-foreground">ارفع ملفًا ثم اضغط داخل المعاينة لتحديد مكان الختم.</div>}
                </div>
                <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">الموضع الحالي: X {stampPosition.xPercent.toFixed(1)}% • Y {stampPosition.yPercent.toFixed(1)}%</p><Button type="button" className="rounded-xl" onClick={() => runTask(handleApplyStamp)} disabled={isPending}><Stamp className="h-4 w-4" />تطبيق الختم وتنزيل الملف</Button></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="writer" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[0.85fr,1.15fr]">
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>قوالب الكتابة</CardTitle>
                <CardDescription>أنشئ قالبًا واحدًا وارجع له لاحقًا للتعديل والكتابة والتصدير بدل البدء من الصفر كل مرة.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button type="button" variant="outline" className="w-full rounded-xl" onClick={resetTemplateEditor}><Plus className="h-4 w-4" />قالب جديد</Button>
                <div className="space-y-3">
                  {data.templates.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد قوالب محفوظة بعد.</p> : data.templates.map((template) => (
                    <button key={template.id} type="button" onClick={() => loadTemplateIntoEditor(template)} className={`block w-full rounded-[1.25rem] border px-4 py-4 text-right transition-colors ${selectedTemplateId === template.id ? "border-primary bg-primary/5" : "border-border/60 bg-muted/10 hover:bg-muted/20"}`}>
                      <div className="flex items-center justify-between gap-3"><Badge variant="secondary">{formatDateTime(template.updatedAt)}</Badge><p className="font-semibold text-foreground">{template.title}</p></div>
                      <p className="mt-2 text-sm text-muted-foreground">{template.description || "بدون وصف"}</p>
                    </button>
                  ))}
                </div>
                {selectedTemplate ? <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => runTask(() => handleDeleteTemplate(selectedTemplate.id))}><Trash2 className="h-4 w-4" />حذف القالب الحالي</Button> : null}
              </CardContent>
            </Card>

            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>الكتابة على الوورد</CardTitle>
                <CardDescription>محرر نصي سريع بقوالب محفوظة، مع أدوات تنسيق أساسية وتصدير إلى ملف Word.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2"><Label>عنوان القالب</Label><Input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} /></div>
                  <div className="space-y-2"><Label>وصف مختصر</Label><Input value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} /></div>
                </div>
                <div className="flex flex-wrap justify-start gap-2 rounded-[1.25rem] border border-border/60 bg-muted/10 p-3">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => applyEditorCommand("bold")}><strong>B</strong></Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => applyEditorCommand("italic")}><em>I</em></Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => applyEditorCommand("underline")}><span className="underline">U</span></Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => applyEditorCommand("justifyRight")}>يمين</Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => applyEditorCommand("justifyCenter")}>وسط</Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => applyEditorCommand("insertUnorderedList")}>تعداد</Button>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={() => applyEditorCommand("removeFormat")}>تنظيف</Button>
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  dir="rtl"
                  className="min-h-[420px] rounded-[1.5rem] border border-border/60 bg-white p-6 text-right leading-8 outline-none"
                  onInput={(event) => setTemplateHtml(event.currentTarget.innerHTML)}
                />
                <div className="flex flex-wrap justify-between gap-3"><div className="flex flex-wrap gap-2"><Button type="button" className="rounded-xl" onClick={() => runTask(handleSaveTemplate)} disabled={isPending}><Save className="h-4 w-4" />حفظ القالب</Button><Button type="button" variant="outline" className="rounded-xl" onClick={exportTemplateAsWord}><FileText className="h-4 w-4" />تصدير Word</Button></div><div className="text-sm text-muted-foreground">يمكنك استخدام نفس القالب لاحقًا وتعديل النص مباشرة ثم إعادة التصدير.</div></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
