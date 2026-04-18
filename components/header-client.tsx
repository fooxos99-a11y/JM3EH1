"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { AuthDialog } from "@/components/auth-dialog"
import { Button } from "@/components/ui/button"
import type { LogoContent } from "@/lib/site-content"

export function HeaderClient({ logo }: { logo: LogoContent }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

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
    { href: "#governance", label: "الحوكمة" },
    { href: "#services", label: "الخدمات" },
  ]

  return (
    <header
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
        isScrolled ? "bg-card/95 py-3 shadow-lg backdrop-blur-lg" : "bg-transparent py-5"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="group flex items-center">
            {logo.logo ? (
              <div className="flex h-16 items-center rounded-2xl bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm transition-transform duration-300 group-hover:scale-[1.02]">
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
                className={`group relative rounded-xl px-5 py-2.5 text-sm font-medium transition-all duration-300 hover:bg-white/10 ${
                  isScrolled ? "text-foreground hover:bg-primary/10" : "text-white"
                }`}
              >
                {link.label}
                <span className="absolute bottom-1 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-accent transition-all duration-300 group-hover:w-1/2" />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <AuthDialog isScrolled={isScrolled} />

            <Button
              variant="ghost"
              size="icon"
              className={`rounded-xl lg:hidden ${isScrolled ? "text-foreground" : "text-white"}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        <div className={`overflow-hidden transition-all duration-500 lg:hidden ${isMenuOpen ? "mt-4 max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
          <nav className="rounded-2xl border border-border/50 bg-card/95 p-4 shadow-xl backdrop-blur-lg">
            {navLinks.map((link, index) => (
              <Link
                key={link.href + index}
                href={link.href}
                className="block rounded-xl px-4 py-3 font-medium text-foreground transition-all duration-300 hover:bg-primary/5 hover:text-primary"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  )
}
