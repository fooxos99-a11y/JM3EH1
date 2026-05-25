import { AboutSectionClient } from "@/components/about-section-client"
import { getSiteSectionContent, type SiteContentMap } from "@/lib/site-content"

export async function AboutSection({ content }: { content?: SiteContentMap["about"] } = {}) {
  const resolvedContent = content ?? await getSiteSectionContent("about")

  return <AboutSectionClient content={resolvedContent} />
}
