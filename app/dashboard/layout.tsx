import { requireAdminUser } from "@/lib/auth"
import { AdminDashboardShell } from "@/components/admin-dashboard-shell"
import { getSiteSectionContent } from "@/lib/site-content"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminUser()
  const logo = await getSiteSectionContent("logo")

  return <AdminDashboardShell userId={user.id} userName={user.name} userPermissions={user.permissions} userTitle={user.title} logoUrl={logo.logo} logoAlt={logo.alt} logoArabicName={logo.arabicName} logoEnglishName={logo.englishName}>{children}</AdminDashboardShell>
}