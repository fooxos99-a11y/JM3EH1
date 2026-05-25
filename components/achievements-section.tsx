import { AchievementsSectionClient } from "@/components/achievements-section-client"
import { getSiteSectionContent, type SiteContentMap } from "@/lib/site-content"

export async function AchievementsSection({ content }: { content?: SiteContentMap["achievements"] } = {}) {
  const resolvedContent = content ?? await getSiteSectionContent("achievements")

  return <AchievementsSectionClient content={resolvedContent} />
}
