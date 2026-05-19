import { NextResponse } from "next/server"

import { requireCurrentUser } from "@/lib/auth"
import { getServerEnv, hasGoogleOAuthEnv } from "@/lib/env"
import { getGoogleDriveConnection } from "@/lib/google-oauth"

export async function GET() {
  try {
    const user = await requireCurrentUser()
    const connection = await getGoogleDriveConnection(user.id)

    return NextResponse.json({
      configured: hasGoogleOAuthEnv(),
      connected: Boolean(connection),
      googleEmail: connection?.google_email ?? null,
      clientId: hasGoogleOAuthEnv() ? getServerEnv().GOOGLE_OAUTH_CLIENT_ID : null,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل حالة الربط" }, { status: 400 })
  }
}