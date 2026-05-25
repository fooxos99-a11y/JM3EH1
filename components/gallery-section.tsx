import { GallerySectionClient } from "@/components/gallery-section-client"
import { getSiteSectionContent, type SiteContentMap } from "@/lib/site-content"

export async function GallerySection({ content }: { content?: SiteContentMap["gallery"] } = {}) {
  const resolvedContent = content ?? await getSiteSectionContent("gallery")

  return <GallerySectionClient content={resolvedContent} />
}
