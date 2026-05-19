import { NewsSectionClient } from "@/components/news-section-client"
import { getSiteSectionContent } from "@/lib/site-content"

export async function NewsSection() {
  const content = await getSiteSectionContent("news")

  return <NewsSectionClient content={content} />
}
