import "server-only"

import { google } from "googleapis"

import { getServerEnv, hasGoogleOAuthEnv } from "@/lib/env"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

export const GOOGLE_DRIVE_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/drive",
] as const

export const GOOGLE_DRIVE_CONNECT_REQUIRED = "GOOGLE_DRIVE_CONNECT_REQUIRED"

export type GoogleDriveConnectionRow = {
  user_id: string
  google_email: string
  access_token: string | null
  refresh_token: string
  scope: string | null
  expires_at: string | null
}

export function ensureGoogleOAuthConfigured() {
  if (!hasGoogleOAuthEnv()) {
    throw new Error("لم يتم تفعيل Google OAuth في متغيرات البيئة")
  }
}

export function createGoogleOAuthClient(redirectUri?: string) {
  ensureGoogleOAuthConfigured()

  const env = getServerEnv()

  return new google.auth.OAuth2(env.GOOGLE_OAUTH_CLIENT_ID, env.GOOGLE_OAUTH_CLIENT_SECRET, redirectUri)
}

export async function getGoogleDriveConnection(userId: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("google_drive_connections")
    .select("user_id,google_email,access_token,refresh_token,scope,expires_at")
    .eq("user_id", userId)
    .maybeSingle<GoogleDriveConnectionRow>()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function upsertGoogleDriveConnection(connection: GoogleDriveConnectionRow) {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("google_drive_connections").upsert(connection, { onConflict: "user_id" })

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteGoogleDriveConnection(userId: string) {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("google_drive_connections").delete().eq("user_id", userId)

  if (error) {
    throw new Error(error.message)
  }
}