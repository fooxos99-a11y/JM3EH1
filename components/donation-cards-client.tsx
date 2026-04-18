"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { DonationItem, DonationMethod, DonationsContent } from "@/lib/site-content"

type DonationCardsClientProps = {
  content: DonationsContent
  sectionId?: string
  emptyTitle?: string
  emptyDescription?: string
  dialogDescription?: string
  totalLabel?: string
}

function clampOpenAmount(item: DonationItem, amount: number) {
  if (item.donationMethod === "open_unrestricted") {
    return Math.max(0, amount)
  }

  const minAmount = Math.max(0, item.minAmount)
  const maxAmount = item.maxAmount ?? amount
  return Math.min(Math.max(amount, minAmount), Math.max(minAmount, maxAmount))
}

function getInitialAmount(item: DonationItem) {
  const firstLabel = item.labels[0]

  if (item.donationMethod === "shares") {
    return String(firstLabel?.amount ?? item.amount ?? item.shareUnitAmount)
  }

  return String(item.defaultAmount || firstLabel?.amount || item.minAmount || item.amount || "")
}

export function DonationCardsClient({
  content,
  sectionId = "donation",
  emptyTitle = "لا توجد عناصر ظاهرة حالياً",
  emptyDescription = "يمكنك إظهار العناصر من لوحة التحكم عند الحاجة.",
  dialogDescription = "اختر المسمى المناسب وحدد مبلغ الدعم حسب الطريقة المتاحة.",
  totalLabel = "إجمالي المبلغ",
}: DonationCardsClientProps) {
  const donations = useMemo(() => content.items.filter((item) => !item.hideDonation), [content.items])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [cardsPerView, setCardsPerView] = useState(3)
  const [activeDonationId, setActiveDonationId] = useState<number | null>(null)
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null)
  const [donationAmount, setDonationAmount] = useState("")

  const activeDonation = useMemo(
    () => donations.find((item) => item.id === activeDonationId) ?? null,
    [activeDonationId, donations],
  )

  const selectedLabel = activeDonation?.labels.find((label) => label.id === selectedLabelId) ?? activeDonation?.labels[0] ?? null

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

  const maxIndex = Math.max(0, donations.length - cardsPerView)

  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(maxIndex)
    }
  }, [currentIndex, maxIndex])

  function handlePrev() {
    if (isAnimating || currentIndex === 0) return
    setIsAnimating(true)
    setCurrentIndex((prev) => prev - 1)
    setTimeout(() => setIsAnimating(false), 500)
  }

  function handleNext() {
    if (isAnimating || currentIndex >= maxIndex) return
    setIsAnimating(true)
    setCurrentIndex((prev) => prev + 1)
    setTimeout(() => setIsAnimating(false), 500)
  }

  function openDonationDialog(item: DonationItem, preferredLabelId?: number | null) {
    const defaultLabel = item.labels.find((label) => label.id === preferredLabelId) ?? item.labels[0] ?? null
    setActiveDonationId(item.id)
    setSelectedLabelId(defaultLabel?.id ?? null)
    if (item.donationMethod === "shares") {
      setDonationAmount(String(defaultLabel?.amount ?? getInitialAmount(item)))
      return
    }

    setDonationAmount(String(defaultLabel?.amount || item.defaultAmount || item.minAmount || item.amount || getInitialAmount(item)))
  }

  function handleLabelChange(labelId: string) {
    if (!activeDonation) return

    const nextLabelId = Number(labelId)
    const label = activeDonation.labels.find((entry) => entry.id === nextLabelId)
    setSelectedLabelId(nextLabelId)

    if (!label) return

    if (activeDonation.donationMethod === "shares") {
      setDonationAmount(String(label.amount))
      return
    }

    setDonationAmount(String(label.amount || activeDonation.defaultAmount || activeDonation.minAmount || 0))
  }

  const numericAmount = activeDonation
    ? activeDonation.donationMethod === "shares"
      ? ((selectedLabel?.amount ?? Number(donationAmount)) || 0)
      : clampOpenAmount(activeDonation, Number(donationAmount) || 0)
    : 0

  return (
    <section id={sectionId} className="relative overflow-hidden bg-gradient-to-b from-secondary/30 to-background py-20">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute right-20 top-20 h-40 w-40 rounded-full border-2 border-primary" />
        <div className="absolute bottom-20 left-20 h-60 w-60 rounded-full border-2 border-primary" />
      </div>

      <div className="container relative mx-auto px-4">
        <div className="mb-12 text-center">
          <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">{content.badge}</span>
          <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            {content.title} <span className="text-primary">{content.highlight}</span>
          </h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">{content.description}</p>
        </div>

        {donations.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-border/60 bg-card/70 p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-foreground">{emptyTitle}</p>
            <p className="mt-2 text-sm text-muted-foreground">{emptyDescription}</p>
          </div>
        ) : (
          <>
            <div className="relative">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={`absolute right-0 top-1/2 z-10 h-12 w-12 -translate-y-1/2 -translate-x-4 rounded-full border border-border bg-card shadow-lg transition-all duration-300 hover:border-primary hover:bg-primary hover:text-white ${
                  currentIndex === 0 ? "cursor-not-allowed opacity-50" : "hover:scale-110"
                }`}
              >
                <ChevronRight className="h-6 w-6" />
              </button>

              <button
                onClick={handleNext}
                disabled={currentIndex >= maxIndex}
                className={`absolute left-0 top-1/2 z-10 h-12 w-12 -translate-y-1/2 translate-x-4 rounded-full border border-border bg-card shadow-lg transition-all duration-300 hover:border-primary hover:bg-primary hover:text-white ${
                  currentIndex >= maxIndex ? "cursor-not-allowed opacity-50" : "hover:scale-110"
                }`}
              >
                <ChevronLeft className="h-6 w-6" />
              </button>

              <div className="mx-12 overflow-hidden">
                <div className="flex gap-6 transition-transform duration-500 ease-out" style={{ transform: `translateX(${currentIndex * (100 / cardsPerView)}%)` }}>
                  {donations.map((donation) => {
                    return (
                      <div key={donation.id} className="flex-shrink-0 transition-all duration-500" style={{ width: `calc(${100 / cardsPerView}% - ${(cardsPerView - 1) * 24 / cardsPerView}px)` }}>
                        <div className="group flex h-full flex-col overflow-hidden rounded-3xl bg-primary shadow-xl transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl">
                          <div className="relative h-48 overflow-hidden">
                            <img src={donation.image} alt={donation.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-primary/85 to-transparent" />
                            <div className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                              {donation.badge}
                            </div>
                          </div>

                          <div className="flex flex-1 flex-col p-6 text-white">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h3 className="text-xl font-bold">{donation.title}</h3>
                            </div>

                            <p className="mb-4 text-sm text-white/80 line-clamp-2">{donation.description}</p>

                            <div className="mb-3 grid gap-2 rounded-xl bg-white/10 p-3 text-xs backdrop-blur-sm">
                              {!donation.hideTotalAmount && donation.totalAmount > 0 ? (
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-white/75">{totalLabel}</span>
                                  <span className="font-semibold">{donation.totalAmount} ريال</span>
                                </div>
                              ) : null}
                            </div>

                            <div className="mb-5 flex flex-wrap gap-3">
                              {donation.labels.slice(0, 3).map((label) => (
                                <button
                                  key={label.id}
                                  type="button"
                                  onClick={() => openDonationDialog(donation, label.id)}
                                  className="rounded-2xl border border-white/25 bg-white/12 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:bg-white hover:text-primary"
                                >
                                  {label.label}
                                </button>
                              ))}
                            </div>

                            <Button
                              className="group/btn mt-auto h-12 w-full rounded-xl bg-white text-primary transition-all duration-300 hover:scale-[1.02] hover:bg-white/90"
                              onClick={() => openDonationDialog(donation)}
                            >
                              <ShoppingCart className="ml-2 h-5 w-5 transition-transform group-hover/btn:scale-110" />
                              {donation.buttonLabel}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: maxIndex + 1 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    if (!isAnimating) {
                      setIsAnimating(true)
                      setCurrentIndex(index)
                      setTimeout(() => setIsAnimating(false), 500)
                    }
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${index === currentIndex ? "w-8 bg-primary" : "w-2 bg-primary/30 hover:bg-primary/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={Boolean(activeDonation)} onOpenChange={(open) => !open && setActiveDonationId(null)}>
        {activeDonation ? (
          <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-2xl" showCloseButton={false}>
            <div className="bg-[linear-gradient(135deg,rgba(1,154,151,0.10),rgba(255,255,255,0.98))] p-6">
              <DialogHeader className="items-start text-right">
                <DialogTitle className="text-2xl text-foreground">{activeDonation.title}</DialogTitle>
              </DialogHeader>
            </div>

            <div className="p-6 pt-4">
              <div className="mx-auto max-w-xl rounded-[1.75rem] border border-border/60 bg-card/70 p-6 text-right shadow-sm">
                <p className="text-sm text-muted-foreground">{activeDonation.title}</p>
                <p className="mt-4 text-4xl font-bold text-foreground">{numericAmount} ريال</p>
                <Button className="mt-6 h-12 w-full rounded-2xl" onClick={() => setActiveDonationId(null)}>
                  ادفع الآن
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  )
}