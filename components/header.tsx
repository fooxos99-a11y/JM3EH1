import { getSiteSectionContent } from "@/lib/site-content"

import { HeaderClient } from "@/components/header-client"

export async function Header() {
  const logo = await getSiteSectionContent("logo")

  return <HeaderClient logo={logo} />
}
