import { GiftingsClient } from "@/components/giftings-client"
import { getSiteSectionContent } from "@/lib/site-content"

export async function GiftingsSection() {
  const content = await getSiteSectionContent("giftings")

  return <GiftingsClient content={content} />
}
