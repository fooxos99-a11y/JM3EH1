"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { GalleryContent } from "@/lib/site-content"

export function GalleryEditor({ initialContent }: { initialContent: GalleryContent }) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateItem(index: number, field: keyof GalleryContent["items"][number], value: string) {
    setContent((current) => ({ ...current, items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)) }))
  }

  function addItem() {
    setContent((current) => ({ ...current, items: [...current.items, { id: Math.max(0, ...current.items.map((item) => item.id)) + 1, src: "", title: "صورة جديدة" }] }))
  }

  function removeItem(id: number) {
    setContent((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/gallery", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) })
      setMessage(response.ok ? "تم حفظ المعرض" : "تعذر حفظ المعرض")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="grid gap-4 md:grid-cols-3"><div className="space-y-2 text-right"><Label htmlFor="gallery-badge">الشارة</Label><Input id="gallery-badge" value={content.badge} onChange={(event) => setContent((current) => ({ ...current, badge: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="gallery-title">العنوان الرئيسي</Label><Input id="gallery-title" value={content.title} onChange={(event) => setContent((current) => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="gallery-highlight">الكلمة المميزة</Label><Input id="gallery-highlight" value={content.highlight} onChange={(event) => setContent((current) => ({ ...current, highlight: event.target.value }))} /></div></div></div>
      <div className="flex justify-start"><Button type="button" variant="outline" className="rounded-xl" onClick={addItem}><Plus className="h-4 w-4" />إضافة صورة</Button></div>
      <div className="space-y-4">{content.items.map((item, index) => (<div key={item.id} className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="mb-4 flex items-center justify-between"><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" />حذف الصورة</Button><h3 className="text-lg font-bold text-foreground">صورة {index + 1}</h3></div><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FileUploadField label="صورة المعرض" value={item.src} onChange={(value) => updateItem(index, "src", value)} /></div><div className="space-y-2 text-right md:col-span-2"><Label htmlFor={`gallery-title-${item.id}`}>العنوان</Label><Input id={`gallery-title-${item.id}`} value={item.title} onChange={(event) => updateItem(index, "title", event.target.value)} /></div></div></div>))}</div>
      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="text-right"><p className="text-sm font-bold text-foreground">حفظ التعديلات</p><p className="text-sm text-muted-foreground">سيتم تحديث ألبوم الصور بعد الحفظ.</p></div><div className="flex items-center gap-3">{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button></div></div>
    </section>
  )
}
