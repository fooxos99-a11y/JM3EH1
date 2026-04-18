"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, CheckCircle, Eye, Target } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getContentIcon } from "@/lib/content-icons"
import type { AboutContent } from "@/lib/site-content"

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting), { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return isInView
}

export function AboutSectionClient({ content }: { content: AboutContent }) {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef)

  return (
    <section id="about" ref={sectionRef} className="relative overflow-hidden bg-card py-24">
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-2">
          <div className={`transition-all duration-700 ${isInView ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}>
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">{content.badge}</span>
            <h2 className="mb-6 text-3xl font-bold leading-tight text-foreground md:text-4xl">
              {content.title} <span className="text-primary">{content.highlight}</span>
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-muted-foreground">{content.description}</p>

            <ul className="mb-8 space-y-4">
              {content.features.map((feature, index) => (
                <li
                  key={feature.id}
                  className={`flex items-center gap-3 transition-all duration-500 ${isInView ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0"}`}
                  style={{ transitionDelay: `${300 + index * 100}ms` }}
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-foreground">{feature.text}</span>
                </li>
              ))}
            </ul>

            <Button size="lg" className="gap-2 rounded-xl bg-primary shadow-lg shadow-primary/25 transition-all duration-300 hover:bg-primary/90 hover:shadow-primary/40">
              {content.ctaLabel}
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>

          <div className={`transition-all delay-200 duration-700 ${isInView ? "translate-x-0 opacity-100" : "-translate-x-8 opacity-0"}`}>
            <div className="relative">
              <div className="relative overflow-hidden rounded-3xl shadow-2xl">
                <img src={content.image} alt={content.highlight} className="h-[400px] w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent" />

                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
                      <Eye className="mb-2 h-8 w-8 text-accent" />
                      <h4 className="mb-1 text-lg font-bold text-white">{content.visionTitle}</h4>
                      <p className="text-sm text-white/80">{content.visionDescription}</p>
                    </div>
                    <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
                      <Target className="mb-2 h-8 w-8 text-accent" />
                      <h4 className="mb-1 text-lg font-bold text-white">{content.missionTitle}</h4>
                      <p className="text-sm text-white/80">{content.missionDescription}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-4 gap-3">
                {content.stats.map((stat, index) => {
                  const Icon = getContentIcon(stat.icon)
                  return (
                    <div
                      key={stat.id}
                      className={`rounded-2xl border border-border/50 bg-card p-4 text-center shadow-lg transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${isInView ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
                      style={{ transitionDelay: `${400 + index * 100}ms` }}
                    >
                      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-xl font-bold text-primary">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}