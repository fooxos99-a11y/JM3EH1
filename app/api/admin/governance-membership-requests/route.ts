import { NextResponse } from "next/server"

import { getCurrentUser, hasPermission } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type RequestRow = {
  id: string
  full_name: string
  gender: "male" | "female"
  phone: string
  email: string | null
  national_id: string
  education_level: string
  job_title: string
  employer: string
  created_at: string
}

export async function GET() {
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  if (!hasPermission(user, "governance_general_assembly_membership")) {
    return NextResponse.json({ error: "ليس لديك صلاحية لهذا القسم" }, { status: 403 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("governance_membership_requests")
    .select("id,full_name,gender,phone,email,national_id,education_level,job_title,employer,created_at")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const rows = ((data ?? []) as RequestRow[]).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    gender: row.gender,
    phone: row.phone,
    email: row.email ?? "",
    nationalId: row.national_id,
    educationLevel: row.education_level,
    jobTitle: row.job_title,
    employer: row.employer,
    createdAt: row.created_at,
  }))

  return NextResponse.json({ rows })
}