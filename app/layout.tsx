import type { Metadata } from 'next'
import { Cairo } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { getSiteSectionContent } from '@/lib/site-content'
import './globals.css'

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-cairo" });

export const metadata: Metadata = {
  title: 'العناية بالمسلمين الجدد',
  description: 'جمعية العناية بالمسلمين الجدد - بريدة',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const colors = await getSiteSectionContent('colors')
  const primaryGradientEnd = colors.mode === 'single' ? colors.primary : colors.secondary

  return (
    <html lang="ar" dir="rtl" className="bg-background">
      <body
        className={`${cairo.variable} font-sans antialiased`}
        style={{
          ['--primary' as string]: colors.primary,
          ['--ring' as string]: colors.primary,
          ['--chart-1' as string]: colors.primary,
          ['--chart-3' as string]: colors.secondary,
          ['--chart-4' as string]: primaryGradientEnd,
          ['--accent' as string]: colors.accent,
          ['--background' as string]: colors.background,
          ['--foreground' as string]: colors.foreground,
          ['--muted' as string]: colors.muted,
          ['--secondary' as string]: `${colors.primary}14`,
        }}
      >
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
