import { compare, hash } from "bcryptjs"
import { NextResponse } from "next/server"
import { z } from "zod"

import { getCurrentUser } from "@/lib/auth"
import { hasSupabaseEnv } from "@/lib/env"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "كلمة المرور الحالية مطلوبة"),
    newPassword: z.string().min(6, "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل").max(100),
    confirmPassword: z.string().min(1, "تأكيد كلمة المرور الجديدة مطلوب"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "تأكيد كلمة المرور الجديدة غير مطابق",
    path: ["confirmPassword"],
  })

type PasswordRow = {
  id: string
  password_hash: string
}

export async function PATCH(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "يجب ضبط متغيرات Supabase أولًا" }, { status: 503 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = changePasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات تغيير كلمة المرور غير صحيحة" }, { status: 400 })
    }

    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return NextResponse.json({ error: "كلمة المرور الجديدة يجب أن تختلف عن الحالية" }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: userRow, error: userError } = await supabase
      .from("app_users")
      .select("id,password_hash")
      .eq("id", user.id)
      .maybeSingle<PasswordRow>()

    if (userError || !userRow) {
      return NextResponse.json({ error: "تعذر العثور على الحساب الحالي" }, { status: 404 })
    }

    const passwordMatches = await compare(parsed.data.currentPassword, userRow.password_hash)
    if (!passwordMatches) {
      return NextResponse.json({ error: "كلمة المرور الحالية غير صحيحة" }, { status: 401 })
    }

    const passwordHash = await hash(parsed.data.newPassword, 12)
    const { error: updateError } = await supabase
      .from("app_users")
      .update({ password_hash: passwordHash })
      .eq("id", user.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "حدث خطأ غير متوقع أثناء تغيير كلمة المرور" }, { status: 500 })
  }
}