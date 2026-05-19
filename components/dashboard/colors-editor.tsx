"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ColorsContent } from "@/lib/site-content"

function ColorRow({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2 text-right">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-3">
        <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} dir="ltr" />
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-16 rounded-xl border border-border bg-white p-1" />
      </div>
    </div>
  )
}

export function ColorsEditor({ initialContent }: { initialContent: ColorsContent }) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/colors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) })
      setMessage(response.ok ? "تم حفظ الألوان" : "تعذر حفظ الألوان")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="mb-6 flex gap-3">
          <Button type="button" variant={content.mode === "single" ? "default" : "outline"} className="rounded-xl" onClick={() => setContent((current) => ({ ...current, mode: "single" }))}>لون واحد</Button>
          <Button type="button" variant={content.mode === "duo" ? "default" : "outline"} className="rounded-xl" onClick={() => setContent((current) => ({ ...current, mode: "duo" }))}>لونان</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <ColorRow id="colors-primary" label="اللون الأساسي" value={content.primary} onChange={(value) => setContent((current) => ({ ...current, primary: value }))} />
          <ColorRow id="colors-secondary" label="اللون الثانوي" value={content.secondary} onChange={(value) => setContent((current) => ({ ...current, secondary: value }))} />
          <ColorRow id="colors-accent" label="لون الإبراز" value={content.accent} onChange={(value) => setContent((current) => ({ ...current, accent: value }))} />
          <ColorRow id="colors-background" label="لون الخلفية" value={content.background} onChange={(value) => setContent((current) => ({ ...current, background: value }))} />
          <ColorRow id="colors-foreground" label="لون النص" value={content.foreground} onChange={(value) => setContent((current) => ({ ...current, foreground: value }))} />
          <ColorRow id="colors-muted" label="لون المساحات الهادئة" value={content.muted} onChange={(value) => setContent((current) => ({ ...current, muted: value }))} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl p-6 text-white" style={{ background: content.primary }}>أساسي</div>
          <div className="rounded-2xl p-6 text-white" style={{ background: content.mode === "single" ? content.primary : content.secondary }}>ثانوي</div>
          <div className="rounded-2xl p-6" style={{ background: content.accent, color: content.foreground }}>إبراز</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="text-right"><p className="text-sm font-bold text-foreground">حفظ التعديلات</p><p className="text-sm text-muted-foreground">سيتم تطبيق الألوان الجديدة مباشرة على الموقع ولوحة التحكم.</p></div><div className="flex items-center gap-3">{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ الألوان"}</Button></div></div>
    </section>
  )
}
