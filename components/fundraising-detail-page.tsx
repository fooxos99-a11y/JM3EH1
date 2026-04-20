import Link from "next/link"
import { ArrowLeft, ChevronLeft, ShoppingCart } from "lucide-react"
import { notFound } from "next/navigation"

import { FundraisingPaymentDialog } from "@/components/fundraising-payment-dialog"
import { Button } from "@/components/ui/button"
import { getSiteSectionContent } from "@/lib/site-content"

type FundraisingDetailPageProps = {
  contentType: "donations" | "projects"
  itemId: number
}

const detailMeta = {
  donations: {
    sectionTitle: "فرص التبرع",
    sectionAnchor: "donation",
    backLabel: "العودة إلى فرص التبرع",
  },
  projects: {
    sectionTitle: "المشاريع",
    sectionAnchor: "projects",
    backLabel: "العودة إلى المشاريع",
  },
} as const

export async function FundraisingDetailPage({ contentType, itemId }: FundraisingDetailPageProps) {
  if (!Number.isFinite(itemId)) {
    notFound()
  }

  const content = await getSiteSectionContent(contentType)
  const item = content.items.find((entry) => entry.id === itemId && !entry.hideDonation)

  if (!item) {
    notFound()
  }

  const meta = detailMeta[contentType]
  const dialogDescription = contentType === "donations"
    ? "اختر المسمى المناسب وحدد مبلغ التبرع حسب طريقة الدعم المتاحة لهذه الفرصة."
    : "اختر المسمى المناسب وحدد مبلغ الدعم حسب آلية المشروع المتاحة."
  const accentLabel = contentType === "donations" ? "فرصة تبرع" : "مشروع"

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#e8f8f7_0%,#f7fbfb_38%,#eef6f6_100%)] py-10 md:py-14">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href={`/#${meta.sectionAnchor}`}>
                <ArrowLeft className="h-4 w-4" />
                {meta.backLabel}
              </Link>
            </Button>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{meta.sectionTitle}</span>
              <ChevronLeft className="h-4 w-4" />
              <span>{item.title}</span>
            </div>
          </div>

          <section className="overflow-hidden rounded-[2.25rem] border border-white/90 bg-white/95 shadow-[0_28px_80px_rgba(15,23,42,0.10)]">
            <div className="relative h-[300px] overflow-hidden md:h-[460px]">
              <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#072b2a]/88 via-[#0f766e]/40 to-transparent" />
              <div className="absolute right-5 top-5 rounded-full bg-white/92 px-4 py-2 text-sm font-semibold text-primary shadow-sm">
                {item.badge}
              </div>
              <div className="absolute inset-x-0 bottom-0 p-6 text-white md:p-8">
                <p className="mb-3 inline-flex rounded-full border border-white/20 bg-black/15 px-4 py-2 text-xs font-bold backdrop-blur-sm">{accentLabel}</p>
                <h1 className="max-w-3xl text-3xl font-bold leading-[1.5] md:text-4xl">{item.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/90 md:text-base">{item.description}</p>
              </div>
            </div>

            <div className="px-5 py-6 text-right md:px-8 md:py-8">
              <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
                <div className="rounded-[1.75rem] border border-border/60 bg-[linear-gradient(180deg,#ffffff_0%,#f6fbfb_100%)] p-6">
                  <h2 className="text-lg font-bold text-foreground">نبذة عن {contentType === "donations" ? "فرصة التبرع" : "المشروع"}</h2>
                  <p className="mt-4 text-sm leading-8 text-muted-foreground md:text-base">
                    {item.description}
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-primary/10 bg-[linear-gradient(180deg,#ffffff_0%,#f6fbfb_100%)] p-5 shadow-sm">
                  <div className="grid grid-cols-1 gap-3">
                    <FundraisingPaymentDialog item={item} dialogDescription={dialogDescription} triggerLabel={item.buttonLabel} triggerClassName="group/btn h-11 rounded-2xl border-0 bg-primary text-white shadow-sm transition-all duration-300 hover:scale-[1.02] hover:bg-[#017f7c]" fullWidthTrigger />
                    <Button asChild variant="outline" className="h-11 rounded-2xl border-primary/15 bg-white text-foreground transition-all duration-300 hover:scale-[1.02] hover:border-primary/35 hover:bg-primary/5 hover:text-primary">
                      <Link href="/cart">
                        <ShoppingCart className="h-4 w-4" />
                        عرض السلة
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}