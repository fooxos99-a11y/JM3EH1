import { NextResponse } from "next/server"

import { requireCurrentUser } from "@/lib/auth"
import { deleteGoogleDriveConnection } from "@/lib/google-oauth"

export async function POST() {
  try {
    const user = await requireCurrentUser()
    await deleteGoogleDriveConnection(user.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر فصل حساب Google" }, { status: 400 })
  }
}