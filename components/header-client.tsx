"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, Menu, ShoppingCart, X } from "lucide-react"

import { AuthDialog } from "@/components/auth-dialog"
import { Button } from "@/components/ui/button"
import { governanceNavigation } from "@/lib/governance"
import type { LogoContent } from "@/lib/site-content"

export function HeaderClient({ logo }: { logo: LogoContent }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false)
  const [isMobileGovernanceOpen, setIsMobileGovernanceOpen] = useState(false)

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

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        isScrolled ? "border-b border-white/60 bg-white/80 py-3 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl" : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className={`flex items-center justify-between rounded-[1.75rem] px-3 transition-all duration-500 ${isScrolled ? "bg-transparent" : "border border-white/15 bg-black/10 py-3 backdrop-blur-md"}`}>
          <Link href="/" className="group flex items-center">
            {logo.logo ? (
              <div className={`flex h-16 items-center rounded-2xl px-3 py-2 shadow-sm transition-transform duration-300 group-hover:scale-[1.02] ${isScrolled ? "bg-white/90" : "bg-white/95"}`}>
                <img src={logo.logo} alt={logo.alt} className="h-full w-auto max-w-[180px] object-contain" />
              </div>
            ) : (
              <div className={`flex items-center gap-3 transition-colors duration-300 ${isScrolled ? "text-foreground" : "text-white"}`}>
                <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 ${isScrolled ? "bg-primary" : "bg-white/10 backdrop-blur-sm"}`}>
                  <span className={`text-xl font-bold ${isScrolled ? "text-primary-foreground" : "text-white"}`}>ع</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">العناية بالمسلمين الجدد</h1>
                  <p className={`text-xs ${isScrolled ? "text-muted-foreground" : "text-white/70"}`}>بريدة - القصيم</p>
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
                  isScrolled ? "text-foreground hover:bg-primary/10" : "text-white hover:bg-white/10"
                }`}
              >
                {link.label}
                <span className="absolute bottom-1 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-accent transition-all duration-300 group-hover:w-1/2" />
              </Link>
            ))}

            <div
              className="relative"
              onMouseEnter={() => setIsGovernanceOpen(true)}
              onMouseLeave={() => setIsGovernanceOpen(false)}
            >
              <button
                type="button"
                className={`group flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                  isScrolled ? "text-foreground hover:bg-primary/10" : "text-white hover:bg-white/10"
                }`}
                onClick={() => setIsGovernanceOpen((current) => !current)}
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isGovernanceOpen ? "rotate-180" : ""}`} />
                <span>الحوكمة</span>
                <span className="absolute bottom-1 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-accent transition-all duration-300 group-hover:w-1/2" />
              </button>

              <div className={`absolute left-1/2 top-full z-50 mt-3 w-[420px] -translate-x-1/2 transition-all duration-200 ${isGovernanceOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}>
                <div className="rounded-[1.75rem] border border-white/15 bg-[rgba(7,28,28,0.78)] p-3 shadow-[0_24px_70px_rgba(15,23,42,0.28)] backdrop-blur-xl">
                  <div className="grid gap-2">
                    {governanceNavigation.map((item) => (
                      <div key={item.href} className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-3 text-right transition-colors duration-300 hover:bg-white/[0.07]">
                        {item.children?.length ? (
                          <div className="flex justify-end">
                            <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-bold text-white">
                              {item.label}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-end">
                            <Link href={item.href} className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-bold text-white transition-colors hover:border-accent/50 hover:bg-white/[0.12] hover:text-accent">
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
                                className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.08] px-4 py-2 text-xs font-medium text-white/88 transition-colors hover:border-accent/50 hover:bg-white/[0.12] hover:text-white"
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
            </div>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className={`rounded-full ${isScrolled ? "text-foreground hover:bg-primary/10" : "text-white hover:bg-white/10"}`}>
              <Link href="/cart" aria-label="السلة">
                <ShoppingCart className="h-5 w-5" />
              </Link>
            </Button>
            <AuthDialog isScrolled={isScrolled} />

            <Button
              variant="ghost"
              size="icon"
              className={`rounded-full lg:hidden ${isScrolled ? "text-foreground" : "text-white"}`}
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
