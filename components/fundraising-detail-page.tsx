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
              <div className="mb-6 grid gap-4 border-b border-border/60 pb-6 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-primary/10 bg-primary/[0.05] px-5 py-4">
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
                <div className="rounded-[1.5rem] border border-border/60 bg-[#f8fbfb] px-5 py-4">
                  <p className="text-sm font-semibold text-foreground">آلية الدعم</p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{dialogDescription}</p>
                </div>
                <div className="rounded-[1.5rem] border border-border/60 bg-[#f8fbfb] px-5 py-4">
                  <p className="text-sm font-semibold text-foreground">التحديث من لوحة التحكم</p>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">الصورة والعنوان والوصف وخيارات المبلغ مترابطة مباشرة مع لوحة التحكم.</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
                <div className="rounded-[1.75rem] border border-border/60 bg-[linear-gradient(180deg,#ffffff_0%,#f6fbfb_100%)] p-6">
                  <h2 className="text-lg font-bold text-foreground">نبذة عن {contentType === "donations" ? "فرصة التبرع" : "المشروع"}</h2>
                  <p className="mt-4 text-sm leading-8 text-muted-foreground md:text-base">
                    {item.description}
                  </p>
                </div>

                <div className="rounded-[1.75rem] border border-primary/10 bg-[linear-gradient(180deg,#0f766e_0%,#0c4f4d_100%)] p-5 text-white shadow-sm">
                  <h2 className="text-lg font-bold text-foreground">خيارات سريعة</h2>
                  <p className="mt-2 text-sm leading-7 text-white/80">
                    يمكنك تعديل الصورة والاسم والوصف من لوحة التحكم، وسيتم تحديث هذه الصفحة مباشرة بعد الحفظ.
                  </p>
                  <div className="mt-5 space-y-3">
                    <FundraisingPaymentDialog item={item} dialogDescription={dialogDescription} triggerLabel={item.buttonLabel} triggerClassName="h-11 w-full rounded-2xl border-0 bg-white text-primary hover:bg-[#f4fffe]" fullWidthTrigger />
                    <Button asChild variant="outline" className="h-11 w-full rounded-2xl border-white/20 bg-black/10 text-white hover:bg-white/10 hover:text-white">
                      <Link href="/cart">
                        <ShoppingCart className="h-4 w-4" />
                        عرض السلة
                      </Link>
                    </Button>
                  </div>
                  <div className="mt-5 space-y-3">
                    {item.labels.slice(0, 3).map((label) => (
                      <div key={label.id} className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold text-white">{label.amount} ريال</span>
                          <span className="text-white/75">{label.label}</span>
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