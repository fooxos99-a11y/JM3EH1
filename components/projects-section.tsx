import { DonationCardsClient } from "@/components/donation-cards-client"
import { getSiteSectionContent, type SiteContentMap } from "@/lib/site-content"

export async function ProjectsSection({ content }: { content?: SiteContentMap["projects"] } = {}) {
  const resolvedContent = content ?? await getSiteSectionContent("projects")

  return (
    <DonationCardsClient
      content={resolvedContent}
      contentType="projects"
      sectionId="projects"
      emptyTitle="لا توجد مشاريع ظاهرة حالياً"
      emptyDescription="يمكنك إظهار المشاريع من لوحة التحكم عند الحاجة."
      dialogDescription="اختر المسمى المناسب وحدد مبلغ الدعم حسب آلية المشروع المتاحة."
      totalLabel="إجمالي المشروع"
    />
  )
}
