"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Menu, ShoppingCart, X } from "lucide-react"

import { AuthDialog } from "@/components/auth-dialog"
import { Button } from "@/components/ui/button"
import { governanceNavigation } from "@/lib/governance"
import type { LogoContent } from "@/lib/site-content"

export function HeaderClient({ logo }: { logo: LogoContent }) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false)
  const [isMobileGovernanceOpen, setIsMobileGovernanceOpen] = useState(false)
  const [activeGovernanceIndex, setActiveGovernanceIndex] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navLinks = [
    { href: "#", label: "الرئيسية" },
    { href: "#about", label: "عن الجمعية" },
    { href: "#donation", label: "التبرع" },
    { href: "#services", label: "الخدمات" },
  ]
  const activeGovernanceItem = governanceNavigation[activeGovernanceIndex] ?? governanceNavigation[0]
  const isInternalPage = pathname !== "/"
  const useSolidHeader = isInternalPage || isScrolled

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        useSolidHeader ? "border-b border-slate-200/80 bg-white/96 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl" : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className={`flex items-center justify-between rounded-[1.75rem] px-3 transition-all duration-500 ${useSolidHeader ? "bg-transparent" : "border border-white/15 bg-black/10 py-3 backdrop-blur-md"}`}>
          <Link href="/" className="group flex items-center">
            {logo.logo ? (
              <div className={`flex h-16 items-center rounded-2xl px-3 py-2 shadow-sm transition-transform duration-300 group-hover:scale-[1.02] ${useSolidHeader ? "bg-white" : "bg-white/95"}`}>
                <img src={logo.logo} alt={logo.alt} className="h-full w-auto max-w-[180px] object-contain" />
              </div>
            ) : (
              <div className={`flex items-center gap-3 transition-colors duration-300 ${useSolidHeader ? "text-foreground" : "text-white"}`}>
                <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 ${useSolidHeader ? "bg-primary" : "bg-white/10 backdrop-blur-sm"}`}>
                  <span className={`text-xl font-bold ${useSolidHeader ? "text-primary-foreground" : "text-white"}`}>ع</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">العناية بالمسلمين الجدد</h1>
                  <p className={`text-xs ${useSolidHeader ? "text-muted-foreground" : "text-white/70"}`}>بريدة - القصيم</p>
                </div>
              </div>
            )}
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
            {navLinks.map((link, index) => (
              <Link
                key={link.href + index}
                href={link.href}
                className={`group relative rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                  useSolidHeader ? "text-foreground hover:bg-primary/10" : "text-white hover:bg-white/10"
                }`}
              >
                {link.label}
                <span className="absolute bottom-1 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-accent transition-all duration-300 group-hover:w-1/2" />
              </Link>
            ))}

            <div
              className="relative"
              onMouseEnter={() => {
                setIsGovernanceOpen(true)
                setActiveGovernanceIndex(0)
              }}
              onMouseLeave={() => setIsGovernanceOpen(false)}
            >
              <button
                type="button"
                className={`group flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                  useSolidHeader ? "text-foreground hover:bg-primary/10" : "text-white hover:bg-white/10"
                }`}
                onClick={() => setIsGovernanceOpen((current) => !current)}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isGovernanceOpen ? "rotate-180" : ""}`} />
                <span>الحوكمة</span>
                <span className="absolute bottom-1 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-accent transition-all duration-300 group-hover:w-1/2" />
              </button>

              <div className={`absolute left-1/2 top-full z-50 mt-3 w-[560px] -translate-x-1/2 transition-all duration-200 ${isGovernanceOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}>
                <div className="rounded-[1.75rem] border border-white/15 bg-[rgba(7,28,28,0.84)] p-3 shadow-[0_24px_70px_rgba(15,23,42,0.3)] backdrop-blur-xl">
                  <div className="grid grid-cols-[1.15fr_0.9fr] gap-3">
                    <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-3 text-right">
                      {activeGovernanceItem?.children?.length ? (
                        <div className="space-y-2">
                          <div className="flex justify-end">
                            <span className="inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-bold text-white">
                              {activeGovernanceItem.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            {activeGovernanceItem.children.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-medium text-white/88 transition-colors hover:border-accent/50 hover:bg-white/[0.12] hover:text-white"
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex min-h-[120px] items-center justify-center text-sm font-medium text-white/55">
                          اختر قسمًا يحتوي على عناصر فرعية
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-2">
                      {governanceNavigation.map((item, index) => {
                        const isActive = index === activeGovernanceIndex && Boolean(item.children?.length)

                        if (item.children?.length) {
                          return (
                            <button
                              key={item.href}
                              type="button"
                              className={`flex w-full items-center justify-between rounded-[1.1rem] border px-4 py-3 text-right text-sm font-bold transition-all duration-300 ${isActive ? "border-accent/60 bg-accent/15 text-white" : "border-white/10 bg-white/[0.05] text-white/88 hover:bg-white/[0.09]"}`}
                              onMouseEnter={() => setActiveGovernanceIndex(index)}
                              onFocus={() => setActiveGovernanceIndex(index)}
                            >
                              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isActive ? "rotate-90" : "rotate-90 opacity-60"}`} />
                              <span>{item.label}</span>
                            </button>
                          )
                        }

                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center justify-between rounded-[1.1rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-right text-sm font-bold text-white/88 transition-all duration-300 hover:bg-white/[0.09] hover:text-white"
                          >
                            <span className="opacity-0">.</span>
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className={`rounded-full ${useSolidHeader ? "text-foreground hover:bg-primary/10" : "text-white hover:bg-white/10"}`}>
              <Link href="/cart" aria-label="السلة">
                <ShoppingCart className="h-5 w-5" />
              </Link>
            </Button>
            <AuthDialog isScrolled={useSolidHeader} />

            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full lg:hidden ${useSolidHeader ? "text-foreground" : "text-white"}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        <div className={`overflow-hidden transition-all duration-500 lg:hidden ${isMenuOpen ? "mt-4 max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
          <nav className="rounded-[1.75rem] border border-border/50 bg-card/95 p-4 shadow-xl backdrop-blur-lg">
            {navLinks.map((link, index) => (
              <Link
                key={link.href + index}
                href={link.href}
                className="block rounded-2xl px-4 py-3 font-medium text-foreground transition-all duration-300 hover:bg-primary/5 hover:text-primary"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-2 rounded-[1.5rem] border border-white/15 bg-[rgba(7,28,28,0.82)] p-2 shadow-[0_20px_50px_rgba(15,23,42,0.2)] backdrop-blur-xl">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 font-medium text-white transition-all duration-300 hover:bg-white/10 hover:text-white"
                onClick={() => setIsMobileGovernanceOpen((current) => !current)}
              >
                <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isMobileGovernanceOpen ? "rotate-180" : ""}`} />
                <span>الحوكمة</span>
              </button>

              <div className={`overflow-hidden transition-all duration-300 ${isMobileGovernanceOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="mt-2 space-y-2 px-2 pb-2">
                  {governanceNavigation.map((item) => (
                    <div key={item.href} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-3">
                      {item.children?.length ? (
                        <div className="flex justify-end">
                          <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 font-semibold text-white">
                            {item.label}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <Link
                            href={item.href}
                            className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 font-semibold text-white transition-colors hover:border-accent/50 hover:bg-white/[0.12] hover:text-accent"
                            onClick={() => {
                              setIsMenuOpen(false)
                              setIsMobileGovernanceOpen(false)
                            }}
                          >
                            {item.label}
                          </Link>
                        </div>
                      )}
                      {item.children?.length ? (
                        <div className="mt-2 flex flex-wrap justify-end gap-2">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-sm text-white/80 transition-colors hover:border-accent/50 hover:bg-white/[0.12] hover:text-white"
                              onClick={() => {
                                setIsMenuOpen(false)
                                setIsMobileGovernanceOpen(false)
                              }}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
