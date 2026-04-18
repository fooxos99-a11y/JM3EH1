import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { DonationCards } from "@/components/donation-cards"
import { GiftingsSection } from "@/components/giftings-section"
import { ProjectsSection } from "@/components/projects-section"
import { AchievementsSection } from "@/components/achievements-section"
import { NewsSection } from "@/components/news-section"
import { AboutSection } from "@/components/about-section"
import { GallerySection } from "@/components/gallery-section"
import { PartnersSection } from "@/components/partners-section"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Hero />
      <DonationCards />
      <ProjectsSection />
      <GiftingsSection />
      <AchievementsSection />
      <NewsSection />
      <AboutSection />
      <GallerySection />
      <PartnersSection />
      <Footer />
    </main>
  )
}
