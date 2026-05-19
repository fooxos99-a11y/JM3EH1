import { AchievementsSectionClient } from "@/components/achievements-section-client"
import { getSiteSectionContent } from "@/lib/site-content"

export async function AchievementsSection() {
  const content = await getSiteSectionContent("achievements")

  return <AchievementsSectionClient content={content} />
}
