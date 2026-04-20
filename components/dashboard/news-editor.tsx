"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { NewsContent } from "@/lib/site-content"

export function NewsEditor({ initialContent }: { initialContent: NewsContent }) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateItem(index: number, field: keyof NewsContent["items"][number], value: string) {
    setContent((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }))
  }

  function addItem() {
    setContent((current) => ({
      ...current,
      items: [...current.items, { id: Math.max(0, ...current.items.map((item) => item.id)) + 1, title: "خبر جديد", description: "وصف الخبر", date: "", image: "" }],
    }))
  }

  function removeItem(id: number) {
    setContent((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/news", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) })
      setMessage(response.ok ? "تم حفظ الأخبار" : "تعذر حفظ الأخبار")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="grid gap-4 md:grid-cols-3"><div className="space-y-2 text-right"><Label htmlFor="news-badge">الشارة</Label><Input id="news-badge" value={content.badge} onChange={(event) => setContent((current) => ({ ...current, badge: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="news-title">العنوان الرئيسي</Label><Input id="news-title" value={content.title} onChange={(event) => setContent((current) => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="news-highlight">الكلمة المميزة</Label><Input id="news-highlight" value={content.highlight} onChange={(event) => setContent((current) => ({ ...current, highlight: event.target.value }))} /></div></div></div>
      <div className="flex justify-end"><Button type="button" variant="outline" className="rounded-xl" onClick={addItem}><Plus className="h-4 w-4" />إضافة خبر</Button></div>
      <div className="space-y-4">
        {content.items.map((item, index) => (
          <div key={item.id} className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="mb-4 flex items-center justify-between"><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" />حذف الخبر</Button><h3 className="text-lg font-bold text-foreground">خبر {index + 1}</h3></div><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FileUploadField label="صورة الخبر" value={item.image} onChange={(value) => updateItem(index, "image", value)} /></div><div className="space-y-2 text-right"><Label htmlFor={`news-title-${item.id}`}>العنوان</Label><Input id={`news-title-${item.id}`} value={item.title} onChange={(event) => updateItem(index, "title", event.target.value)} /></div><div className="space-y-2 text-right"><Label htmlFor={`news-date-${item.id}`}>التاريخ</Label><Input id={`news-date-${item.id}`} value={item.date} onChange={(event) => updateItem(index, "date", event.target.value)} /></div><div className="space-y-2 text-right md:col-span-2"><Label htmlFor={`news-description-${item.id}`}>الوصف</Label><Textarea id={`news-description-${item.id}`} rows={4} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} /></div></div></div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="text-right"><p className="text-sm font-bold text-foreground">حفظ التعديلات</p><p className="text-sm text-muted-foreground">سيتم تحديث قسم الأخبار في الصفحة الرئيسية بعد الحفظ.</p></div><div className="flex items-center gap-3">{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button></div></div>
    </section>
  )
}
