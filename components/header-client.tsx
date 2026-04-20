"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, Menu, ShoppingCart, X } from "lucide-react"

import { AuthDialog } from "@/components/auth-dialog"
import { Button } from "@/components/ui/button"
import { governanceNavigation } from "@/lib/governance"
import type { LogoContent } from "@/lib/site-content"

function getWeightClass(weight: LogoContent["arabicFontWeight"]) {
  return weight === "bold" ? "font-extrabold" : "font-normal"
}

export function HeaderClient({ logo }: { logo: LogoContent }) {
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isGovernanceOpen, setIsGovernanceOpen] = useState(false)
  const [isMobileGovernanceOpen, setIsMobileGovernanceOpen] = useState(false)
  const [expandedGovernanceHref, setExpandedGovernanceHref] = useState<string | null>(null)

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
  const isInternalPage = pathname !== "/"
  const useSolidHeader = isInternalPage || isScrolled

  useEffect(() => {
    setIsGovernanceOpen(false)
    setIsMenuOpen(false)
    setIsMobileGovernanceOpen(false)
  }, [pathname])

  function toggleGovernanceItem(href: string, hasChildren: boolean) {
    if (!hasChildren) {
      setIsGovernanceOpen(false)
      return
    }

    setExpandedGovernanceHref((current) => (current === href ? null : href))
  }

  const arabicName = logo.arabicName.trim() || "العناية بالمسلمين الجدد"
  const englishName = logo.englishName.trim() || "New Muslims Care Association"
  const solidTextStyle = { color: logo.textColor || "#1a1a2e" }

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        useSolidHeader ? "bg-white/96 py-2.5 shadow-[0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur-xl" : "bg-transparent py-4"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className={`flex items-center justify-between rounded-[1.75rem] px-2 transition-all duration-500 ${useSolidHeader ? "bg-transparent" : "bg-black/10 py-2.5 backdrop-blur-md"}`}>
          <Link href="/" className="group flex items-center gap-3">
            {logo.logo ? (
              <>
                <div className="flex h-[64px] w-[64px] shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-[1.02] md:h-[70px] md:w-[70px]">
                  <img src={logo.logo} alt={logo.alt} className="h-[64px] w-[64px] object-contain md:h-[70px] md:w-[70px]" />
                </div>
                <div className={`flex min-h-[64px] flex-col justify-center text-right transition-colors duration-300 md:min-h-[70px] ${useSolidHeader ? "" : "text-white"}`}>
                  <h1 className={`text-base leading-tight md:text-[1.3rem] ${getWeightClass(logo.arabicFontWeight)}`} style={useSolidHeader ? solidTextStyle : undefined}>{arabicName}</h1>
                  <p className={`mt-1 text-[10px] tracking-[0.02em] md:text-[0.82rem] ${useSolidHeader ? getWeightClass(logo.englishFontWeight) : `${getWeightClass(logo.englishFontWeight)} text-white/70`}`} style={useSolidHeader ? solidTextStyle : undefined} dir="ltr">{englishName}</p>
                </div>
              </>
            ) : (
              <div className={`flex items-center gap-3 transition-colors duration-300 ${useSolidHeader ? "text-foreground" : "text-white"}`}>
                <div className={`relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 ${useSolidHeader ? "bg-primary" : "bg-white/10 backdrop-blur-sm"}`}>
                  <span className={`text-xl font-bold ${useSolidHeader ? "text-primary-foreground" : "text-white"}`}>ع</span>
                </div>
                <div className="text-right">
                  <h1 className="text-lg font-bold leading-tight">{arabicName}</h1>
                  <p className={`text-xs ${useSolidHeader ? "text-muted-foreground" : "text-white/70"}`} dir="ltr">{englishName}</p>
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
                <span className="absolute bottom-1 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 group-hover:w-1/2" />
              </Link>
            ))}

            <div
              className="relative"
            >
              <button
                type="button"
                className={`group flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-300 ${
                  useSolidHeader ? "text-foreground hover:bg-primary/10" : "text-white hover:bg-white/10"
                }`}
                onClick={() => setIsGovernanceOpen((current) => !current)}
              >
                <span>الحوكمة</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isGovernanceOpen ? "rotate-180" : ""}`} />
                <span className="absolute bottom-1 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-primary transition-all duration-300 group-hover:w-1/2" />
              </button>

              <div className={`absolute left-1/2 top-full z-50 mt-3 w-[300px] -translate-x-1/2 transition-all duration-200 ${isGovernanceOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"}`}>
                <div className="space-y-1.5 rounded-[1.4rem] bg-white/98 p-2.5 text-right shadow-[0_24px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                    {governanceNavigation.map((item) => {
                      const hasChildren = Boolean(item.children?.length)
                      const isExpanded = expandedGovernanceHref === item.href

                      return (
                        <div key={item.href} className="space-y-2">
                          {hasChildren ? (
                            <button
                              type="button"
                              className={`flex w-full items-center justify-between rounded-full px-4 py-2.5 text-right text-sm font-medium transition-all duration-300 ${isExpanded ? "bg-slate-100 text-slate-900" : "bg-transparent text-slate-800 hover:bg-slate-100/90"}`}
                              onClick={() => toggleGovernanceItem(item.href, hasChildren)}
                            >
                              <span>{item.label}</span>
                              <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} />
                            </button>
                          ) : (
                            <Link
                              href={item.href}
                              className="flex w-full items-center justify-end rounded-full bg-transparent px-4 py-2.5 text-right text-sm font-medium text-slate-800 transition-all duration-300 hover:bg-slate-100/90"
                              onClick={() => setIsGovernanceOpen(false)}
                            >
                              <span>{item.label}</span>
                            </Link>
                          )}

                          {hasChildren && isExpanded ? (
                            <div className="space-y-1 pr-3">
                              {item.children?.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className="flex w-full items-center justify-end rounded-full px-4 py-2 text-right text-sm font-medium text-slate-700 transition-all duration-300 hover:bg-slate-100/90 hover:text-slate-950"
                                  onClick={() => setIsGovernanceOpen(false)}
                                >
                                  <span>{child.label}</span>
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
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
          <nav className="rounded-[1.75rem] bg-card/95 p-4 shadow-xl backdrop-blur-lg">
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

            <div className="mt-2 rounded-[1.35rem] bg-white/98 p-2 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-xl">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-right font-medium text-slate-900 transition-all duration-300 hover:bg-slate-100/90"
                onClick={() => setIsMobileGovernanceOpen((current) => !current)}
              >
                <span>الحوكمة</span>
                <ChevronDown className={`h-5 w-5 transition-transform duration-300 ${isMobileGovernanceOpen ? "rotate-180" : ""}`} />
              </button>

              <div className={`overflow-hidden transition-all duration-300 ${isMobileGovernanceOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="mt-2 space-y-2 px-2 pb-2">
                  {governanceNavigation.map((item) => (
                    <div key={item.href} className="rounded-[1.1rem] bg-slate-50/90 p-1.5">
                      {item.children?.length ? (
                        <button
                          type="button"
                          className={`flex w-full items-center justify-between rounded-full px-4 py-2.5 text-right text-sm font-medium transition-all duration-300 ${expandedGovernanceHref === item.href ? "bg-white text-slate-900 shadow-sm" : "bg-transparent text-slate-800 hover:bg-white/90"}`}
                          onClick={() => toggleGovernanceItem(item.href, true)}
                        >
                          <span>{item.label}</span>
                          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expandedGovernanceHref === item.href ? "rotate-180" : ""}`} />
                        </button>
                      ) : (
                        <div className="flex justify-end">
                          <Link
                            href={item.href}
                            className="inline-flex w-full items-center justify-end rounded-full bg-transparent px-4 py-2.5 text-right text-sm font-medium text-slate-800 transition-all duration-300 hover:bg-white/90"
                            onClick={() => {
                              setIsMenuOpen(false)
                              setIsMobileGovernanceOpen(false)
                            }}
                          >
                            {item.label}
                          </Link>
                        </div>
                      )}
                      {item.children?.length && expandedGovernanceHref === item.href ? (
                        <div className="mt-1 space-y-1 pr-3">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className="flex w-full items-center justify-end rounded-full px-4 py-2 text-right text-sm font-medium text-slate-700 transition-all duration-300 hover:bg-white/90 hover:text-slate-950"
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
