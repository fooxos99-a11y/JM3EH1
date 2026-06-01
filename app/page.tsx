import dynamic from "next/dynamic"

import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { getSiteSectionsContent } from "@/lib/site-content"

const DonationCards = dynamic(() => import("@/components/donation-cards").then((module) => module.DonationCards))
const ProjectsSection = dynamic(() => import("@/components/projects-section").then((module) => module.ProjectsSection))
const GiftingsSection = dynamic(() => import("@/components/giftings-section").then((module) => module.GiftingsSection))
const AchievementsSection = dynamic(() => import("@/components/achievements-section").then((module) => module.AchievementsSection))
const NewsSection = dynamic(() => import("@/components/news-section").then((module) => module.NewsSection))
const AboutSection = dynamic(() => import("@/components/about-section").then((module) => module.AboutSection))
const GallerySection = dynamic(() => import("@/components/gallery-section").then((module) => module.GallerySection))
const PartnersSection = dynamic(() => import("@/components/partners-section").then((module) => module.PartnersSection))
const Footer = dynamic(() => import("@/components/footer").then((module) => module.Footer))

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
      <div className="defer-section-render">
        <DonationCards content={content.donations} />
      </div>
      <div className="defer-section-render">
        <ProjectsSection content={content.projects} />
      </div>
      <div className="defer-section-render">
        <GiftingsSection content={content.giftings} />
      </div>
      <div className="defer-section-render">
        <AchievementsSection content={content.achievements} />
      </div>
      <div className="defer-section-render">
        <NewsSection content={content.news} />
      </div>
      <div className="defer-section-render">
        <AboutSection content={content.about} />
      </div>
      <div className="defer-section-render">
        <GallerySection content={content.gallery} />
      </div>
      <div className="defer-section-render">
        <PartnersSection content={content.partners} />
      </div>
      <div className="defer-section-render">
        <Footer content={content.footer} logo={content.logo} />
      </div>
    </main>
  )
}
