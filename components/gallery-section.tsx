import { GallerySectionClient } from "@/components/gallery-section-client"
import { getSiteSectionContent } from "@/lib/site-content"

export async function GallerySection() {
  const content = await getSiteSectionContent("gallery")

  return <GallerySectionClient content={content} />
}
