"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Gift, LoaderCircle, MessageSquareHeart, ShoppingBag } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { GiftingItem, GiftingsContent } from "@/lib/site-content"

function clampOpenAmount(item: GiftingItem, amount: number) {
  if (item.donationMethod === "open_unrestricted") {
    return Math.max(0, amount)
  }

  const minAmount = Math.max(0, item.minAmount)
  const maxAmount = item.maxAmount ?? amount
  return Math.min(Math.max(amount, minAmount), Math.max(minAmount, maxAmount))
}

function getInitialAmount(item: GiftingItem) {
  const firstLabel = item.labels[0]

  if (item.donationMethod === "shares") {
    return String(firstLabel?.amount ?? item.amount ?? item.shareUnitAmount)
  }

  return String(item.defaultAmount || firstLabel?.amount || item.minAmount || item.amount || "")
}

type GiftingsClientProps = {
  content: GiftingsContent
}

export function GiftingsClient({ content }: GiftingsClientProps) {
  const items = useMemo(() => content.items.filter((item) => !item.hideDonation), [content.items])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cardsPerView, setCardsPerView] = useState(3)
  const [isAnimating, setIsAnimating] = useState(false)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [donorName, setDonorName] = useState("")
  const [recipientName, setRecipientName] = useState("")
  const [recipientPhone, setRecipientPhone] = useState("")
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeItem = useMemo(() => items.find((item) => item.id === activeId) ?? null, [activeId, items])
  const selectedLabel = activeItem?.labels.find((label) => label.id === selectedLabelId) ?? activeItem?.labels[0] ?? null

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) {
        setCardsPerView(1)
      } else if (window.innerWidth < 1024) {
        setCardsPerView(2)
      } else {
        setCardsPerView(3)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  const maxIndex = Math.max(0, items.length - cardsPerView)

  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(maxIndex)
    }
  }, [currentIndex, maxIndex])

  function openDialog(item: GiftingItem, preferredLabelId?: number | null) {
    setActiveId(item.id)
    const defaultLabel = item.labels.find((label) => label.id === preferredLabelId) ?? item.labels[0] ?? null
    setSelectedLabelId(defaultLabel?.id ?? null)
    if (item.donationMethod === "shares") {
      setAmount(String(defaultLabel?.amount ?? getInitialAmount(item)))
    } else {
      setAmount(String(defaultLabel?.amount || item.defaultAmount || item.minAmount || item.amount || getInitialAmount(item)))
    }
    setDonorName("")
    setRecipientName("")
    setRecipientPhone("")
    setFeedback(null)
  }

  function changeLabel(labelId: string) {
    if (!activeItem) return
    const nextId = Number(labelId)
    const label = activeItem.labels.find((entry) => entry.id === nextId)
    setSelectedLabelId(nextId)

    if (!label) return

    if (activeItem.donationMethod === "shares") {
      setAmount(String(label.amount))
      return
    }

    setAmount(String(label.amount || activeItem.defaultAmount || activeItem.minAmount || 0))
  }

  async function handleSubmit() {
    if (!activeItem) {
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    const finalAmount = activeItem.donationMethod === "shares"
      ? ((selectedLabel?.amount ?? Number(amount)) || 0)
      : clampOpenAmount(activeItem, Number(amount) || 0)

    try {
      const response = await fetch("/api/giftings/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: activeItem.id,
          donorName,
          recipientName,
          recipientPhone,
          labelId: selectedLabel?.id ?? null,
          amount: finalAmount,
        }),
      })
      const payload = (await response.json()) as { error?: string; message?: string }

      if (!response.ok) {
        setFeedback(payload.error ?? "تعذر حفظ الإهداء")
        return
      }

      setFeedback(payload.message ?? activeItem.confirmationMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  const numericAmount = activeItem
    ? activeItem.donationMethod === "shares"
      ? ((selectedLabel?.amount ?? Number(amount)) || 0)
      : clampOpenAmount(activeItem, Number(amount) || 0)
    : 0

  return (
    <section id="giftings" className="relative overflow-hidden bg-gradient-to-b from-background to-secondary/20 py-20">
      <div className="container relative mx-auto px-4">
        <div className="mb-12 text-center">
          <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">{content.badge}</span>
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">{content.title} <span className="text-primary">{content.highlight}</span></h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">{content.description}</p>
        </div>

        <div className="relative">
          <button onClick={() => { if (!isAnimating && currentIndex > 0) { setIsAnimating(true); setCurrentIndex((value) => value - 1); setTimeout(() => setIsAnimating(false), 500) } }} disabled={currentIndex === 0} className="absolute right-0 top-1/2 z-10 h-12 w-12 -translate-y-1/2 -translate-x-4 rounded-full border border-border bg-card shadow-lg disabled:opacity-50">
            <ChevronRight className="h-6 w-6" />
          </button>
          <button onClick={() => { if (!isAnimating && currentIndex < maxIndex) { setIsAnimating(true); setCurrentIndex((value) => value + 1); setTimeout(() => setIsAnimating(false), 500) } }} disabled={currentIndex >= maxIndex} className="absolute left-0 top-1/2 z-10 h-12 w-12 -translate-y-1/2 translate-x-4 rounded-full border border-border bg-card shadow-lg disabled:opacity-50">
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="mx-12 overflow-hidden">
            <div className="flex gap-6 transition-transform duration-500 ease-out" style={{ transform: `translateX(${currentIndex * (100 / cardsPerView)}%)` }}>
              {items.map((item) => {
                return (
                  <div key={item.id} className="flex-shrink-0" style={{ width: `calc(${100 / cardsPerView}% - ${(cardsPerView - 1) * 24 / cardsPerView}px)` }}>
                    <div className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
                      <div className="relative h-56 overflow-hidden">
                        <img src={item.image} alt={item.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">{item.badge}</div>
                      </div>
                      <div className="flex flex-1 flex-col p-6 text-right">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
                          <Gift className="h-5 w-5 text-primary" />
                        </div>
                        <p className="mb-4 text-sm text-muted-foreground">{item.description}</p>
                        {!item.hideTotalAmount && item.totalAmount > 0 ? (
                          <div className="mb-4 rounded-2xl bg-muted/20 p-4 text-xs text-muted-foreground">
                            <div className="flex items-center justify-between gap-3">
                              <span>إجمالي المبلغ</span>
                              <span className="font-semibold text-foreground">{item.totalAmount} ريال</span>
                            </div>
                          </div>
                        ) : null}
                        <div className="mb-5 flex flex-wrap gap-3">
                          {item.labels.slice(0, 3).map((label) => (
                            <button
                              key={label.id}
                              type="button"
                              onClick={() => openDialog(item, label.id)}
                              className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-2.5 text-sm font-semibold text-foreground transition-all duration-300 hover:scale-[1.03] hover:border-primary hover:bg-primary hover:text-white"
                            >
                              {label.label}
                            </button>
                          ))}
                        </div>
                        <Button className="mt-auto h-12 w-full rounded-xl" onClick={() => openDialog(item)}>
                          <ShoppingBag className="ml-2 h-5 w-5" />
                          {item.buttonLabel}
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(activeItem)} onOpenChange={(open) => !open && setActiveId(null)}>
        {activeItem ? (
          <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-4xl" showCloseButton={false}>
            <div className="bg-[linear-gradient(135deg,rgba(1,154,151,0.10),rgba(255,255,255,0.98))] p-6">
              <DialogHeader className="items-start text-right">
                <DialogTitle className="text-2xl text-foreground">{activeItem.title}</DialogTitle>
                <DialogDescription className="text-right text-sm leading-7 text-muted-foreground">{content.dialogDescription}</DialogDescription>
              </DialogHeader>
            </div>

            <div className="grid gap-6 p-6 pt-4 md:grid-cols-[1fr_1fr]">
              <div className="space-y-4 text-right">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">المسمى</label>
                  <Select value={String(selectedLabel?.id ?? "")} onValueChange={changeLabel}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="اختر مسمى الإهداء" /></SelectTrigger>
                    <SelectContent>
                      {activeItem.labels.map((label) => <SelectItem key={label.id} value={String(label.id)}>{label.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">المبلغ</label>
                  <Input type="number" value={activeItem.donationMethod === "shares" ? selectedLabel?.amount ?? amount : amount} disabled={activeItem.donationMethod === "shares"} onChange={(event) => setAmount(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{content.senderNameLabel}</label>
                  <Input value={donorName} onChange={(event) => setDonorName(event.target.value)} placeholder={content.senderNamePlaceholder} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{content.recipientNameLabel}</label>
                  <Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder={content.recipientNamePlaceholder} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">{content.recipientPhoneLabel}</label>
                  <Input dir="ltr" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder={content.recipientPhonePlaceholder} />
                  <p className="text-xs text-muted-foreground">{content.smsHelperText}</p>
                </div>
                {feedback ? <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">{feedback}</div> : null}
                <Button className="h-12 w-full rounded-2xl" disabled={isSubmitting} onClick={handleSubmit}>{isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <MessageSquareHeart className="ml-2 h-5 w-5" />}{content.submitButtonLabel} {numericAmount} ريال</Button>
              </div>

              <div className="space-y-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{content.previewTitle}</p>
                </div>
                <div className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-card shadow-sm">
                  <img src={activeItem.image} alt={activeItem.title} className="aspect-[4/5] w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                  <div className="absolute" style={{ left: `${activeItem.senderPlacement.x}%`, top: `${activeItem.senderPlacement.y}%`, color: activeItem.senderPlacement.color, fontSize: `${activeItem.senderPlacement.fontSize}px`, transform: "translate(-50%, -50%)" }}>
                    <div className="rounded-xl bg-black/20 px-3 py-1 text-center font-bold backdrop-blur-sm">{activeItem.senderPrefix}: {donorName || content.senderNamePlaceholder}</div>
                  </div>
                  <div className="absolute" style={{ left: `${activeItem.recipientPlacement.x}%`, top: `${activeItem.recipientPlacement.y}%`, color: activeItem.recipientPlacement.color, fontSize: `${activeItem.recipientPlacement.fontSize}px`, transform: "translate(-50%, -50%)" }}>
                    <div className="rounded-xl bg-black/20 px-3 py-1 text-center font-bold backdrop-blur-sm">{activeItem.recipientPrefix}: {recipientName || content.recipientNamePlaceholder}</div>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  )
}
