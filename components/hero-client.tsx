"use client"

import Link from "next/link"
import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import type { HeroContent } from "@/lib/site-content"

type HeroClientProps = {
  content: HeroContent
}

export function HeroClient({ content }: HeroClientProps) {
  const slide = content.slides[0]
  const [scrollY, setScrollY] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.bottom > 0) {
          setScrollY(window.scrollY * 0.5)
        }
      }
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <section ref={containerRef} className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-100" style={{ backgroundImage: `url(${slide?.image ?? ""})`, transform: `translateY(${scrollY}px) scale(1.08)` }} />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,34,34,0.72),rgba(1,154,151,0.56),rgba(6,34,34,0.78))]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center py-28">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto flex max-w-5xl items-center justify-center px-4">
            <div className="mx-auto max-w-4xl">
              <p className="mb-4 text-sm font-semibold tracking-[0.18em] text-white/78 md:text-base">{slide?.subtitle}</p>
              <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">{slide?.title}</h1>
              <p className="mx-auto mb-10 max-w-3xl text-base leading-8 text-white/82 md:text-xl">{slide?.description}</p>
              <div className="flex flex-wrap justify-center gap-4">
                <Button asChild size="lg" className="rounded-2xl bg-white px-8 py-6 text-lg font-bold text-primary shadow-xl shadow-black/10 transition-all duration-300 hover:scale-105 hover:bg-[#f4fffe]">
                  <Link href="#donation">{content.donateLabel}</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-2xl border-2 border-white/30 bg-transparent px-8 py-6 text-lg font-bold text-white transition-all duration-300 hover:scale-105 hover:bg-white/10 hover:text-white">
                  <Link href="#about">{content.aboutLabel}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}