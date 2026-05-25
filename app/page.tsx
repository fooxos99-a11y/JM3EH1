import dynamic from "next/dynamic"

import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { DonationCards } from "@/components/donation-cards"
import { Footer } from "@/components/footer"
import { getSiteSectionsContent } from "@/lib/site-content"

const ProjectsSection = dynamic(() => import("@/components/projects-section").then((module) => module.ProjectsSection))
const GiftingsSection = dynamic(() => import("@/components/giftings-section").then((module) => module.GiftingsSection))
const AchievementsSection = dynamic(() => import("@/components/achievements-section").then((module) => module.AchievementsSection))
const NewsSection = dynamic(() => import("@/components/news-section").then((module) => module.NewsSection))
const AboutSection = dynamic(() => import("@/components/about-section").then((module) => module.AboutSection))
const GallerySection = dynamic(() => import("@/components/gallery-section").then((module) => module.GallerySection))
const PartnersSection = dynamic(() => import("@/components/partners-section").then((module) => module.PartnersSection))

export const revalidate = 300

export default async function Home() {
  const content = await getSiteSectionsContent([
    "logo",
    "hero",
    "donations",
    "projects",
    "giftings",
    "achievements",
    "news",
    "about",
    "gallery",
    "partners",
    "footer",
  ] as const)

  return (
    <main className="min-h-screen">
      <Header logo={content.logo} />
      <Hero content={content.hero} />
      <DonationCards content={content.donations} />
      <ProjectsSection content={content.projects} />
      <GiftingsSection content={content.giftings} />
      <AchievementsSection content={content.achievements} />
      <NewsSection content={content.news} />
      <AboutSection content={content.about} />
      <GallerySection content={content.gallery} />
      <PartnersSection content={content.partners} />
      <Footer content={content.footer} logo={content.logo} />
    </main>
  )
}
