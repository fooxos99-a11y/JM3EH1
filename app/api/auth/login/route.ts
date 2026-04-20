import { compare } from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

import { createSessionForUser, isPhoneValid, normalizePhone } from "@/lib/auth"
import { hasSupabaseEnv } from "@/lib/env"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const loginSchema = z.object({
  phone: z.string().trim().min(8, "رقم الجوال مطلوب"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
})

type LoginUserRow = {
  id: string
  full_name: string
  phone: string
  email: string | null
  role: "admin" | "user"
  phone_verified_at: string | null
  password_hash: string
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "يجب ضبط متغيرات Supabase أولًا" }, { status: 503 })
  }

  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الدخول غير صحيحة" }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const normalizedPhone = normalizePhone(parsed.data.phone)

    if (!isPhoneValid(normalizedPhone)) {
      return NextResponse.json({ error: "رقم الجوال غير صحيح" }, { status: 400 })
    }

    const { data: user, error } = await supabase
      .from("app_users")
      .select("id,full_name,phone,email,role,phone_verified_at,password_hash")
      .eq("phone", normalizedPhone)
      .maybeSingle<LoginUserRow>()

    if (error || !user) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 })
    }

    const passwordMatches = await compare(parsed.data.password, user.password_hash)

    if (!passwordMatches) {
      return NextResponse.json({ error: "بيانات الدخول غير صحيحة" }, { status: 401 })
    }

    if (!user.phone_verified_at) {
      return NextResponse.json({ error: "يجب توثيق رقم الجوال عبر رمز التحقق أولًا" }, { status: 403 })
    }

    await createSessionForUser(user.id)

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.full_name,
        phone: user.phone,
        email: user.email,
        role: user.role,
      },
    })
  } catch {
    return NextResponse.json({ error: "حدث خطأ غير متوقع أثناء تسجيل الدخول" }, { status: 500 })
  }
}