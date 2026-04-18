"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { PartnersContent } from "@/lib/site-content"

export function PartnersEditor({ initialContent }: { initialContent: PartnersContent }) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateItem(index: number, field: keyof PartnersContent["items"][number], value: string) {
    setContent((current) => ({ ...current, items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)) }))
  }

  function addItem() {
    setContent((current) => ({ ...current, items: [...current.items, { id: Math.max(0, ...current.items.map((item) => item.id)) + 1, name: "شريك جديد", abbr: "ج", logo: "" }] }))
  }

  function removeItem(id: number) {
    setContent((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/partners", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) })
      setMessage(response.ok ? "تم حفظ الشركاء" : "تعذر حفظ الشركاء")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2 text-right"><Label htmlFor="partners-badge">الشارة</Label><Input id="partners-badge" value={content.badge} onChange={(event) => setContent((current) => ({ ...current, badge: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="partners-title">العنوان</Label><Input id="partners-title" value={content.title} onChange={(event) => setContent((current) => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2 text-right md:col-span-2"><Label htmlFor="partners-description">الوصف</Label><Textarea id="partners-description" rows={4} value={content.description} onChange={(event) => setContent((current) => ({ ...current, description: event.target.value }))} /></div></div></div>
      <div className="flex justify-start"><Button type="button" variant="outline" className="rounded-xl" onClick={addItem}><Plus className="h-4 w-4" />إضافة شريك</Button></div>
      <div className="space-y-4">{content.items.map((item, index) => (<div key={item.id} className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="mb-4 flex items-center justify-between"><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" />حذف الشريك</Button><h3 className="text-lg font-bold text-foreground">شريك {index + 1}</h3></div><div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><FileUploadField label="شعار الشريك" value={item.logo} onChange={(value) => updateItem(index, "logo", value)} /></div><div className="space-y-2 text-right"><Label htmlFor={`partner-name-${item.id}`}>اسم الشريك</Label><Input id={`partner-name-${item.id}`} value={item.name} onChange={(event) => updateItem(index, "name", event.target.value)} /></div><div className="space-y-2 text-right"><Label htmlFor={`partner-abbr-${item.id}`}>اختصار الشعار</Label><Input id={`partner-abbr-${item.id}`} value={item.abbr} onChange={(event) => updateItem(index, "abbr", event.target.value)} /></div></div></div>))}</div>
      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="text-right"><p className="text-sm font-bold text-foreground">حفظ التعديلات</p><p className="text-sm text-muted-foreground">سيتم تحديث شريط الشركاء بعد الحفظ.</p></div><div className="flex items-center gap-3">{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button></div></div>
    </section>
  )
}
