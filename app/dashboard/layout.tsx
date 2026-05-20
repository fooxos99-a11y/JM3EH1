import { requireCurrentUser } from "@/lib/auth"
import { AdminDashboardShell } from "@/components/admin-dashboard-shell"
import { getSiteSectionContent } from "@/lib/site-content"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type EmployeeProfileSummary = {
  phone: string
  email: string | null
  nationalId: string
  jobRank: string
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser()
  const logo = await getSiteSectionContent("logo")
  const supabase = createSupabaseAdminClient()

  let profile: { national_id: string | null; job_rank: string | null } | null = null

  try {
    const result = await supabase
      .from("employee_profiles")
      .select("national_id,job_rank")
      .eq("user_id", user.id)
      .maybeSingle<{ national_id: string | null; job_rank: string | null }>()

    if (!result.error) {
      profile = result.data ?? null
    }
  } catch {
    profile = null
  }

  const profileSummary: EmployeeProfileSummary = {
    phone: user.phone,
    email: user.email,
    nationalId: profile?.national_id ?? "",
    jobRank: profile?.job_rank ?? "",
  }

  return <AdminDashboardShell userId={user.id} userName={user.name} userPermissions={user.permissions} userTitle={user.title} userProfileSummary={profileSummary} logoUrl={logo.logo} logoAlt={logo.alt} logoArabicName={logo.arabicName} logoEnglishName={logo.englishName} logoTextColor={logo.textColor} logoArabicFontWeight={logo.arabicFontWeight} logoEnglishFontWeight={logo.englishFontWeight}>{children}</AdminDashboardShell>
}