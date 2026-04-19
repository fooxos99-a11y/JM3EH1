import Link from "next/link"
import { ArrowLeft, BadgeInfo, ChevronLeft, ShoppingCart } from "lucide-react"
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

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb,#eef6f6)] py-10 md:py-14">
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

          <section className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/95 shadow-[0_25px_65px_rgba(15,23,42,0.08)]">
            <div className="relative h-[260px] overflow-hidden md:h-[420px]">
              <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
              <div className="absolute right-5 top-5 rounded-full bg-white/88 px-4 py-2 text-sm font-semibold text-primary shadow-sm">
                {item.badge}
              </div>
            </div>

            <div className="px-5 py-6 text-right md:px-8 md:py-8">
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-5">
                <div>
                  <h1 className="text-2xl font-bold leading-10 text-foreground md:text-3xl">{item.title}</h1>
                  <p className="mt-3 max-w-3xl text-base leading-8 text-muted-foreground">{item.description}</p>
                </div>

                <div className="min-w-[220px] rounded-[1.5rem] bg-primary/6 px-5 py-4">
                  <div className="flex items-center justify-end gap-2 text-primary">
                    <BadgeInfo className="h-4 w-4" />
                    <span className="text-sm font-semibold">معلومات مختصرة</span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    {!item.hideTotalAmount && item.totalAmount > 0 ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-foreground">{item.totalAmount} ريال</span>
                        <span className="text-muted-foreground">الإجمالي</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-foreground">{item.labels.length}</span>
                      <span className="text-muted-foreground">خيارات الدعم</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
                <div className="rounded-[1.75rem] border border-border/60 bg-muted/10 p-5">
                  <h2 className="text-lg font-bold text-foreground">نبذة عن {contentType === "donations" ? "فرصة التبرع" : "المشروع"}</h2>
                  <p className="mt-4 text-sm leading-8 text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-border/60 bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-foreground">خيارات سريعة</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    يمكنك تعديل الصورة والاسم والوصف من لوحة التحكم، وسيتم تحديث هذه الصفحة مباشرة بعد الحفظ.
                  </p>
                  <div className="mt-5 space-y-3">
                    <FundraisingPaymentDialog item={item} dialogDescription={dialogDescription} triggerLabel={item.buttonLabel} triggerClassName="h-11 w-full rounded-2xl" fullWidthTrigger />
                    <Button asChild variant="outline" className="h-11 w-full rounded-2xl">
                      <Link href="/cart">
                        <ShoppingCart className="h-4 w-4" />
                        عرض السلة
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-5 space-y-3">
                    {item.labels.slice(0, 3).map((label) => (
                      <div key={label.id} className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-foreground">{label.amount} ريال</span>
                          <span className="text-muted-foreground">{label.label}</span>
                        </div>
                      </div>
                    ))}
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