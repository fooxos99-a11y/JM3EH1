import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { hasSupabaseEnv } from "@/lib/env"

export async function GET() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ user: null, configured: false })
  }

  const user = await getCurrentUser()
  return NextResponse.json({ user, configured: true })
}