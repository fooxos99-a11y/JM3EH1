"use client"

import Link from "next/link"
import { useEffect, useState, useRef, useCallback } from "react"
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
  const containerRef = useRef<HTMLDivElement>(null)
  const backgroundRefs = useRef<Array<HTMLDivElement | null>>([])
  const autoPlayResumeTimeoutRef = useRef<number | null>(null)
  const lastParallaxOffsetRef = useRef<number | null>(null)

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }, [slides.length])

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }, [slides.length])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
    setIsAutoPlaying(false)

    if (autoPlayResumeTimeoutRef.current !== null) {
      window.clearTimeout(autoPlayResumeTimeoutRef.current)
    }

    autoPlayResumeTimeoutRef.current = window.setTimeout(() => {
      setIsAutoPlaying(true)
      autoPlayResumeTimeoutRef.current = null
    }, 5000)
  }

  useEffect(() => {
    if (!isAutoPlaying || slides.length <= 1) {
      return
    }

    const interval = setInterval(nextSlide, 5000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, nextSlide, slides.length])

  useEffect(() => {
    let frameId = 0

    const updateParallax = () => {
      frameId = 0
      const container = containerRef.current
      const activeBackground = backgroundRefs.current[currentSlide]
      if (!container || !activeBackground) {
        return
      }

      const rect = container.getBoundingClientRect()
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
        return
      }

      const nextOffset = Math.round(window.scrollY * 0.18)
      if (lastParallaxOffsetRef.current === nextOffset) {
        return
      }

      activeBackground.style.transform = `translate3d(0, ${nextOffset}px, 0) scale(1.08)`
      lastParallaxOffsetRef.current = nextOffset
    }

    const handleScroll = () => {
      if (frameId !== 0) {
        return
      }

      frameId = window.requestAnimationFrame(updateParallax)
    }

    lastParallaxOffsetRef.current = null
    updateParallax()
    window.addEventListener("scroll", handleScroll, { passive: true })

    return () => {
      window.removeEventListener("scroll", handleScroll)
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [currentSlide])

  useEffect(() => {
    return () => {
      if (autoPlayResumeTimeoutRef.current !== null) {
        window.clearTimeout(autoPlayResumeTimeoutRef.current)
      }
    }
  }, [])

  return (
    <section ref={containerRef} className="relative h-screen min-h-[100svh] w-full overflow-hidden">
      {slides.map((slide, index) => (
        <div key={slide.id} className={`absolute inset-0 transition-[opacity,transform] duration-1000 ease-out ${index === currentSlide ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}>
          <div
            ref={(node) => {
              backgroundRefs.current[index] = node
            }}
            className="absolute inset-0 bg-cover bg-center will-change-transform"
            style={{
              backgroundImage: `url(${slide.image})`,
              backgroundPosition: "center center",
              transform: "translate3d(0, 0, 0) scale(1.08)",
            }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,24,22,0.34),rgba(7,24,22,0.18),rgba(7,24,22,0.48))]" />
        </div>
      ))}

      <div className="relative z-10 flex min-h-[100svh] items-center justify-center px-4 pb-16 pt-28 sm:pt-32 lg:pt-36">
        <div className="container mx-auto text-center">
          {slides.map((slide, index) => (
            <div key={slide.id} className={`absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-700 ${index === currentSlide ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-8"}`}>
              <div className="mx-auto flex max-w-6xl items-center justify-center px-4">
                <div className="mx-auto max-w-4xl">
                  <p className="mb-4 text-xs font-semibold tracking-[0.16em] text-white/84 sm:text-sm md:text-base">{slide.subtitle}</p>
                  <h1 className="mb-6 text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl lg:text-6xl xl:text-6xl">{slide.title}</h1>
                  <p className="mx-auto mb-10 max-w-3xl text-sm leading-7 text-white/88 sm:text-base md:text-xl md:leading-9">{slide.description}</p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button asChild size="lg" className="min-h-14 rounded-2xl bg-white px-8 text-lg font-bold text-primary shadow-xl shadow-black/10 transition-[background-color,transform,box-shadow] duration-300 hover:scale-[1.02] hover:bg-[#f4fffe] sm:px-10 sm:text-xl">
                      <Link href="#donation">{content.donateLabel}</Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="min-h-14 rounded-2xl border-2 border-white/35 bg-transparent px-8 text-lg font-bold text-white transition-[background-color,color,transform] duration-300 hover:scale-[1.02] hover:bg-white/10 hover:text-white sm:px-10 sm:text-xl">
                      <Link href="#about">{content.aboutLabel}</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        <>
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-4 md:px-8">
            <Button variant="ghost" size="icon" onClick={prevSlide} className="pointer-events-auto h-12 w-12 rounded-full border border-white/20 bg-black/10 text-white transition-[background-color,transform] duration-300 hover:scale-[1.03] hover:bg-white/16 md:h-14 md:w-14">
              <ChevronRight className="h-6 w-6" />
            </Button>
            <Button variant="ghost" size="icon" onClick={nextSlide} className="pointer-events-auto h-12 w-12 rounded-full border border-white/20 bg-black/10 text-white transition-[background-color,transform] duration-300 hover:scale-[1.03] hover:bg-white/16 md:h-14 md:w-14">
              <ChevronLeft className="h-6 w-6" />
            </Button>
          </div>

          <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
            {slides.map((_, index) => (
              <button key={index} onClick={() => goToSlide(index)} className={`relative h-3 overflow-hidden rounded-full transition-[width,background-color] duration-500 ${index === currentSlide ? "w-12 bg-white" : "w-3 bg-white/40 hover:bg-white/60"}`}>
                {index === currentSlide ? <span className="absolute inset-0 animate-progress bg-primary/20" style={{ animationDuration: "5s" }} /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-10 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}