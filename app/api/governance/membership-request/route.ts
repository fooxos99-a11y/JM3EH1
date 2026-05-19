import { NextResponse } from "next/server"
import { z } from "zod"

import { createSupabaseAdminClient } from "@/lib/supabase/server"

const membershipRequestSchema = z.object({
  fullName: z.string().trim().min(3),
  gender: z.enum(["male", "female"]),
  phone: z.string().trim().min(8),
  email: z.string().trim().email().or(z.literal("")),
  nationalId: z.string().trim().min(5),
  educationLevel: z.string().trim().min(2),
  jobTitle: z.string().trim().min(2),
  employer: z.string().trim().min(2),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = membershipRequestSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "البيانات غير صحيحة" }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("governance_membership_requests").insert({
    full_name: parsed.data.fullName,
    gender: parsed.data.gender,
    phone: parsed.data.phone,
    email: parsed.data.email || null,
    national_id: parsed.data.nationalId,
    education_level: parsed.data.educationLevel,
    job_title: parsed.data.jobTitle,
    employer: parsed.data.employer,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}