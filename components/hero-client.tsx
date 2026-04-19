"use client"

import Link from "next/link"
import { useEffect, useState, useCallback, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { HeroContent } from "@/lib/site-content"

type HeroClientProps = {
  content: HeroContent
}

export function HeroClient({ content }: HeroClientProps) {
  const slides = content.slides
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const [scrollY, setScrollY] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    setIsAutoPlaying(false)
    setTimeout(() => setIsAutoPlaying(true), 5000)
  }

  useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(nextSlide, 5000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, nextSlide])

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
      {slides.map((slide, index) => (
        <div key={slide.id} className={`absolute inset-0 transition-all duration-1000 ease-out ${index === currentSlide ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}>
          <div className="absolute inset-0 bg-cover bg-center transition-transform duration-100" style={{ backgroundImage: `url(${slide.image})`, transform: `translateY(${scrollY}px) scale(1.1)` }} />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,34,34,0.82),rgba(1,154,151,0.68),rgba(6,34,34,0.9))]" />
          <div className="absolute inset-0 opacity-[0.08]">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InBhdHRlcm4iIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0id2hpdGUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjcGF0dGVybikiLz48L3N2Zz4=')]"></div>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_34%)]" />
        </div>
      ))}

      <div className="relative z-10 flex min-h-screen items-center justify-center py-28">
        <div className="container mx-auto px-4 text-center">
          {slides.map((slide, index) => (
            <div key={slide.id} className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${index === currentSlide ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-8"}`}>
              <div className="mx-auto max-w-4xl px-4">
                <div className="mx-auto max-w-4xl rounded-[2.25rem] border border-white/10 bg-black/15 px-6 py-8 shadow-[0_28px_90px_rgba(0,0,0,0.18)] backdrop-blur-md md:px-10 md:py-12">
                  <p className="mb-4 text-sm font-semibold tracking-[0.24em] text-white/75 md:text-base">{slide.subtitle}</p>
                  <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">{slide.title}</h1>
                  <p className="mx-auto mb-10 max-w-2xl text-base leading-8 text-white/78 md:text-xl">{slide.description}</p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button asChild size="lg" className="rounded-2xl bg-white px-8 py-6 text-lg font-bold text-primary shadow-xl shadow-black/10 transition-all duration-300 hover:scale-105 hover:bg-[#f4fffe]">
                      <Link href="#donation">{content.donateLabel}</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="rounded-2xl border-2 border-white/25 bg-white/10 px-8 py-6 text-lg font-bold text-white backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white/16 hover:text-white">
                      <Link href="#about">{content.aboutLabel}</Link>
                    </Button>
                  </div>
                  <div className="mt-8 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-4 text-white/90 backdrop-blur-sm">
                      <p className="text-xs font-semibold text-white/60">رسالة الجمعية</p>
                      <p className="mt-2 text-sm leading-7">تعريف ودعم ورعاية للمسلمين الجدد عبر برامج واضحة الأثر.</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-4 text-white/90 backdrop-blur-sm">
                      <p className="text-xs font-semibold text-white/60">فرص مباشرة</p>
                      <p className="mt-2 text-sm leading-7">تبرعات ومشاريع وإهداءات قابلة للوصول السريع من نفس الصفحة.</p>
                    </div>
                    <div className="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-4 text-white/90 backdrop-blur-sm">
                      <p className="text-xs font-semibold text-white/60">تجربة واضحة</p>
                      <p className="mt-2 text-sm leading-7">واجهات أبسط وتباين أعلى ومسار أسرع حتى إتمام الدعم.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-4 md:px-8">
        <Button variant="ghost" size="icon" onClick={prevSlide} className="pointer-events-auto h-12 w-12 rounded-full border border-white/20 bg-black/15 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white/16 md:h-14 md:w-14">
          <ChevronRight className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" onClick={nextSlide} className="pointer-events-auto h-12 w-12 rounded-full border border-white/20 bg-black/15 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white/16 md:h-14 md:w-14">
          <ChevronLeft className="h-6 w-6" />
        </Button>
      </div>

      <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
        {slides.map((_, index) => (
          <button key={index} onClick={() => goToSlide(index)} className={`relative h-3 overflow-hidden rounded-full transition-all duration-500 ${index === currentSlide ? "w-12 bg-accent" : "w-3 bg-white/40 hover:bg-white/60"}`}>
            {index === currentSlide ? <span className="absolute inset-0 animate-progress bg-white/30" style={{ animationDuration: "5s" }} /> : null}
          </button>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}