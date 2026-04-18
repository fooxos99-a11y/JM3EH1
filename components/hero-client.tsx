"use client"

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
    <section ref={containerRef} className="relative h-screen w-full overflow-hidden">
      {slides.map((slide, index) => (
        <div key={slide.id} className={`absolute inset-0 transition-all duration-1000 ease-out ${index === currentSlide ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}>
          <div className="absolute inset-0 bg-cover bg-center transition-transform duration-100" style={{ backgroundImage: `url(${slide.image})`, transform: `translateY(${scrollY}px) scale(1.1)` }} />
          <div className="absolute inset-0 bg-gradient-to-b from-primary/80 via-primary/60 to-primary/90" />
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9InBhdHRlcm4iIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIgZmlsbD0id2hpdGUiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjcGF0dGVybikiLz48L3N2Zz4=')]"></div>
          </div>
        </div>
      ))}

      <div className="relative z-10 flex h-full items-center justify-center">
        <div className="container mx-auto px-4 text-center">
          {slides.map((slide, index) => (
            <div key={slide.id} className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${index === currentSlide ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-8"}`}>
              <div className="mx-auto max-w-4xl px-4">
                <p className="mb-4 text-lg text-white/80 md:text-xl">{slide.subtitle}</p>
                <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl lg:text-7xl">{slide.title}</h1>
                <p className="mx-auto mb-10 max-w-2xl text-lg text-white/70 md:text-xl">{slide.description}</p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button size="lg" className="rounded-2xl bg-accent px-8 py-6 text-lg font-bold text-accent-foreground shadow-xl shadow-accent/30 transition-all duration-300 hover:scale-105 hover:bg-accent/90 hover:shadow-accent/50">
                    {content.donateLabel}
                  </Button>
                  <Button size="lg" variant="outline" className="rounded-2xl border-2 border-white/70 bg-white/92 px-8 py-6 text-lg font-bold text-primary shadow-lg shadow-black/10 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-white hover:text-primary/90">
                    {content.aboutLabel}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-4 md:px-8">
        <Button variant="ghost" size="icon" onClick={prevSlide} className="pointer-events-auto h-12 w-12 rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white/20 md:h-14 md:w-14">
          <ChevronRight className="h-6 w-6" />
        </Button>
        <Button variant="ghost" size="icon" onClick={nextSlide} className="pointer-events-auto h-12 w-12 rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-white/20 md:h-14 md:w-14">
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