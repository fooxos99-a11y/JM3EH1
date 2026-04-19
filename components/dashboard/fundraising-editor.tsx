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
import type { DonationItem, DonationLabel, DonationMethod, DonationsContent } from "@/lib/site-content"

const donationMethodOptions: Array<{ value: DonationMethod; label: string; description: string }> = [
  { value: "shares", label: "تبرع بالأسهم", description: "المتبرع يختار عدداً أو مسمىً من الأسهم بقيمة ثابتة." },
  { value: "open_restricted", label: "مفتوح مقيد", description: "المتبرع يحدد المبلغ ضمن حد أدنى وحد أعلى، ويمكن إظهار المبلغ الإجمالي فقط عند توفر رقم حقيقي." },
  { value: "open_unrestricted", label: "مفتوح غير مقيد", description: "المتبرع يحدد أي مبلغ بدون حد أعلى وبدون شريط." },
]

function createFallbackLabel(item: DonationItem, id = 1): DonationLabel {
  if (item.donationMethod === "shares") {
    return {
      id,
      label: id === 1 ? "سهم واحد" : `سهم ${id}`,
      sharesCount: id,
      amount: Math.max(1, item.shareUnitAmount || item.amount || item.defaultAmount || 100) * id,
    }
  }

  return {
    id,
    label: id === 1 ? "دعم عام" : `مسمى ${id}`,
    sharesCount: 1,
    amount: Math.max(1, item.defaultAmount || item.amount || 100),
  }
}

function normalizeDonationItem(item: DonationItem): DonationItem {
  const shareUnitAmount = item.donationMethod === "shares"
    ? Math.max(1, item.shareUnitAmount || item.amount || item.defaultAmount || 100)
    : 0

  const labels = (item.labels.length > 0 ? item.labels : [createFallbackLabel(item)]).map((label, index) => {
    const sharesCount = item.donationMethod === "shares" ? Math.max(1, label.sharesCount || 1) : 1

    return {
      id: label.id || index + 1,
      label: label.label || `مسمى ${index + 1}`,
      sharesCount,
      amount: item.donationMethod === "shares"
        ? shareUnitAmount * sharesCount
        : Math.max(1, label.amount || item.defaultAmount || item.amount || 100),
    }
  })

  const primaryAmount = labels[0]?.amount ?? Math.max(1, item.amount || item.defaultAmount || 100)
  const defaultAmount = item.donationMethod === "shares" ? primaryAmount : Math.max(1, item.defaultAmount || primaryAmount)
  const minAmount = item.donationMethod === "open_unrestricted" ? 0 : Math.max(0, item.minAmount || defaultAmount)
  const maxAmount = item.donationMethod === "open_restricted" ? Math.max(minAmount, item.maxAmount ?? defaultAmount) : null
  const totalAmount = Math.max(0, item.totalAmount || 0)
  const collectedAmount = item.donationMethod === "open_restricted"
    ? Math.min(Math.max(0, item.collectedAmount || 0), totalAmount || item.collectedAmount || 0)
    : 0

  return {
    ...item,
    amount: primaryAmount,
    shareUnitAmount,
    labels,
    defaultAmount,
    minAmount,
    maxAmount,
    totalAmount,
    collectedAmount,
  }
}

function createDonationItem(nextId: number, badge: string, buttonLabel: string): DonationItem {
  return normalizeDonationItem({
    id: nextId,
    title: "عنصر جديد",
    description: "وصف مختصر",
    amount: 100,
    image: "",
    badge,
    buttonLabel,
    donationMethod: "shares",
    minAmount: 100,
    maxAmount: null,
    defaultAmount: 100,
    totalAmount: 0,
    collectedAmount: 0,
    hideTotalAmount: false,
    hideDonation: false,
    shareUnitAmount: 100,
    labels: [
      { id: 1, label: "سهم واحد", amount: 100, sharesCount: 1 },
      { id: 2, label: "سهمان", amount: 200, sharesCount: 2 },
    ],
  })
}

type FundraisingEditorProps = {
  initialContent: DonationsContent
  sectionKey: "donations" | "projects"
  sectionLabel: string
  itemLabel: string
  addItemLabel: string
  saveMessage: string
  saveErrorMessage: string
  saveHint: string
  defaultBadge: string
  defaultButtonLabel: string
}

export function FundraisingEditor({ initialContent, sectionKey, sectionLabel, itemLabel, addItemLabel, saveMessage, saveErrorMessage, saveHint, defaultBadge, defaultButtonLabel }: FundraisingEditorProps) {
  const [content, setContent] = useState<DonationsContent>({
    ...initialContent,
    items: initialContent.items.map(normalizeDonationItem),
  })
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function setItem(index: number, nextItem: DonationItem) {
    setContent((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? normalizeDonationItem(nextItem) : item)),
    }))
  }

  function updateItemField<K extends keyof DonationItem>(index: number, field: K, value: DonationItem[K]) {
    const item = content.items[index]
    setItem(index, { ...item, [field]: value })
  }

  function updateLabelField<K extends keyof DonationLabel>(itemIndex: number, labelIndex: number, field: K, value: DonationLabel[K]) {
    const item = content.items[itemIndex]
    const labels = item.labels.map((label, currentLabelIndex) => (currentLabelIndex === labelIndex ? { ...label, [field]: value } : label))
    setItem(itemIndex, { ...item, labels })
  }

  function addItem() {
    setContent((current) => ({
      ...current,
      items: [...current.items, createDonationItem(Math.max(0, ...current.items.map((item) => item.id)) + 1, defaultBadge, defaultButtonLabel)],
    }))
  }

  function removeItem(id: number) {
    setContent((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
  }

  function addLabel(itemIndex: number) {
    const item = content.items[itemIndex]
    const nextId = Math.max(0, ...item.labels.map((label) => label.id)) + 1
    setItem(itemIndex, { ...item, labels: [...item.labels, createFallbackLabel(item, nextId)] })
  }

  function removeLabel(itemIndex: number, labelId: number) {
    const item = content.items[itemIndex]
    const labels = item.labels.filter((label) => label.id !== labelId)
    setItem(itemIndex, { ...item, labels: labels.length > 0 ? labels : [createFallbackLabel(item)] })
  }

  function handleMethodChange(index: number, method: DonationMethod) {
    const item = content.items[index]
    setItem(index, {
      ...item,
      donationMethod: method,
      labels: item.labels.length > 0 ? item.labels : [createFallbackLabel({ ...item, donationMethod: method })],
    })
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const payload: DonationsContent = {
        ...content,
        items: content.items.map(normalizeDonationItem),
      }

      const response = await fetch(`/api/admin/content/${sectionKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      setMessage(response.ok ? saveMessage : saveErrorMessage)
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-right">
            <Label htmlFor={`${sectionKey}-badge`}>الشارة</Label>
            <Input id={`${sectionKey}-badge`} value={content.badge} onChange={(event) => setContent((current) => ({ ...current, badge: event.target.value }))} />
          </div>
          <div className="space-y-2 text-right">
            <Label htmlFor={`${sectionKey}-title`}>العنوان</Label>
            <Input id={`${sectionKey}-title`} value={content.title} onChange={(event) => setContent((current) => ({ ...current, title: event.target.value }))} />
          </div>
          <div className="space-y-2 text-right">
            <Label htmlFor={`${sectionKey}-highlight`}>الكلمة المميزة</Label>
            <Input id={`${sectionKey}-highlight`} value={content.highlight} onChange={(event) => setContent((current) => ({ ...current, highlight: event.target.value }))} />
          </div>
          <div className="space-y-2 text-right">
            <Label htmlFor={`${sectionKey}-description`}>الوصف</Label>
            <Textarea id={`${sectionKey}-description`} rows={3} value={content.description} onChange={(event) => setContent((current) => ({ ...current, description: event.target.value }))} />
          </div>
        </div>
      </div>

      <div className="flex justify-start">
        <Button type="button" variant="outline" className="rounded-xl" onClick={addItem}>
          <Plus className="h-4 w-4" />
          {addItemLabel}
        </Button>
      </div>

      <div className="space-y-4">
        {content.items.map((item, index) => (
          <div key={item.id} className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between gap-4">
              <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeItem(item.id)}>
                <Trash2 className="h-4 w-4" />
                حذف {itemLabel}
              </Button>
              <h3 className="text-lg font-bold text-foreground">{itemLabel} {index + 1}</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FileUploadField label={`صورة ${itemLabel}`} value={item.image} onChange={(value) => updateItemField(index, "image", value)} />
                <p className="mt-2 text-right text-xs text-muted-foreground">تظهر هذه الصورة داخل البطاقة وفي صفحة التفاصيل الخاصة بهذا العنصر.</p>
              </div>

              <div className="space-y-2 text-right">
                <Label htmlFor={`${sectionKey}-title-${item.id}`}>العنوان</Label>
                <Input id={`${sectionKey}-title-${item.id}`} value={item.title} onChange={(event) => updateItemField(index, "title", event.target.value)} />
                <p className="text-xs text-muted-foreground">يظهر العنوان في البطاقة وتحت الصورة داخل صفحة التفاصيل.</p>
              </div>

              <div className="space-y-2 text-right">
                <Label htmlFor={`${sectionKey}-badge-${item.id}`}>الشارة</Label>
                <Input id={`${sectionKey}-badge-${item.id}`} value={item.badge} onChange={(event) => updateItemField(index, "badge", event.target.value)} />
              </div>

              <div className="space-y-2 text-right">
                <Label htmlFor={`${sectionKey}-button-${item.id}`}>نص الزر</Label>
                <Input id={`${sectionKey}-button-${item.id}`} value={item.buttonLabel} onChange={(event) => updateItemField(index, "buttonLabel", event.target.value)} />
              </div>

              <div className="space-y-2 text-right">
                <Label>وسيلة الدعم</Label>
                <Select value={item.donationMethod} onValueChange={(value) => handleMethodChange(index, value as DonationMethod)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر وسيلة الدعم" />
                  </SelectTrigger>
                  <SelectContent>
                    {donationMethodOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{donationMethodOptions.find((option) => option.value === item.donationMethod)?.description}</p>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 md:mt-7">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">إخفاء {sectionLabel}</p>
                  <p className="text-xs text-muted-foreground">عند التفعيل لن يظهر هذا العنصر في الصفحة.</p>
                </div>
                <Switch checked={item.hideDonation} onCheckedChange={(checked) => updateItemField(index, "hideDonation", checked)} />
              </div>

              {item.donationMethod === "shares" ? (
                <div className="space-y-2 text-right">
                  <Label htmlFor={`${sectionKey}-share-unit-${item.id}`}>قيمة السهم</Label>
                  <Input id={`${sectionKey}-share-unit-${item.id}`} type="number" min={1} value={item.shareUnitAmount} onChange={(event) => updateItemField(index, "shareUnitAmount", Number(event.target.value) || 1)} />
                </div>
              ) : (
                <div className="space-y-2 text-right">
                  <Label htmlFor={`${sectionKey}-default-amount-${item.id}`}>القيمة الافتراضية</Label>
                  <Input id={`${sectionKey}-default-amount-${item.id}`} type="number" min={1} value={item.defaultAmount} onChange={(event) => updateItemField(index, "defaultAmount", Number(event.target.value) || 1)} />
                </div>
              )}

              {item.donationMethod !== "open_unrestricted" ? (
                <div className="space-y-2 text-right">
                  <Label htmlFor={`${sectionKey}-min-amount-${item.id}`}>الحد الأدنى</Label>
                  <Input id={`${sectionKey}-min-amount-${item.id}`} type="number" min={0} value={item.minAmount} onChange={(event) => updateItemField(index, "minAmount", Number(event.target.value) || 0)} />
                </div>
              ) : null}

              {item.donationMethod === "open_restricted" ? (
                <>
                  <div className="space-y-2 text-right">
                    <Label htmlFor={`${sectionKey}-max-amount-${item.id}`}>الحد الأعلى</Label>
                    <Input id={`${sectionKey}-max-amount-${item.id}`} type="number" min={item.minAmount || 0} value={item.maxAmount ?? item.minAmount} onChange={(event) => updateItemField(index, "maxAmount", Number(event.target.value) || item.minAmount)} />
                  </div>
                  <div className="space-y-2 text-right">
                    <Label htmlFor={`${sectionKey}-collected-amount-${item.id}`}>المبلغ المحصل</Label>
                    <Input id={`${sectionKey}-collected-amount-${item.id}`} type="number" min={0} value={item.collectedAmount} onChange={(event) => updateItemField(index, "collectedAmount", Number(event.target.value) || 0)} />
                  </div>
                </>
              ) : null}

              <div className="space-y-2 text-right">
                <Label htmlFor={`${sectionKey}-total-amount-${item.id}`}>إجمالي المبلغ</Label>
                <Input id={`${sectionKey}-total-amount-${item.id}`} type="number" min={0} value={item.totalAmount} onChange={(event) => updateItemField(index, "totalAmount", Number(event.target.value) || 0)} />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 md:mt-7">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">إخفاء إجمالي المبلغ</p>
                  <p className="text-xs text-muted-foreground">سيختفي الرقم من البطاقة والنافذة مع بقاء المنطق محفوظاً.</p>
                </div>
                <Switch checked={item.hideTotalAmount} onCheckedChange={(checked) => updateItemField(index, "hideTotalAmount", checked)} />
              </div>

              <div className="space-y-2 text-right md:col-span-2">
                <Label htmlFor={`${sectionKey}-description-${item.id}`}>الوصف المختصر</Label>
                <Textarea id={`${sectionKey}-description-${item.id}`} rows={4} value={item.description} onChange={(event) => updateItemField(index, "description", event.target.value)} />
                <p className="text-xs text-muted-foreground">يستخدم هذا الوصف في البطاقة وفي صفحة التفاصيل لهذا {itemLabel}.</p>
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-border/60 bg-muted/10 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="text-right">
                  <h4 className="font-semibold text-foreground">مسميات الدعم</h4>
                  <p className="text-sm text-muted-foreground">
                    {item.donationMethod === "shares" ? "أضف عدد الأسهم لكل مسمى وسيتم احتساب المبلغ تلقائياً." : "أضف مسميات جاهزة لتظهر في نافذة الدعم مع مبالغها المقترحة."}
                  </p>
                </div>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => addLabel(index)}>
                  <Plus className="h-4 w-4" />
                  إضافة مسمى
                </Button>
              </div>

              <div className="space-y-3">
                {item.labels.map((label, labelIndex) => (
                  <div key={label.id} className="grid gap-3 rounded-2xl border border-border/60 bg-white/70 p-4 md:grid-cols-[1fr_180px_180px_auto]">
                    <div className="space-y-2 text-right">
                      <Label htmlFor={`${sectionKey}-label-name-${item.id}-${label.id}`}>المسمى</Label>
                      <Input id={`${sectionKey}-label-name-${item.id}-${label.id}`} value={label.label} onChange={(event) => updateLabelField(index, labelIndex, "label", event.target.value)} />
                    </div>
                    {item.donationMethod === "shares" ? (
                      <div className="space-y-2 text-right">
                        <Label htmlFor={`${sectionKey}-label-shares-${item.id}-${label.id}`}>عدد الأسهم</Label>
                        <Input id={`${sectionKey}-label-shares-${item.id}-${label.id}`} type="number" min={1} value={label.sharesCount} onChange={(event) => updateLabelField(index, labelIndex, "sharesCount", Number(event.target.value) || 1)} />
                      </div>
                    ) : (
                      <div className="space-y-2 text-right">
                        <Label htmlFor={`${sectionKey}-label-amount-${item.id}-${label.id}`}>المبلغ المقترح</Label>
                        <Input id={`${sectionKey}-label-amount-${item.id}-${label.id}`} type="number" min={1} value={label.amount} onChange={(event) => updateLabelField(index, labelIndex, "amount", Number(event.target.value) || 1)} />
                      </div>
                    )}
                    <div className="space-y-2 text-right">
                      <Label htmlFor={`${sectionKey}-label-calculated-${item.id}-${label.id}`}>القيمة النهائية</Label>
                      <Input id={`${sectionKey}-label-calculated-${item.id}-${label.id}`} value={label.amount} disabled />
                    </div>
                    <div className="flex items-end justify-end">
                      <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeLabel(index, label.id)}>
                        <Trash2 className="h-4 w-4" />
                        حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">حفظ التعديلات</p>
          <p className="text-sm text-muted-foreground">{saveHint}</p>
        </div>
        <div className="flex items-center gap-3">
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button>
        </div>
      </div>
    </section>
  )
}
