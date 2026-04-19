"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { FundraisingPaymentDialog } from "@/components/fundraising-payment-dialog"
import { toast } from "@/hooks/use-toast"
import type { DonationItem, DonationsContent } from "@/lib/site-content"
import { getDetailHref, saveCartEntry, type FundraisingContentType } from "@/lib/fundraising-cart"

type DonationCardsClientProps = {
  content: DonationsContent
  contentType: FundraisingContentType
  sectionId?: string
  emptyTitle?: string
  emptyDescription?: string
  dialogDescription?: string
  totalLabel?: string
}


export function DonationCardsClient({
  content,
  contentType,
  sectionId = "donation",
  emptyTitle = "لا توجد عناصر ظاهرة حالياً",
  emptyDescription = "يمكنك إظهار العناصر من لوحة التحكم عند الحاجة.",
  dialogDescription = "اختر المسمى المناسب وحدد مبلغ الدعم حسب الطريقة المتاحة.",
  totalLabel = "إجمالي المبلغ",
}: DonationCardsClientProps) {
  const router = useRouter()
  const donations = useMemo(() => content.items.filter((item) => !item.hideDonation), [content.items])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [cardsPerView, setCardsPerView] = useState(3)

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

  function handleCardNavigation(itemId: number) {
    router.push(getDetailHref(contentType, itemId))
  }

  function handleAddToCart(item: DonationItem) {
    const isSaved = saveCartEntry(contentType, item)

    toast({
      title: isSaved ? "تمت إضافة العنصر إلى السلة" : "تعذر إضافة العنصر إلى السلة",
      description: isSaved ? item.title : "حدثت مشكلة أثناء حفظ السلة في المتصفح.",
      variant: isSaved ? "default" : "destructive",
    })
  }

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
                        <div
                          role="link"
                          tabIndex={0}
                          onClick={() => handleCardNavigation(donation.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              handleCardNavigation(donation.id)
                            }
                          }}
                          className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,var(--primary),color-mix(in_srbg,var(--primary)_82%,white))] shadow-xl transition-all duration-500 hover:-translate-y-1.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          <div className="relative h-40 overflow-hidden">
                            <img src={donation.image} alt={donation.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-primary/85 to-transparent" />
                            <div className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                              {donation.badge}
                            </div>
                          </div>

                          <div className="flex flex-1 flex-col p-5 text-white">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h3 className="text-lg font-bold leading-7">{donation.title}</h3>
                            </div>

                            <p className="mb-3 text-sm leading-6 text-white/80 line-clamp-2">{donation.description}</p>

                            <div className="mb-3 grid gap-2 rounded-xl bg-white/10 p-2.5 text-xs backdrop-blur-sm">
                              {!donation.hideTotalAmount && donation.totalAmount > 0 ? (
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-white/75">{totalLabel}</span>
                                  <span className="font-semibold">{donation.totalAmount} ريال</span>
                                </div>
                              ) : null}
                            </div>

                            <div className="mb-4 flex flex-wrap gap-2.5">
                              {donation.labels.slice(0, 2).map((label) => (
                                <span
                                  key={label.id}
                                  className="rounded-2xl border border-white/25 bg-white/12 px-3 py-2 text-xs font-semibold text-white transition-all duration-300 hover:scale-[1.03] hover:bg-white hover:text-primary"
                                >
                                  {label.label}
                                </span>
                              ))}
                            </div>

                            <div className="mt-auto grid grid-cols-2 gap-2.5">
                              <div onClick={(event) => event.stopPropagation()}>
                                <FundraisingPaymentDialog
                                  item={donation}
                                  dialogDescription={dialogDescription}
                                  triggerLabel={donation.buttonLabel}
                                  triggerClassName="group/btn h-10 rounded-xl bg-white text-primary transition-all duration-300 hover:scale-[1.02] hover:bg-white/90"
                                  fullWidthTrigger
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 rounded-xl border-white/35 bg-white/12 text-white transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:text-primary"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  handleAddToCart(donation)
                                }}
                              >
                                <ShoppingCart className="h-4 w-4" />
                                أضف للسلة
                              </Button>
                            </div>
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
    </section>
  )
}