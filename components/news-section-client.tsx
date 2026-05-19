"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Calendar, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { NewsContent } from "@/lib/site-content"

type NewsSectionClientProps = {
  content: NewsContent
}

export function NewsSectionClient({ content }: NewsSectionClientProps) {
  const news = content.items
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const carouselRef = useRef<HTMLDivElement>(null)

  const itemsPerView = 3

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 },
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const handlePrev = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrentIndex((prev) => (prev === 0 ? Math.max(news.length - itemsPerView, 0) : prev - 1))
    setTimeout(() => setIsAnimating(false), 500)
  }, [isAnimating, news.length])

  const handleNext = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrentIndex((prev) => (prev >= news.length - itemsPerView ? 0 : prev + 1))
    setTimeout(() => setIsAnimating(false), 500)
  }, [isAnimating, news.length])

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-background py-24">
      <div className="absolute left-0 top-0 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-1/2 translate-y-1/2 rounded-full bg-accent/5 blur-3xl" />

      <div className="container relative z-10 mx-auto px-4">
        <div className={`mb-12 transition-all duration-700 ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
          <div>
            <span className="mb-4 inline-block rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
              {content.badge}
            </span>
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              {content.title} <span className="text-primary">{content.highlight}</span>
            </h2>
          </div>
        </div>

        <div className="relative" ref={carouselRef}>
          <button
            onClick={handlePrev}
            className="absolute right-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-white/95 text-primary shadow-lg transition-all duration-300 hover:scale-105 hover:border-primary hover:bg-primary hover:text-white md:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <button
            onClick={handleNext}
            className="absolute left-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-white/95 text-primary shadow-lg transition-all duration-300 hover:scale-105 hover:border-primary hover:bg-primary hover:text-white md:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="overflow-hidden md:mx-16">
            <div className="flex gap-6 transition-transform duration-500 ease-out" style={{ transform: `translateX(${currentIndex * (100 / itemsPerView + 2)}%)` }}>
              {news.map((item, index) => (
                <div
                  key={item.id}
                  className={`w-full flex-shrink-0 transition-all duration-700 md:w-[calc(33.333%-1rem)] ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div className="group h-full overflow-hidden rounded-3xl border border-border/50 bg-card shadow-sm transition-all duration-500 hover:-translate-y-2 hover:shadow-xl">
                    <div className="relative h-56 overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                      <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-sm backdrop-blur-sm">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground">{item.date}</span>
                      </div>
                    </div>

                    <div className="p-6">
                      <h3 className="mb-3 line-clamp-1 text-xl font-bold text-foreground transition-colors group-hover:text-primary">
                        {item.title}
                      </h3>
                      <p className="mb-4 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                      <Button variant="ghost" className="group/btn h-auto gap-2 p-0 text-primary hover:bg-transparent hover:text-primary/80">
                        اقرأ المزيد
                        <ArrowLeft className="h-4 w-4 transition-transform group-hover/btn:-translate-x-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: Math.max(news.length - itemsPerView + 1, 1) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${currentIndex === index ? "w-8 bg-primary" : "w-2 bg-primary/30 hover:bg-primary/50"}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}