"use client"

import { useState, useTransition } from "react"

import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { LogoContent } from "@/lib/site-content"

export function LogoEditor({ initialContent }: { initialContent: LogoContent }) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/logo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      })

      setMessage(response.ok ? "تم حفظ الشعار" : "تعذر حفظ الشعار")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-6 text-right">
          <h2 className="text-lg font-bold text-foreground">إدارة الشعار</h2>
          <p className="mt-1 text-sm text-muted-foreground">ارفع رمز الشعار فقط بمقاس 140x140 ويفضّل بخلفية شفافة، ثم اكتب الاسم بالعربية والإنجليزية ليظهر بنقاء أعلى في الموقع ولوحة التحكم.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="space-y-3">
            <FileUploadField label="صورة الشعار" value={content.logo} onChange={(value) => setContent((current) => ({ ...current, logo: value }))} />
            <p className="text-right text-xs text-muted-foreground">المقاس المناسب: 140x140 بصيغة PNG أو WebP مع خلفية شفافة.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2 text-right">
              <Label htmlFor="logo-arabic-name">الاسم بالعربية</Label>
              <Input id="logo-arabic-name" value={content.arabicName} onChange={(event) => setContent((current) => ({ ...current, arabicName: event.target.value }))} />
            </div>

            <div className="space-y-2 text-right">
              <Label htmlFor="logo-english-name">الاسم بالإنجليزية</Label>
              <Input id="logo-english-name" value={content.englishName} onChange={(event) => setContent((current) => ({ ...current, englishName: event.target.value }))} dir="ltr" />
            </div>

            <div className="space-y-2 text-right">
              <Label htmlFor="logo-alt">النص البديل</Label>
              <Input id="logo-alt" value={content.alt} onChange={(event) => setContent((current) => ({ ...current, alt: event.target.value }))} />
            </div>

            <div className="rounded-[1.25rem] border border-border/70 bg-muted/20 p-4 text-right">
              <p className="text-sm font-semibold text-foreground">معاينة</p>
              <div className="mt-4 flex min-h-40 items-center justify-end gap-5 rounded-[1rem] border border-dashed border-border/80 bg-white p-5 text-right">
                <div className="space-y-1.5">
                  <p className="text-lg font-extrabold leading-tight text-foreground">{content.arabicName || "اسم الجهة بالعربية"}</p>
                  <p className="text-sm font-semibold tracking-[0.02em] text-muted-foreground" dir="ltr">{content.englishName || "Organization Name in English"}</p>
                </div>
                <div className="flex h-[140px] w-[140px] items-center justify-center rounded-[1.25rem] border border-border/70 bg-white shadow-sm">
                  {content.logo ? (
                    <img src={content.logo} alt={content.alt} className="h-[140px] w-[140px] object-contain" />
                  ) : (
                    <span className="text-sm text-muted-foreground">140x140</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">حفظ التعديلات</p>
          <p className="text-sm text-muted-foreground">بعد الحفظ سيُعرض الشعار مباشرة في الواجهة ولوحة التحكم.</p>
        </div>
        <div className="flex items-center gap-3">
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ الشعار"}</Button>
        </div>
      </div>
    </section>
  )
}