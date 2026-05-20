import { redirect } from "next/navigation"

import { requireCurrentUser } from "@/lib/auth"
import { getFirstAccessibleDashboardPath } from "@/lib/dashboard"

export default async function DashboardIndexPage() {
  const user = await requireCurrentUser()
  redirect(getFirstAccessibleDashboardPath(user.permissions))
}