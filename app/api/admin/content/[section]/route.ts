import { NextResponse } from "next/server"

import { getCurrentUser, hasPermission } from "@/lib/auth"
import { getSiteSectionContent, type SiteSectionKey, upsertSiteSectionContent } from "@/lib/site-content"

function isSectionKey(value: string): value is SiteSectionKey {
  return value === "logo" || value === "hero" || value === "donations" || value === "projects" || value === "giftings" || value === "achievements" || value === "about" || value === "news" || value === "gallery" || value === "partners" || value === "footer" || value === "colors" || value === "permissions"
}

async function requireAdminApi(section?: SiteSectionKey) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  if (user.role !== "admin") {
    return NextResponse.json({ error: "هذه العملية متاحة للإدارة فقط" }, { status: 403 })
  }

  if (section && !hasPermission(user, section)) {
    return NextResponse.json({ error: "ليس لديك صلاحية لهذا القسم" }, { status: 403 })
  }

  return null
}

export async function GET(_: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!isSectionKey(section)) {
    return NextResponse.json({ error: "القسم غير مدعوم بعد" }, { status: 404 })
  }

  const authError = await requireAdminApi(section)
  if (authError) return authError

  const content = await getSiteSectionContent(section)
  return NextResponse.json({ content })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!isSectionKey(section)) {
    return NextResponse.json({ error: "القسم غير مدعوم بعد" }, { status: 404 })
  }

  const authError = await requireAdminApi(section)
  if (authError) return authError

  try {
    const body = await request.json()
    const content = await upsertSiteSectionContent(section, body)
    return NextResponse.json({ content })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ المحتوى" }, { status: 400 })
  }
}