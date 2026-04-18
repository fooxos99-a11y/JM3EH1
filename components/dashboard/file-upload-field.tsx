"use client"

import Link from "next/link"
import { FileText, LoaderCircle, Trash2, Upload } from "lucide-react"
import { useId, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type FileUploadFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  accept?: string
  emptyLabel?: string
  removeLabel?: string
  uploadLabel?: string
  uploadingLabel?: string
  previewType?: "image" | "file"
}

export function FileUploadField({
  label,
  value,
  onChange,
  accept = "image/*",
  emptyLabel = "لا توجد صورة مرفوعة",
  removeLabel = "حذف الصورة",
  uploadLabel = "رفع من الجهاز",
  uploadingLabel = "جارٍ الرفع...",
  previewType = "image",
}: FileUploadFieldProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      })

      const payload = (await response.json()) as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "تعذر رفع الملف")
      }

      onChange(payload.url)
    } catch (error) {
      console.error(error)
    } finally {
      setIsUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ""
      }
    }
  }

  return (
    <div className="space-y-2 text-right">
      <Label htmlFor={inputId}>{label}</Label>
      <input ref={inputRef} id={inputId} type="file" accept={accept} className="hidden" onChange={handleFileChange} />
      <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 p-4">
        {value ? (
          previewType === "image" ? (
            <img src={value} alt={label} className="mb-3 h-40 w-full rounded-[1rem] object-cover" />
          ) : (
            <div className="mb-3 rounded-[1rem] border border-border/80 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" className="rounded-xl" asChild>
                  <Link href={value} target="_blank">
                    فتح الملف
                  </Link>
                </Button>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-sm font-medium text-foreground">تم رفع ملف لهذا العنصر</p>
                    <p className="mt-1 text-xs text-muted-foreground break-all">{value}</p>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="mb-3 flex h-40 items-center justify-center rounded-[1rem] border border-dashed border-border/80 bg-white text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => inputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploading ? uploadingLabel : uploadLabel}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => onChange("")}>
              <Trash2 className="h-4 w-4" />
              {removeLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}