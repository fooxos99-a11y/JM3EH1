import { NewsSectionClient } from "@/components/news-section-client"
import { getSiteSectionContent, type SiteContentMap } from "@/lib/site-content"

export async function NewsSection({ content }: { content?: SiteContentMap["news"] } = {}) {
  const resolvedContent = content ?? await getSiteSectionContent("news")

  return <NewsSectionClient content={resolvedContent} />
}
