"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { AboutContent } from "@/lib/site-content"

export function AboutEditor({ initialContent }: { initialContent: AboutContent }) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateFeature(index: number, value: string) {
    setContent((current) => ({ ...current, features: current.features.map((item, itemIndex) => (itemIndex === index ? { ...item, text: value } : item)) }))
  }

  function addFeature() {
    setContent((current) => ({ ...current, features: [...current.features, { id: Math.max(0, ...current.features.map((item) => item.id)) + 1, text: "ميزة جديدة" }] }))
  }

  function removeFeature(id: number) {
    setContent((current) => ({ ...current, features: current.features.filter((item) => item.id !== id) }))
  }

  function updateStat(index: number, field: keyof AboutContent["stats"][number], value: string) {
    setContent((current) => ({ ...current, stats: current.stats.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)) }))
  }

  function addStat() {
    setContent((current) => ({ ...current, stats: [...current.stats, { id: Math.max(0, ...current.stats.map((item) => item.id)) + 1, value: "+0", label: "إحصائية", icon: "Users" }] }))
  }

  function removeStat(id: number) {
    setContent((current) => ({ ...current, stats: current.stats.filter((item) => item.id !== id) }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/about", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) })
      setMessage(response.ok ? "تم حفظ قسم من نحن" : "تعذر حفظ قسم من نحن")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2 text-right"><Label htmlFor="about-badge">الشارة</Label><Input id="about-badge" value={content.badge} onChange={(event) => setContent((current) => ({ ...current, badge: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="about-title">العنوان</Label><Input id="about-title" value={content.title} onChange={(event) => setContent((current) => ({ ...current, title: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="about-highlight">الكلمة المميزة</Label><Input id="about-highlight" value={content.highlight} onChange={(event) => setContent((current) => ({ ...current, highlight: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="about-cta">نص الزر</Label><Input id="about-cta" value={content.ctaLabel} onChange={(event) => setContent((current) => ({ ...current, ctaLabel: event.target.value }))} /></div><div className="space-y-2 text-right md:col-span-2"><Label htmlFor="about-description">الوصف</Label><Textarea id="about-description" rows={4} value={content.description} onChange={(event) => setContent((current) => ({ ...current, description: event.target.value }))} /></div><div className="md:col-span-2"><FileUploadField label="الصورة الرئيسية" value={content.image} onChange={(value) => setContent((current) => ({ ...current, image: value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="about-vision-title">عنوان الرؤية</Label><Input id="about-vision-title" value={content.visionTitle} onChange={(event) => setContent((current) => ({ ...current, visionTitle: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="about-mission-title">عنوان الرسالة</Label><Input id="about-mission-title" value={content.missionTitle} onChange={(event) => setContent((current) => ({ ...current, missionTitle: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="about-vision-description">وصف الرؤية</Label><Textarea id="about-vision-description" rows={3} value={content.visionDescription} onChange={(event) => setContent((current) => ({ ...current, visionDescription: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="about-mission-description">وصف الرسالة</Label><Textarea id="about-mission-description" rows={3} value={content.missionDescription} onChange={(event) => setContent((current) => ({ ...current, missionDescription: event.target.value }))} /></div></div></div>
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="mb-4 flex items-center justify-between"><Button type="button" variant="outline" className="rounded-xl" onClick={addFeature}><Plus className="h-4 w-4" />إضافة ميزة</Button><h2 className="text-lg font-bold text-foreground">المزايا</h2></div><div className="space-y-3">{content.features.map((feature, index) => (<div key={feature.id} className="flex gap-2"><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeFeature(feature.id)}><Trash2 className="h-4 w-4" /></Button><Input value={feature.text} onChange={(event) => updateFeature(index, event.target.value)} /></div>))}</div></div>
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="mb-4 flex items-center justify-between"><Button type="button" variant="outline" className="rounded-xl" onClick={addStat}><Plus className="h-4 w-4" />إضافة إحصائية</Button><h2 className="text-lg font-bold text-foreground">الإحصائيات</h2></div><div className="space-y-4">{content.stats.map((stat, index) => (<div key={stat.id} className="grid gap-4 md:grid-cols-3"><div className="space-y-2 text-right"><Label htmlFor={`about-stat-value-${stat.id}`}>القيمة</Label><Input id={`about-stat-value-${stat.id}`} value={stat.value} onChange={(event) => updateStat(index, "value", event.target.value)} /></div><div className="space-y-2 text-right"><Label htmlFor={`about-stat-label-${stat.id}`}>النص</Label><Input id={`about-stat-label-${stat.id}`} value={stat.label} onChange={(event) => updateStat(index, "label", event.target.value)} /></div><div className="space-y-2 text-right"><Label htmlFor={`about-stat-icon-${stat.id}`}>اسم الأيقونة</Label><div className="flex gap-2"><Input id={`about-stat-icon-${stat.id}`} value={stat.icon} onChange={(event) => updateStat(index, "icon", event.target.value)} /><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeStat(stat.id)}><Trash2 className="h-4 w-4" /></Button></div></div></div>))}</div></div>
      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="text-right"><p className="text-sm font-bold text-foreground">حفظ التعديلات</p><p className="text-sm text-muted-foreground">سيتم تحديث قسم من نحن في الصفحة الرئيسية بعد الحفظ.</p></div><div className="flex items-center gap-3">{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button></div></div>
    </section>
  )
}
