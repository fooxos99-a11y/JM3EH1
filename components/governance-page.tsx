import Link from "next/link"
import {
  ArrowUpLeft,
  Layers3,
  ShieldCheck,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { type GovernancePageDefinition } from "@/lib/governance"
import type { GovernanceContent } from "@/lib/site-content"

export function GovernanceSectionPage({ definition, content }: { definition: GovernancePageDefinition; content: GovernanceContent }) {
  return (
    <main className="bg-[linear-gradient(180deg,#f7fbfb,#eef6f5_42%,#ffffff)] pt-36 pb-24">
      <div className="container mx-auto px-4">
        <section>
          {content.items.length > 0 ? (
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-6">
              {content.items.map((item, index) => (
                <Card
                  key={item.id}
                  className="animate-fade-in-up w-full rounded-[2rem] border-white/80 bg-white/95 text-center shadow-[0_20px_50px_rgba(15,23,42,0.06)] transition-transform duration-300 hover:-translate-y-1"
                  style={{ animationDelay: `${index * 0.08}s` }}
                >
                  <CardContent className="flex flex-col items-center gap-3 px-8 py-10 text-center">
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