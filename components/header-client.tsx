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

              <div className={`absolute left-1/2 top-full z-50 mt-3 w-[360px] -translate-x-1/2 transition-all duration-200 ${isGovernanceOpen ? "visible opacity-100" : "invisible opacity-0"}`}>
                <div className="rounded-[1.75rem] border border-white/80 bg-white/96 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                  <div className="grid gap-2">
                    {governanceNavigation.map((item) => (
                      <div key={item.href} className="rounded-[1.25rem] border border-border/60 bg-[#f8fbfb] p-3 text-right">
                        {item.children?.length ? (
                          <div className="block text-sm font-bold text-foreground">{item.label}</div>
                        ) : (
                          <Link href={item.href} className="block text-sm font-bold text-foreground transition-colors hover:text-primary">
                            {item.label}
                          </Link>
                        )}
                        {item.children?.length ? (
                          <div className="mt-2 flex flex-wrap justify-end gap-2">
                            {item.children.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className="rounded-full border border-primary/10 bg-white px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/30 hover:bg-primary/5"
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

            <div className="mt-2 rounded-[1.5rem] border border-border/50 bg-[#f8fbfb] p-2">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 font-medium text-foreground transition-all duration-300 hover:bg-primary/5 hover:text-primary"
                onClick={() => setIsMobileGovernanceOpen((current) => !current)}
              >
                <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isMobileGovernanceOpen ? "rotate-180" : ""}`} />
                <span>الحوكمة</span>
              </button>

              <div className={`overflow-hidden transition-all duration-300 ${isMobileGovernanceOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="mt-2 space-y-2 px-2 pb-2">
                  {governanceNavigation.map((item) => (
                    <div key={item.href} className="rounded-[1.25rem] border border-border/50 bg-white p-3">
                      {item.children?.length ? (
                        <div className="block font-semibold text-foreground">{item.label}</div>
                      ) : (
                        <Link
                          href={item.href}
                          className="block font-semibold text-foreground transition-colors hover:text-primary"
                          onClick={() => {
                            setIsMenuOpen(false)
                            setIsMobileGovernanceOpen(false)
                          }}
                        >
                          {item.label}
                        </Link>
                      )}
                      {item.children?.length ? (
                        <div className="mt-2 space-y-1 pr-3">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="block rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary"
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
