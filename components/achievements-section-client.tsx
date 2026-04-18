"use client"

import { useEffect, useRef, useState } from "react"

import { getContentIcon } from "@/lib/content-icons"
import type { AchievementsContent } from "@/lib/site-content"

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setIsInView(true)
    }, { threshold: 0.1 })

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [ref])

  return isInView
}

function Counter({ end, duration = 2500 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasStarted) {
        setHasStarted(true)
      }
    }, { threshold: 0.5 })

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [hasStarted])

  useEffect(() => {
    if (!hasStarted) return
    let startTime: number
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(easeOut * end))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [hasStarted, end, duration])

  return <div ref={ref}>{count.toLocaleString("ar-SA")}</div>
}

export function AchievementsSectionClient({ content }: { content: AchievementsContent }) {
  const sectionRef = useRef<HTMLElement>(null)
  const isInView = useInView(sectionRef)

  return (
    <section id="achievements" ref={sectionRef} className="relative overflow-hidden bg-gradient-to-br from-[#017a77] via-primary to-[#01b5b2] py-24">
      <div className="absolute inset-0">
        <div className="absolute right-10 top-10 h-64 w-64 animate-float rounded-full border border-white/5" />
        <div className="absolute bottom-10 left-10 h-48 w-48 animate-float rounded-full border border-white/5" style={{ animationDelay: "2s" }} />
        <div className="absolute right-1/4 top-1/2 h-32 w-32 animate-pulse rounded-full bg-white/5 blur-2xl" />
        <div className="absolute bottom-1/4 left-1/3 h-48 w-48 animate-pulse rounded-full bg-accent/10 blur-3xl" style={{ animationDelay: "1s" }} />
      </div>

      <div className="container relative z-10 mx-auto px-4">
        <div className={`mb-16 text-center transition-all duration-700 ${isInView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}>
          <span className="mb-4 inline-block text-sm font-semibold tracking-wider text-accent uppercase">{content.badge}</span>
          <h2 className="mb-6 text-4xl font-bold text-white md:text-5xl">{content.title}</h2>
          <p className="mx-auto max-w-2xl text-lg text-white/70">{content.description}</p>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {content.items.map((achievement, index) => {
            const Icon = getContentIcon(achievement.icon)
            return (
              <div
                key={achievement.id}
                className={`group transition-all duration-700 ${isInView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/10 p-6 text-center backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:border-white/20 hover:bg-white/20">
                  <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                    <div className="absolute inset-0 animate-shimmer" />
                  </div>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 transition-transform duration-300 group-hover:scale-110 group-hover:bg-accent/20">
                    <Icon className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="mb-3 text-xs font-medium text-white/60">{achievement.title}</h3>
                  <div className="mb-1 text-3xl font-bold text-white md:text-4xl">
                    <Counter end={achievement.number} />
                  </div>
                  <p className="text-sm font-medium text-accent">{achievement.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}