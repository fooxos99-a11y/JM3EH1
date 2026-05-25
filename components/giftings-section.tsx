import { GiftingsClient } from "@/components/giftings-client"
import { getSiteSectionContent, type SiteContentMap } from "@/lib/site-content"

export async function GiftingsSection({ content }: { content?: SiteContentMap["giftings"] } = {}) {
  const resolvedContent = content ?? await getSiteSectionContent("giftings")

  return <GiftingsClient content={resolvedContent} />
}
