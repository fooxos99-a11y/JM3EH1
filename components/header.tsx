import { getSiteSectionContent, type SiteContentMap } from "@/lib/site-content"

import { HeaderClient } from "@/components/header-client"

export async function Header({ logo }: { logo?: SiteContentMap["logo"] } = {}) {
  const resolvedLogo = logo ?? await getSiteSectionContent("logo")

  return <HeaderClient logo={resolvedLogo} />
}
