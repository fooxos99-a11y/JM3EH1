import { AboutSectionClient } from "@/components/about-section-client"
import { getSiteSectionContent } from "@/lib/site-content"

export async function AboutSection() {
  const content = await getSiteSectionContent("about")

  return <AboutSectionClient content={content} />
}
