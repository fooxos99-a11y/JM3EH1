"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { HeroContent } from "@/lib/site-content"

export function HeroEditor({ initialContent }: { initialContent: HeroContent }) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateSlide(index: number, field: keyof HeroContent["slides"][number], value: string) {
    setContent((current) => ({
      ...current,
      slides: current.slides.map((entry, slideIndex) => (slideIndex === index ? { ...entry, [field]: value } : entry)),
    }))
  }

  function addSlide() {
    setContent((current) => ({
      ...current,
      slides: [
        ...current.slides,
        {
          id: Math.max(0, ...current.slides.map((slide) => slide.id)) + 1,
          image: "",
          title: "شريحة جديدة",
          subtitle: "عنوان صغير",
          description: "وصف مختصر للشريحة",
        },
      ],
    }))
  }

  function removeSlide(id: number) {
    setContent((current) => ({
      ...current,
      slides: current.slides.length > 1 ? current.slides.filter((slide) => slide.id !== id) : current.slides,
    }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/hero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      })

      setMessage(response.ok ? "تم حفظ الواجهة الرئيسية" : "تعذر حفظ بيانات الواجهة الرئيسية")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-right">
            <Label htmlFor="hero-donate-label">نص زر التبرع</Label>
            <Input id="hero-donate-label" value={content.donateLabel} onChange={(event) => setContent((current) => ({ ...current, donateLabel: event.target.value }))} />
          </div>
          <div className="space-y-2 text-right">
            <Label htmlFor="hero-about-label">نص زر التعرف</Label>
            <Input id="hero-about-label" value={content.aboutLabel} onChange={(event) => setContent((current) => ({ ...current, aboutLabel: event.target.value }))} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="outline" className="rounded-xl" onClick={addSlide}>
          <Plus className="h-4 w-4" />
          إضافة شريحة
        </Button>
      </div>

      <div className="space-y-4">
        {content.slides.map((slide, index) => (
          <div key={slide.id} className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeSlide(slide.id)} disabled={content.slides.length === 1}>
                <Trash2 className="h-4 w-4" />
                حذف الشريحة
              </Button>
              <div className="text-right">
                <h3 className="text-lg font-bold text-foreground">الشريحة {index + 1}</h3>
                <p className="text-sm text-muted-foreground">الصورة والعنوان الصغير والعنوان الكبير والوصف فقط.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FileUploadField label="صورة الواجهة" value={slide.image} onChange={(value) => updateSlide(index, "image", value)} />
              </div>
              <div className="space-y-2 text-right">
                <Label htmlFor={`hero-title-${slide.id}`}>العنوان الكبير</Label>
                <Input id={`hero-title-${slide.id}`} value={slide.title} onChange={(event) => updateSlide(index, "title", event.target.value)} />
              </div>
              <div className="space-y-2 text-right">
                <Label htmlFor={`hero-subtitle-${slide.id}`}>العنوان الصغير</Label>
                <Input id={`hero-subtitle-${slide.id}`} value={slide.subtitle} onChange={(event) => updateSlide(index, "subtitle", event.target.value)} />
              </div>
              <div className="space-y-2 text-right md:col-span-2">
                <Label htmlFor={`hero-description-${slide.id}`}>الوصف</Label>
                <Textarea id={`hero-description-${slide.id}`} value={slide.description} onChange={(event) => updateSlide(index, "description", event.target.value)} rows={4} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">حفظ التعديلات</p>
          <p className="text-sm text-muted-foreground">سيتم تحديث الواجهة الرئيسية مباشرة بعد الحفظ.</p>
        </div>
        <div className="flex items-center gap-3">
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button>
        </div>
      </div>
    </section>
  )
}
