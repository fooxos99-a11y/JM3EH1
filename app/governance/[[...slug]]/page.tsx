import { notFound } from "next/navigation"

import { GovernanceSectionPage } from "@/components/governance-page"
import { getGovernancePageByPath } from "@/lib/governance"
import { getSiteSectionContent } from "@/lib/site-content"

type GovernanceRoutePageProps = {
  params: Promise<{ slug?: string[] }>
}

export default async function GovernanceRoutePage({ params }: GovernanceRoutePageProps) {
  const { slug } = await params

  if (!slug || slug.length === 0) {
    notFound()
  }

  const definition = getGovernancePageByPath(slug)

  if (!definition) {
    notFound()
  }

  const content = await getSiteSectionContent(definition.sectionKey)

  return <GovernanceSectionPage definition={definition} content={content} />
}