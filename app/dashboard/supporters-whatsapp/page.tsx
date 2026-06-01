import { redirect } from "next/navigation"

import { SupportersWhatsAppPage } from "@/components/dashboard/supporters-whatsapp-page"
import { hasPermission, requireCurrentUser } from "@/lib/auth"

export default async function SupportersWhatsAppDashboardPage() {
  const user = await requireCurrentUser()

  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    redirect("/dashboard")
  }

  return <SupportersWhatsAppPage />
}