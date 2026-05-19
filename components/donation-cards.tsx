import { DonationCardsClient } from "@/components/donation-cards-client"
import { getSiteSectionContent } from "@/lib/site-content"

export async function DonationCards() {
  const content = await getSiteSectionContent("donations")

  return (
    <DonationCardsClient
      content={content}
      contentType="donations"
      sectionId="donation"
      emptyTitle="لا توجد فرص تبرع ظاهرة حالياً"
      emptyDescription="يمكنك إظهار الفرص من لوحة التحكم عند الحاجة."
      dialogDescription="اختر المسمى المناسب وحدد مبلغ التبرع حسب طريقة الدعم المتاحة لهذه الفرصة."
      totalLabel="إجمالي الفرصة"
    />
  )
}
