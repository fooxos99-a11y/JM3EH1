import { notFound, redirect } from "next/navigation"

import { AboutEditor } from "@/components/dashboard/about-editor"
import { AchievementsEditor } from "@/components/dashboard/achievements-editor"
import { AdministrativeRequestsDashboard } from "@/components/dashboard/administrative-requests-dashboard"
import { AttendanceHistoryDashboard } from "@/components/dashboard/attendance-history-dashboard"
import { ColorsEditor } from "@/components/dashboard/colors-editor"
import { DonationsEditor } from "@/components/dashboard/donations-editor"
import { FooterEditor } from "@/components/dashboard/footer-editor"
import { DriveFilesPageClient } from "@/components/drive-files-page-client"
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
import { SettingsEditor } from "@/components/dashboard/settings-editor"
import { SupportersDashboard } from "@/components/dashboard/supporters-dashboard"
import { SupportersWhatsAppPage } from "@/components/dashboard/supporters-whatsapp-page"
import { ServicesDashboard } from "@/components/dashboard/services-dashboard"
import { OperationalPlansPageClient } from "@/components/operational-plans-page-client"
import { hasPermission, requireCurrentUser } from "@/lib/auth"
import { getDashboardSection } from "@/lib/dashboard"
import { getGovernancePageBySection, governanceSectionKeys } from "@/lib/governance"
import { getSiteSectionContent } from "@/lib/site-content"
import { TasksPageClient } from "@/components/tasks-page-client"

type DashboardSectionPageProps = {
  params: Promise<{ section: string }>
}

export default async function DashboardSectionPage({ params }: DashboardSectionPageProps) {
  const { section } = await params

  if (section === "administrative_profile") {
    redirect("/dashboard")
  }

  const currentSection = getDashboardSection(section)

  if (!currentSection) {
    notFound()
  }

  const currentUser = await requireCurrentUser()

  if (!currentSection.autoAccess) {
    if (currentUser.role !== "admin" || !hasPermission(currentUser, currentSection.permission)) {
      redirect("/dashboard")
    }
  }

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
    return <AdministrativeRequestsDashboard initialTab="submit" />
  }

  if (section === "my_requests") {
    return <AdministrativeRequestsDashboard initialTab="my_requests" />
  }

  if (section === "administrative_employment") {
    return <AdministrativeRequestsDashboard initialTab="employment" />
  }

  if (section === "administrative_leave") {
    redirect("/dashboard/administrative_balances")
  }

  if (section === "administrative_balances") {
    return <AdministrativeRequestsDashboard initialTab="balances" />
  }

  if (section === "staff_requests") {
    return <AdministrativeRequestsDashboard initialTab="reviews" />
  }

  if (section === "staff_employment_records") {
    return <AdministrativeRequestsDashboard initialTab="employment_records" />
  }

  if (section === "supporters") {
    return <SupportersDashboard />
  }

  if (section === "supporters-whatsapp") {
    return <SupportersWhatsAppPage />
  }

  if (section === "services") {
    return <ServicesDashboard initialTab="image_to_pdf" />
  }

  if (section === "service_image_to_pdf") {
    return <ServicesDashboard initialTab="image_to_pdf" />
  }

  if (section === "service_pdf_to_images") {
    return <ServicesDashboard initialTab="pdf_to_images" />
  }

  if (section === "service_compress") {
    return <ServicesDashboard initialTab="compress" />
  }

  if (section === "service_stamps") {
    return <ServicesDashboard initialTab="stamps" />
  }

  if (section === "service_writer") {
    return <ServicesDashboard initialTab="writer" />
  }

  if (section === "tasks" || section === "my_tasks") {
    return <TasksPageClient embedded view="personal" />
  }

  if (section === "my_files") {
    return <DriveFilesPageClient embedded />
  }

  if (section === "my_transactions") {
    return <TasksPageClient embedded view="personal" kind="internal_transaction" />
  }

  if (section === "staff_tasks") {
    return <TasksPageClient embedded view="manager" />
  }

  if (section === "my_operational_plans") {
    return <OperationalPlansPageClient embedded view="personal" />
  }

  if (section === "operational_plans") {
    return <OperationalPlansPageClient embedded view="manager" />
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

  if (section === "settings") {
    const content = await getSiteSectionContent("settings")
    return <SettingsEditor initialContent={content} />
  }

  const governanceSection = section as (typeof governanceSectionKeys)[number]

  if (governanceSectionKeys.includes(governanceSection)) {
    if (section === "governance_general_assembly_membership") {
      return <GovernanceMembershipRequestsDashboard />
    }

    const page = getGovernancePageBySection(governanceSection)
    if (!page) {
      notFound()
    }

    const content = await getSiteSectionContent(governanceSection)
    return <GovernanceEditor section={page.sectionKey} pageTitle={page.label} initialContent={content} />
  }

  notFound()
}
