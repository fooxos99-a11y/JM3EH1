import { redirect } from "next/navigation"

import { requireAdminUser } from "@/lib/auth"
import { getFirstAccessibleDashboardPath } from "@/lib/dashboard"

export default async function DashboardIndexPage() {
  const user = await requireAdminUser()
  redirect(getFirstAccessibleDashboardPath(user.permissions))
}