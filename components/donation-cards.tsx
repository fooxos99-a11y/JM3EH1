import { DonationCardsClient } from "@/components/donation-cards-client"
import { getSiteSectionContent, type SiteContentMap } from "@/lib/site-content"

export async function DonationCards({ content }: { content?: SiteContentMap["donations"] } = {}) {
  const resolvedContent = content ?? await getSiteSectionContent("donations")

  return (
    <DonationCardsClient
      content={resolvedContent}
      contentType="donations"
      sectionId="donation"
      emptyTitle="لا توجد فرص تبرع ظاهرة حالياً"
      emptyDescription="يمكنك إظهار الفرص من لوحة التحكم عند الحاجة."
      dialogDescription="اختر المسمى المناسب وحدد مبلغ التبرع حسب طريقة الدعم المتاحة لهذه الفرصة."
      totalLabel="إجمالي الفرصة"
    />
  )
}
