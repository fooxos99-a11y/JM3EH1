import { DonationCardsClient } from "@/components/donation-cards-client"
import { getSiteSectionContent } from "@/lib/site-content"

export async function ProjectsSection() {
  const content = await getSiteSectionContent("projects")

  return (
    <DonationCardsClient
      content={content}
      sectionId="projects"
      emptyTitle="لا توجد مشاريع ظاهرة حالياً"
      emptyDescription="يمكنك إظهار المشاريع من لوحة التحكم عند الحاجة."
      dialogDescription="اختر المسمى المناسب وحدد مبلغ الدعم حسب آلية المشروع المتاحة."
      totalLabel="إجمالي المشروع"
    />
  )
}
