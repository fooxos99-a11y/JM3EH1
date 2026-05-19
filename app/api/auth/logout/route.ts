import { NextResponse } from "next/server"

import { invalidateCurrentSession } from "@/lib/auth"
import { hasSupabaseEnv } from "@/lib/env"

export async function POST() {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ success: true })
  }

  await invalidateCurrentSession()
  return NextResponse.json({ success: true })
}