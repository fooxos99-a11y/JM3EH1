"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { X, ChevronLeft, ChevronRight, ZoomIn } from "lucide-react"

import type { GalleryContent } from "@/lib/site-content"

type GallerySectionClientProps = {
  content: GalleryContent
}

export function GallerySectionClient({ content }: GallerySectionClientProps) {
  const galleryImages = content.items
  const [selectedImage, setSelectedImage] = useState<number | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  const itemsPerView = 4

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

  const handleCarouselPrev = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrentIndex((prev) => (prev === 0 ? Math.max(galleryImages.length - itemsPerView, 0) : prev - 1))
    setTimeout(() => setIsAnimating(false), 500)
  }, [galleryImages.length, isAnimating])

  const handleCarouselNext = useCallback(() => {
    if (isAnimating) return
    setIsAnimating(true)
    setCurrentIndex((prev) => (prev >= galleryImages.length - itemsPerView ? 0 : prev + 1))
    setTimeout(() => setIsAnimating(false), 500)
  }, [galleryImages.length, isAnimating])

  const handleLightboxPrev = () => {
    if (selectedImage !== null) {
      setSelectedImage(selectedImage === 0 ? galleryImages.length - 1 : selectedImage - 1)
    }
  }

  const handleLightboxNext = () => {
    if (selectedImage !== null) {
      setSelectedImage(selectedImage === galleryImages.length - 1 ? 0 : selectedImage + 1)
    }
  }

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-background py-24">
      <div className="absolute right-20 top-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-20 left-20 h-80 w-80 rounded-full bg-accent/5 blur-3xl" />

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

        <div className="relative">
          <button
            onClick={handleCarouselPrev}
            className="absolute right-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-white/95 text-primary shadow-lg transition-all duration-300 hover:scale-105 hover:border-primary hover:bg-primary hover:text-white md:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <button
            onClick={handleCarouselNext}
            className="absolute left-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-white/95 text-primary shadow-lg transition-all duration-300 hover:scale-105 hover:border-primary hover:bg-primary hover:text-white md:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="overflow-hidden md:mx-16">
            <div className="flex gap-4 transition-transform duration-500 ease-out" style={{ transform: `translateX(${currentIndex * (100 / itemsPerView + 1.5)}%)` }}>
              {galleryImages.map((image, index) => (
                <div
                  key={image.id}
                  className={`w-full flex-shrink-0 transition-all duration-700 sm:w-[calc(50%-0.5rem)] md:w-[calc(33.333%-0.75rem)] lg:w-[calc(25%-0.75rem)] ${isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
                  style={{ transitionDelay: `${index * 100}ms` }}
                >
                  <div
                    className="group relative aspect-[4/3] cursor-pointer overflow-hidden rounded-2xl shadow-lg transition-all duration-500 hover:shadow-2xl"
                    onClick={() => setSelectedImage(index)}
                  >
                    <img
                      src={image.src}
                      alt={image.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent opacity-0 transition-all duration-500 group-hover:opacity-100" />
                    <div className="absolute inset-0 flex translate-y-4 flex-col justify-end p-4 opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                      <h4 className="text-base font-bold text-white">{image.title}</h4>
                    </div>
                    <div className="absolute left-3 top-3 flex h-10 w-10 scale-50 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:scale-100 group-hover:opacity-100">
                      <ZoomIn className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {Array.from({ length: Math.max(galleryImages.length - itemsPerView + 1, 1) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${currentIndex === index ? "w-8 bg-primary" : "w-2 bg-primary/30 hover:bg-primary/50"}`}
            />
          ))}
        </div>
      </div>

      {selectedImage !== null && galleryImages[selectedImage] ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4" onClick={() => setSelectedImage(null)}>
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute left-6 top-6 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 transition-all duration-300 hover:bg-white/20"
          >
            <X className="h-6 w-6 text-white" />
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation()
              handleLightboxPrev()
            }}
            className="absolute right-6 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-all duration-300 hover:bg-white/20"
          >
            <ChevronRight className="h-8 w-8 text-white" />
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation()
              handleLightboxNext()
            }}
            className="absolute left-6 top-1/2 flex h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 transition-all duration-300 hover:bg-white/20"
          >
            <ChevronLeft className="h-8 w-8 text-white" />
          </button>

          <div className="relative max-h-[85vh] max-w-5xl animate-scale-in" onClick={(event) => event.stopPropagation()}>
            <img
              src={galleryImages[selectedImage].src}
              alt={galleryImages[selectedImage].title}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />

            <div className="absolute bottom-0 left-0 right-0 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent p-6">
              <h4 className="text-xl font-bold text-white">{galleryImages[selectedImage].title}</h4>
            </div>
          </div>

          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
            {galleryImages.map((_, index) => (
              <button
                key={index}
                onClick={(event) => {
                  event.stopPropagation()
                  setSelectedImage(index)
                }}
                className={`h-2 w-2 rounded-full transition-all duration-300 ${index === selectedImage ? "w-8 bg-white" : "bg-white/40 hover:bg-white/60"}`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}