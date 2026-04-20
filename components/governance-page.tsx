import Link from "next/link"
import {
  ArrowUpLeft,
  Download,
  Layers3,
  ShieldCheck,
} from "lucide-react"

import { GovernanceMembershipForm } from "@/components/governance-membership-form"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { governanceDownloadSectionKeys, governanceMembersSectionKeys, type GovernancePageDefinition } from "@/lib/governance"
import type { GovernanceContent } from "@/lib/site-content"

export function GovernanceSectionPage({ definition, content }: { definition: GovernancePageDefinition; content: GovernanceContent }) {
  if (definition.sectionKey === "governance_general_assembly_membership") {
    return (
      <main className="bg-[linear-gradient(180deg,#f7fbfb,#eef6f5_42%,#ffffff)] pt-36 pb-24">
        <div className="container mx-auto px-4">
          <GovernanceMembershipForm />
        </div>
      </main>
    )
  }

  const isMembersPage = governanceMembersSectionKeys.includes(definition.sectionKey)
  const isDownloadPage = governanceDownloadSectionKeys.includes(definition.sectionKey)

  return (
    <main className="bg-[linear-gradient(180deg,#f7fbfb,#eef6f5_42%,#ffffff)] pt-36 pb-24">
      <div className="container mx-auto px-4">
        <section>
          {content.items.length > 0 ? (
            <div className={`mx-auto ${isMembersPage ? "flex max-w-3xl flex-col items-center gap-5" : "flex max-w-3xl flex-col items-center gap-6"}`}>
              {content.items.map((item, index) => (
                <Card
                  key={item.id}
                  className={`animate-fade-in-up w-full rounded-[2rem] border-white/80 bg-white/95 shadow-[0_20px_50px_rgba(15,23,42,0.06)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_26px_60px_rgba(15,23,42,0.1)] ${isMembersPage ? "max-w-2xl text-center" : isDownloadPage ? "max-w-2xl" : "text-center"}`}
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <CardContent className={`px-8 ${isDownloadPage ? "py-6" : "py-10"} ${isMembersPage ? "text-center" : isDownloadPage ? "text-right" : "text-center"}`}>
                    {isMembersPage ? (
                      <div className="space-y-3">
                        <h2 className="text-2xl font-bold text-foreground md:text-3xl">{item.title}</h2>
                        <p className="text-base font-medium text-primary md:text-lg">{item.description}</p>
                      </div>
                    ) : isDownloadPage ? (
                      <div className="flex flex-row-reverse items-center justify-between gap-4">
                        {item.fileUrl ? (
                          <Button asChild size="icon" className="h-12 w-12 rounded-2xl bg-[#11b7b5] text-white shadow-[0_12px_24px_rgba(17,183,181,0.28)] hover:bg-[#0fa5a4] hover:text-white">
                            <Link href={item.fileUrl} target="_blank">
                              <Download className="h-5 w-5" />
                              <span className="sr-only">تحميل</span>
                            </Link>
                          </Button>
                        ) : <span />}
                        <div className="flex-1 text-right">
                          <h2 className="text-2xl font-bold text-foreground">{item.title}</h2>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-center">
                        <h2 className="text-2xl font-bold text-foreground">{item.title}</h2>
                        <p className="max-w-2xl text-base leading-8 text-muted-foreground">{item.description}</p>
                        {item.date ? <p className="text-sm font-medium text-primary/80">{item.date}</p> : null}
                        {item.fileUrl ? (
                          <Button asChild variant="outline" className="mt-2 rounded-2xl px-6">
                            <Link href={item.fileUrl} target="_blank">
                              عرض الملف
                              <ArrowUpLeft className="h-4 w-4" />
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Empty className="rounded-[2rem] border-border/70 bg-white/90 py-20 shadow-[0_18px_45px_rgba(15,23,42,0.04)]">
              <EmptyHeader className="max-w-xl">
                <EmptyMedia variant="icon">
                  {definition.slug.length > 1 ? <Layers3 className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
                </EmptyMedia>
                <EmptyTitle className="text-xl font-bold">لا يوجد بيانات</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </div>
    </main>
  )
}