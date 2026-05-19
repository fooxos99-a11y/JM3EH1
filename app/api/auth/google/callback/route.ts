import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { google } from "googleapis"

import { requireCurrentUser } from "@/lib/auth"
import { createGoogleOAuthClient, getGoogleDriveConnection, GOOGLE_DRIVE_OAUTH_SCOPES, upsertGoogleDriveConnection } from "@/lib/google-oauth"

const GOOGLE_OAUTH_STATE_COOKIE = "google_drive_oauth_state"

export async function GET(request: Request) {
  const user = await requireCurrentUser()
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const cookieStore = await cookies()
  const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value

  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/dashboard/my_files?google_drive=state_error", request.url))
  }

  const redirectUri = new URL("/api/auth/google/callback", request.url).toString()
  const auth = createGoogleOAuthClient(redirectUri)
  const existingConnection = await getGoogleDriveConnection(user.id)
  const { tokens } = await auth.getToken(code)
  auth.setCredentials(tokens)

  const refreshToken = tokens.refresh_token ?? existingConnection?.refresh_token ?? null
  if (!refreshToken) {
    return NextResponse.redirect(new URL("/dashboard/my_files?google_drive=missing_refresh_token", request.url))
  }

  const oauth2 = google.oauth2({ version: "v2", auth })
  const profile = await oauth2.userinfo.get()
  const googleEmail = profile.data.email

  if (!googleEmail) {
    return NextResponse.redirect(new URL("/dashboard/my_files?google_drive=missing_email", request.url))
  }

  await upsertGoogleDriveConnection({
    user_id: user.id,
    google_email: googleEmail,
    access_token: tokens.access_token ?? existingConnection?.access_token ?? null,
    refresh_token: refreshToken,
    scope: tokens.scope ?? existingConnection?.scope ?? GOOGLE_DRIVE_OAUTH_SCOPES.join(" "),
    expires_at:
      typeof tokens.expiry_date === "number"
        ? new Date(tokens.expiry_date).toISOString()
        : (existingConnection?.expires_at ?? null),
  })

  return NextResponse.redirect(new URL("/dashboard/my_files?google_drive=connected", request.url))
}