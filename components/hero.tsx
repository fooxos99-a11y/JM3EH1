import { HeroClient } from "@/components/hero-client"
import { getSiteSectionContent, type SiteContentMap } from "@/lib/site-content"

export async function Hero({ content }: { content?: SiteContentMap["hero"] } = {}) {
  const resolvedContent = content ?? await getSiteSectionContent("hero")

  return <HeroClient content={resolvedContent} />
}
