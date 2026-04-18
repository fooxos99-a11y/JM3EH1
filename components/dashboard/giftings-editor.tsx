"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { DonationMethod, GiftingItem, GiftingsContent } from "@/lib/site-content"

const donationMethodOptions: Array<{ value: DonationMethod; label: string }> = [
  { value: "shares", label: "تبرع بالأسهم" },
  { value: "open_restricted", label: "مفتوح مقيد" },
  { value: "open_unrestricted", label: "مفتوح غير مقيد" },
]

function createGiftingItem(nextId: number): GiftingItem {
  return {
    id: nextId,
    title: "إهداء جديد",
    description: "وصف مختصر للإهداء",
    amount: 100,
    image: "",
    badge: "إهداء",
    buttonLabel: "أهدي الآن",
    donationMethod: "open_unrestricted",
    minAmount: 0,
    maxAmount: null,
    defaultAmount: 100,
    totalAmount: 0,
    collectedAmount: 0,
    hideTotalAmount: true,
    hideDonation: false,
    shareUnitAmount: 0,
    labels: [{ id: 1, label: "إهداء عام", amount: 100, sharesCount: 1 }],
    senderPlacement: { x: 28, y: 72, color: "#ffffff", fontSize: 24 },
    recipientPlacement: { x: 72, y: 72, color: "#ffffff", fontSize: 24 },
    senderPrefix: "من",
    recipientPrefix: "إلى",
    smsTemplate: "وصلتك هدية من {from_name} في {gift_title}.",
    confirmationMessage: "تم حفظ الإهداء بنجاح.",
  }
}

export function GiftingsEditor({ initialContent }: { initialContent: GiftingsContent }) {
  const [content, setContent] = useState<GiftingsContent>(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateItem(index: number, nextItem: GiftingItem) {
    setContent((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? nextItem : item)),
    }))
  }

  function updateItemField<K extends keyof GiftingItem>(index: number, field: K, value: GiftingItem[K]) {
    const item = content.items[index]
    updateItem(index, { ...item, [field]: value })
  }

  function addItem() {
    setContent((current) => ({
      ...current,
      items: [...current.items, createGiftingItem(Math.max(0, ...current.items.map((item) => item.id)) + 1)],
    }))
  }

  function removeItem(id: number) {
    setContent((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
  }

  function addLabel(itemIndex: number) {
    const item = content.items[itemIndex]
    const nextId = Math.max(0, ...item.labels.map((label) => label.id)) + 1
    updateItem(itemIndex, {
      ...item,
      labels: [...item.labels, { id: nextId, label: `مسمى ${nextId}`, amount: item.defaultAmount || 100, sharesCount: 1 }],
    })
  }

  function removeLabel(itemIndex: number, labelId: number) {
    const item = content.items[itemIndex]
    const labels = item.labels.filter((label) => label.id !== labelId)
    updateItem(itemIndex, { ...item, labels: labels.length > 0 ? labels : [{ id: 1, label: "إهداء عام", amount: item.defaultAmount || 100, sharesCount: 1 }] })
  }

  function updateLabel(itemIndex: number, labelIndex: number, field: "label" | "amount" | "sharesCount", value: string | number) {
    const item = content.items[itemIndex]
    const labels = item.labels.map((label, currentIndex) => (currentIndex === labelIndex ? { ...label, [field]: value } : label))
    updateItem(itemIndex, { ...item, labels })
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/giftings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      })

      setMessage(response.ok ? "تم حفظ الإهداءات" : "تعذر حفظ الإهداءات")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-right"><Label>الشارة</Label><Input value={content.badge} onChange={(event) => setContent((current) => ({ ...current, badge: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>العنوان</Label><Input value={content.title} onChange={(event) => setContent((current) => ({ ...current, title: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>الكلمة المميزة</Label><Input value={content.highlight} onChange={(event) => setContent((current) => ({ ...current, highlight: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>الوصف</Label><Textarea rows={3} value={content.description} onChange={(event) => setContent((current) => ({ ...current, description: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>وصف النافذة</Label><Textarea rows={3} value={content.dialogDescription} onChange={(event) => setContent((current) => ({ ...current, dialogDescription: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>عنوان المعاينة</Label><Input value={content.previewTitle} onChange={(event) => setContent((current) => ({ ...current, previewTitle: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>حقل اسم المُهدي</Label><Input value={content.senderNameLabel} onChange={(event) => setContent((current) => ({ ...current, senderNameLabel: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>Placeholder اسم المُهدي</Label><Input value={content.senderNamePlaceholder} onChange={(event) => setContent((current) => ({ ...current, senderNamePlaceholder: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>حقل اسم المُهدى له</Label><Input value={content.recipientNameLabel} onChange={(event) => setContent((current) => ({ ...current, recipientNameLabel: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>Placeholder اسم المُهدى له</Label><Input value={content.recipientNamePlaceholder} onChange={(event) => setContent((current) => ({ ...current, recipientNamePlaceholder: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>حقل الجوال</Label><Input value={content.recipientPhoneLabel} onChange={(event) => setContent((current) => ({ ...current, recipientPhoneLabel: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>Placeholder الجوال</Label><Input value={content.recipientPhonePlaceholder} onChange={(event) => setContent((current) => ({ ...current, recipientPhonePlaceholder: event.target.value }))} /></div>
          <div className="space-y-2 text-right"><Label>نص زر المتابعة</Label><Input value={content.submitButtonLabel} onChange={(event) => setContent((current) => ({ ...current, submitButtonLabel: event.target.value }))} /></div>
          <div className="space-y-2 text-right md:col-span-2"><Label>نص توضيحي للرسالة النصية</Label><Textarea rows={2} value={content.smsHelperText} onChange={(event) => setContent((current) => ({ ...current, smsHelperText: event.target.value }))} /></div>
        </div>
      </div>

      <div className="flex justify-start"><Button type="button" variant="outline" className="rounded-xl" onClick={addItem}><Plus className="h-4 w-4" />إضافة إهداء</Button></div>

      <div className="space-y-4">
        {content.items.map((item, index) => (
          <div key={item.id} className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-4"><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeItem(item.id)}><Trash2 className="h-4 w-4" />حذف الإهداء</Button><h3 className="text-lg font-bold text-foreground">إهداء {index + 1}</h3></div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><FileUploadField label="صورة الإهداء" value={item.image} onChange={(value) => updateItemField(index, "image", value)} /></div>
              <div className="space-y-2 text-right"><Label>العنوان</Label><Input value={item.title} onChange={(event) => updateItemField(index, "title", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label>الشارة</Label><Input value={item.badge} onChange={(event) => updateItemField(index, "badge", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label>نص الزر</Label><Input value={item.buttonLabel} onChange={(event) => updateItemField(index, "buttonLabel", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label>نوع التمويل</Label><Select value={item.donationMethod} onValueChange={(value) => updateItemField(index, "donationMethod", value as DonationMethod)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{donationMethodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 md:mt-7"><div className="text-right"><p className="text-sm font-semibold text-foreground">إخفاء الإهداء</p><p className="text-xs text-muted-foreground">لن يظهر في الصفحة عند التفعيل.</p></div><Switch checked={item.hideDonation} onCheckedChange={(checked) => updateItemField(index, "hideDonation", checked)} /></div>
              <div className="space-y-2 text-right"><Label>القيمة الافتراضية</Label><Input type="number" min={0} value={item.defaultAmount} onChange={(event) => updateItemField(index, "defaultAmount", Number(event.target.value) || 0)} /></div>
              <div className="space-y-2 text-right"><Label>الحد الأدنى</Label><Input type="number" min={0} value={item.minAmount} onChange={(event) => updateItemField(index, "minAmount", Number(event.target.value) || 0)} /></div>
              <div className="space-y-2 text-right"><Label>الحد الأعلى</Label><Input type="number" min={0} value={item.maxAmount ?? 0} onChange={(event) => updateItemField(index, "maxAmount", Number(event.target.value) || null)} /></div>
              <div className="space-y-2 text-right"><Label>قيمة السهم</Label><Input type="number" min={0} value={item.shareUnitAmount} onChange={(event) => updateItemField(index, "shareUnitAmount", Number(event.target.value) || 0)} /></div>
              <div className="space-y-2 text-right md:col-span-2"><Label>الوصف</Label><Textarea rows={4} value={item.description} onChange={(event) => updateItemField(index, "description", event.target.value)} /></div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[1.5rem] border border-border/60 bg-muted/10 p-4">
                <div className="mb-4 text-right"><h4 className="font-semibold text-foreground">إعداد نص المُهدي</h4></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 text-right"><Label>البادئة</Label><Input value={item.senderPrefix} onChange={(event) => updateItemField(index, "senderPrefix", event.target.value)} /></div>
                  <div className="space-y-2 text-right"><Label>اللون</Label><Input type="color" value={item.senderPlacement.color} onChange={(event) => updateItem(index, { ...item, senderPlacement: { ...item.senderPlacement, color: event.target.value } })} /></div>
                  <div className="space-y-2 text-right"><Label>X%</Label><Input type="number" min={0} max={100} value={item.senderPlacement.x} onChange={(event) => updateItem(index, { ...item, senderPlacement: { ...item.senderPlacement, x: Number(event.target.value) || 0 } })} /></div>
                  <div className="space-y-2 text-right"><Label>Y%</Label><Input type="number" min={0} max={100} value={item.senderPlacement.y} onChange={(event) => updateItem(index, { ...item, senderPlacement: { ...item.senderPlacement, y: Number(event.target.value) || 0 } })} /></div>
                  <div className="space-y-2 text-right md:col-span-2"><Label>حجم الخط</Label><Input type="number" min={12} max={64} value={item.senderPlacement.fontSize} onChange={(event) => updateItem(index, { ...item, senderPlacement: { ...item.senderPlacement, fontSize: Number(event.target.value) || 24 } })} /></div>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-border/60 bg-muted/10 p-4">
                <div className="mb-4 text-right"><h4 className="font-semibold text-foreground">إعداد نص المُهدى له</h4></div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 text-right"><Label>البادئة</Label><Input value={item.recipientPrefix} onChange={(event) => updateItemField(index, "recipientPrefix", event.target.value)} /></div>
                  <div className="space-y-2 text-right"><Label>اللون</Label><Input type="color" value={item.recipientPlacement.color} onChange={(event) => updateItem(index, { ...item, recipientPlacement: { ...item.recipientPlacement, color: event.target.value } })} /></div>
                  <div className="space-y-2 text-right"><Label>X%</Label><Input type="number" min={0} max={100} value={item.recipientPlacement.x} onChange={(event) => updateItem(index, { ...item, recipientPlacement: { ...item.recipientPlacement, x: Number(event.target.value) || 0 } })} /></div>
                  <div className="space-y-2 text-right"><Label>Y%</Label><Input type="number" min={0} max={100} value={item.recipientPlacement.y} onChange={(event) => updateItem(index, { ...item, recipientPlacement: { ...item.recipientPlacement, y: Number(event.target.value) || 0 } })} /></div>
                  <div className="space-y-2 text-right md:col-span-2"><Label>حجم الخط</Label><Input type="number" min={12} max={64} value={item.recipientPlacement.fontSize} onChange={(event) => updateItem(index, { ...item, recipientPlacement: { ...item.recipientPlacement, fontSize: Number(event.target.value) || 24 } })} /></div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 text-right"><Label>نص الرسالة النصية</Label><Textarea rows={4} value={item.smsTemplate} onChange={(event) => updateItemField(index, "smsTemplate", event.target.value)} /></div>
              <div className="space-y-2 text-right"><Label>رسالة التأكيد</Label><Textarea rows={4} value={item.confirmationMessage} onChange={(event) => updateItemField(index, "confirmationMessage", event.target.value)} /></div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-border/60 bg-muted/10 p-4">
              <div className="mb-4 flex items-center justify-between gap-4"><div className="text-right"><h4 className="font-semibold text-foreground">مسميات الإهداء</h4></div><Button type="button" variant="outline" className="rounded-xl" onClick={() => addLabel(index)}><Plus className="h-4 w-4" />إضافة مسمى</Button></div>
              <div className="space-y-3">
                {item.labels.map((label, labelIndex) => (
                  <div key={label.id} className="grid gap-3 rounded-2xl border border-border/60 bg-white/70 p-4 md:grid-cols-[1fr_180px_180px_auto]">
                    <div className="space-y-2 text-right"><Label>المسمى</Label><Input value={label.label} onChange={(event) => updateLabel(index, labelIndex, "label", event.target.value)} /></div>
                    <div className="space-y-2 text-right"><Label>المبلغ</Label><Input type="number" min={0} value={label.amount} onChange={(event) => updateLabel(index, labelIndex, "amount", Number(event.target.value) || 0)} /></div>
                    <div className="space-y-2 text-right"><Label>عدد الأسهم</Label><Input type="number" min={1} value={label.sharesCount} onChange={(event) => updateLabel(index, labelIndex, "sharesCount", Number(event.target.value) || 1)} /></div>
                    <div className="flex items-end justify-end"><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeLabel(index, label.id)}><Trash2 className="h-4 w-4" />حذف</Button></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="text-right"><p className="text-sm font-bold text-foreground">حفظ التعديلات</p><p className="text-sm text-muted-foreground">سيتم تحديث بطاقات الإهداءات مباشرة بعد الحفظ.</p></div><div className="flex items-center gap-3">{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button></div></div>
    </section>
  )
}
