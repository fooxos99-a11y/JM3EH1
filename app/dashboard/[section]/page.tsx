import { notFound, redirect } from "next/navigation"

import { AboutEditor } from "@/components/dashboard/about-editor"
import { AchievementsEditor } from "@/components/dashboard/achievements-editor"
import { AdministrativeRequestsDashboard } from "@/components/dashboard/administrative-requests-dashboard"
import { AttendanceHistoryDashboard } from "@/components/dashboard/attendance-history-dashboard"
import { AchievementsPageClient } from "@/components/achievements-page-client"
import { ColorsEditor } from "@/components/dashboard/colors-editor"
import { DonationsEditor } from "@/components/dashboard/donations-editor"
import { FooterEditor } from "@/components/dashboard/footer-editor"
import { GiftingsEditor } from "@/components/dashboard/giftings-editor"
import { GalleryEditor } from "@/components/dashboard/gallery-editor"
import { GovernanceEditor } from "@/components/dashboard/governance-editor"
import { GovernanceMembershipRequestsDashboard } from "@/components/dashboard/governance-membership-requests-dashboard"
import { HeroEditor } from "@/components/dashboard/hero-editor"
import { LogoEditor } from "@/components/dashboard/logo-editor"
import { NewsEditor } from "@/components/dashboard/news-editor"
import { PartnersEditor } from "@/components/dashboard/partners-editor"
import { PermissionsEditor } from "@/components/dashboard/permissions-editor"
import { ProjectsEditor } from "@/components/dashboard/projects-editor"
import { SupportersDashboard } from "@/components/dashboard/supporters-dashboard"
import { ServicesDashboard } from "@/components/dashboard/services-dashboard"
import { requireAdminUser } from "@/lib/auth"
import { getDashboardSection } from "@/lib/dashboard"
import { getGovernancePageBySection, governanceSectionKeys } from "@/lib/governance"
import { getSiteSectionContent } from "@/lib/site-content"
import { TasksPageClient } from "@/components/tasks-page-client"

type DashboardSectionPageProps = {
  params: Promise<{ section: string }>
}

export default async function DashboardSectionPage({ params }: DashboardSectionPageProps) {
  const { section } = await params
  const currentSection = getDashboardSection(section)

  if (!currentSection) {
    notFound()
  }

  const currentUser = await requireAdminUser(currentSection.autoAccess ? undefined : currentSection.permission)

  if (currentSection.managerOnly && !currentUser.permissions.includes("*")) {
    redirect("/dashboard")
  }

  if (section === "preparation") {
    return <AdministrativeRequestsDashboard initialTab="attendance" attendanceOnly />
  }

  if (section === "preparation-history") {
    return <AttendanceHistoryDashboard canConfigureLocation={currentUser.permissions.includes("*")} />
  }

  if (section === "administrative_requests") {
    return <AdministrativeRequestsDashboard />
  }

  if (section === "supporters") {
    return <SupportersDashboard />
  }

  if (section === "services") {
    return <ServicesDashboard />
  }

  if (section === "tasks") {
    return <TasksPageClient embedded view="personal" />
  }

  if (section === "staff_tasks") {
    return <TasksPageClient embedded view="manager" />
  }

  if (section === "staff_achievements") {
    return <AchievementsPageClient embedded view="manager" />
  }

  if (section === "my_achievements") {
    return <AchievementsPageClient embedded view="personal" />
  }

  if (section === "logo") {
    const content = await getSiteSectionContent("logo")
    return <LogoEditor initialContent={content} />
  }

  if (section === "hero") {
    const content = await getSiteSectionContent("hero")
    return <HeroEditor initialContent={content} />
  }

  if (section === "donations") {
    const content = await getSiteSectionContent("donations")
    return <DonationsEditor initialContent={content} />
  }

  if (section === "projects") {
    const content = await getSiteSectionContent("projects")
    return <ProjectsEditor initialContent={content} />
  }

  if (section === "giftings") {
    const content = await getSiteSectionContent("giftings")
    return <GiftingsEditor initialContent={content} />
  }

  if (section === "achievements") {
    const content = await getSiteSectionContent("achievements")
    return <AchievementsEditor initialContent={content} />
  }

  if (section === "about") {
    const content = await getSiteSectionContent("about")
    return <AboutEditor initialContent={content} />
  }

  if (section === "news") {
    const content = await getSiteSectionContent("news")
    return <NewsEditor initialContent={content} />
  }

  if (section === "gallery") {
    const content = await getSiteSectionContent("gallery")
    return <GalleryEditor initialContent={content} />
  }

  if (section === "partners") {
    const content = await getSiteSectionContent("partners")
    return <PartnersEditor initialContent={content} />
  }

  if (section === "footer") {
    const content = await getSiteSectionContent("footer")
    return <FooterEditor initialContent={content} />
  }

  if (section === "colors") {
    const content = await getSiteSectionContent("colors")
    return <ColorsEditor initialContent={content} />
  }

  if (section === "permissions") {
    return <PermissionsEditor />
  }

  if (governanceSectionKeys.includes(section as (typeof governanceSectionKeys)[number])) {
    if (section === "governance_general_assembly_membership") {
      return <GovernanceMembershipRequestsDashboard />
    }

    const page = getGovernancePageBySection(section as (typeof governanceSectionKeys)[number])
    if (!page) {
      notFound()
    }

    const content = await getSiteSectionContent(section as keyof Parameters<typeof getSiteSectionContent>[0] & typeof section)
    return <GovernanceEditor section={page.sectionKey} pageTitle={page.label} initialContent={content} />
  }

  notFound()
}
