import { randomBytes } from "node:crypto"

import { cookies } from "next/headers"
import { NextResponse } from "next/server"

import { requireCurrentUser } from "@/lib/auth"
import { createGoogleOAuthClient, GOOGLE_DRIVE_OAUTH_SCOPES } from "@/lib/google-oauth"

const GOOGLE_OAUTH_STATE_COOKIE = "google_drive_oauth_state"

export async function GET(request: Request) {
  await requireCurrentUser()

  const state = randomBytes(24).toString("hex")
  const cookieStore = await cookies()
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })

  const redirectUri = new URL("/api/auth/google/callback", request.url).toString()
  const auth = createGoogleOAuthClient(redirectUri)
  const url = auth.generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent select_account",
    scope: [...GOOGLE_DRIVE_OAUTH_SCOPES],
    state,
  })

  return NextResponse.redirect(url)
}