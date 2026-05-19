import { HeroClient } from "@/components/hero-client"
import { getSiteSectionContent } from "@/lib/site-content"

export async function Hero() {
  const content = await getSiteSectionContent("hero")

  return <HeroClient content={content} />
}
