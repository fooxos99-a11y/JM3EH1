import Link from "next/link"
import { Mail, MapPin, Phone } from "lucide-react"

import { getSiteSectionContent } from "@/lib/site-content"

export async function Footer() {
  const content = await getSiteSectionContent("footer")
  const logo = await getSiteSectionContent("logo")
  const arabicName = logo.arabicName.trim() || content.organizationName
  const englishName = logo.englishName.trim() || "New Muslims Care Association"

  return (
    <footer className="relative border-t border-border/50 bg-gradient-to-b from-[#f8fafa] to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <div className="mb-6 flex items-center gap-3">
              {logo.logo ? (
                <>
                  <div className="flex h-[84px] w-[84px] items-center justify-center px-1 py-3">
                    <img src={logo.logo} alt={logo.alt} className="h-full w-full object-contain" />
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-extrabold text-foreground">{arabicName}</h3>
                    <p className="mt-1 text-xs font-semibold tracking-[0.02em] text-muted-foreground" dir="ltr">{englishName}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[#01b5b2] shadow-lg shadow-primary/20">
                    <span className="text-xl font-bold text-white">ع</span>
                  </div>
                  <div className="text-right">
                    <h3 className="text-lg font-bold text-foreground">{arabicName}</h3>
                    <p className="text-xs text-muted-foreground" dir="ltr">{englishName}</p>
                  </div>
                </div>
              )}
            </div>

            <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{content.about}</p>

            <Link
              href="#donation"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-primary to-[#01b5b2] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-opacity hover:opacity-90"
            >
              {content.donateLabel}
            </Link>
          </div>

          <div>
            <h3 className="mb-6 text-lg font-bold text-foreground">
              روابط سريعة
            </h3>
            <ul className="space-y-3">
              {content.quickLinks.map((link) => (
                <li key={`${link.href}-${link.label}`}>
                  <Link href={link.href} className="group flex items-center gap-2 text-muted-foreground transition-colors hover:text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary/30 transition-colors group-hover:bg-primary" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-6 text-lg font-bold text-foreground">
              تواصل معنا
            </h3>
            <ul className="space-y-4">
              <li className="group flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground/70">العنوان</span>
                  <span className="text-sm text-foreground">{content.address}</span>
                </div>
              </li>
              <li className="group flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground/70">الهاتف</span>
                  <span className="text-sm text-foreground" dir="ltr">{content.phone}</span>
                </div>
              </li>
              <li className="group flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground/70">البريد</span>
                  <span className="text-sm text-foreground">{content.email}</span>
                </div>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-6 text-lg font-bold text-foreground">
              تابعنا
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">تابعنا على منصات التواصل الاجتماعي</p>
            <div className="flex gap-3">
              {content.socialLinks.map((social) => (
                <Link
                  key={`${social.label}-${social.icon}`}
                  href={social.href}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted font-bold text-muted-foreground transition-all duration-300 hover:scale-110 hover:bg-primary hover:text-white"
                  aria-label={social.label}
                >
                  {social.icon}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border/50">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-6 md:flex-row">
          <p className="text-sm text-muted-foreground">{content.copyright}</p>
          <div className="flex items-center gap-6">
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {content.privacyLabel}
            </Link>
            <Link href="#" className="text-sm text-muted-foreground transition-colors hover:text-primary">
              {content.termsLabel}
            </Link>
          </div>
        </div>
      </div>

      <Link
        href="#donation"
        className="fixed bottom-6 left-6 z-40 inline-flex h-14 items-center justify-center rounded-[1.15rem] bg-gradient-to-r from-primary to-[#01b5b2] px-7 text-base font-bold text-white shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-105 hover:opacity-95"
      >
        {content.fixedDonateLabel}
      </Link>
    </footer>
  )
}
