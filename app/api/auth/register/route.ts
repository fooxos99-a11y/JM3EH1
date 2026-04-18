import { hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

import { createSessionForUser, isPhoneValid, normalizePhone } from "@/lib/auth"
import { hasSupabaseEnv } from "@/lib/env"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const registerSchema = z.object({
  name: z.string().trim().min(2, "الاسم يجب أن يكون حرفين على الأقل").max(120),
  phone: z.string().trim().min(8, "رقم الجوال مطلوب"),
  email: z.union([z.string().trim().email("البريد الإلكتروني غير صحيح"), z.literal("")]).optional(),
  password: z.string().min(6, "كلمة المرور يجب أن تكون 6 أحرف على الأقل").max(100),
  supabaseAccessToken: z.string().min(1, "يجب التحقق من رقم الجوال أولًا"),
})

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "يجب ضبط متغيرات Supabase أولًا" }, { status: 503 })
  }

  try {
    const body = await request.json()
    const parsed = registerSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات التسجيل غير صحيحة" }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const normalizedPhone = normalizePhone(parsed.data.phone)
    const normalizedEmail = parsed.data.email ? parsed.data.email.toLowerCase() : null

    if (!isPhoneValid(normalizedPhone)) {
      return NextResponse.json({ error: "رقم الجوال غير صحيح" }, { status: 400 })
    }

    const { data: phoneMatch } = await supabase
      .from("app_users")
      .select("id")
      .eq("phone", normalizedPhone)
      .limit(1)

    if (phoneMatch && phoneMatch.length > 0) {
      return NextResponse.json({ error: "رقم الجوال مسجل مسبقًا" }, { status: 409 })
    }

    if (normalizedEmail) {
      const { data: emailMatch } = await supabase
        .from("app_users")
        .select("id")
        .eq("email", normalizedEmail)
        .limit(1)

      if (emailMatch && emailMatch.length > 0) {
        return NextResponse.json({ error: "البريد الإلكتروني مستخدم مسبقًا" }, { status: 409 })
      }
    }

    const {
      data: { user: verifiedUser },
      error: verifiedUserError,
    } = await supabase.auth.getUser(parsed.data.supabaseAccessToken)

    if (verifiedUserError || !verifiedUser) {
      return NextResponse.json({ error: "تعذر التحقق من رمز الجوال" }, { status: 401 })
    }

    if (!verifiedUser.phone_confirmed_at) {
      return NextResponse.json({ error: "لم يتم تأكيد رقم الجوال بعد" }, { status: 401 })
    }

    if (normalizePhone(verifiedUser.phone ?? "") !== normalizedPhone) {
      return NextResponse.json({ error: "رقم الجوال الموثق لا يطابق الرقم المدخل" }, { status: 400 })
    }

    const passwordHash = await hash(parsed.data.password, 12)
    const { data: insertedUser, error: insertError } = await supabase
      .from("app_users")
      .insert({
        auth_user_id: verifiedUser.id,
        full_name: parsed.data.name,
        phone: normalizedPhone,
        email: normalizedEmail,
        password_hash: passwordHash,
        phone_verified_at: verifiedUser.phone_confirmed_at,
      })
      .select("id,full_name,phone,email,role")
      .single<{
        id: string
        full_name: string
        phone: string
        email: string | null
        role: "admin" | "user"
      }>()

    if (insertError || !insertedUser) {
      return NextResponse.json({ error: insertError?.message ?? "تعذر إنشاء الحساب" }, { status: 500 })
    }

    await createSessionForUser(insertedUser.id)

    return NextResponse.json({
      user: {
        id: insertedUser.id,
        name: insertedUser.full_name,
        phone: insertedUser.phone,
        email: insertedUser.email,
        role: insertedUser.role,
      },
    })
  } catch {
    return NextResponse.json({ error: "حدث خطأ غير متوقع أثناء التسجيل" }, { status: 500 })
  }
}