import "server-only"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createHash, randomBytes } from "node:crypto"

import type { DashboardPermissionKey } from "@/lib/dashboard-permissions"
import { getServerEnv } from "@/lib/env"
import { getAdminPermissionsConfig, getDefaultAdminPermissions } from "@/lib/site-content"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

export type AppRole = "admin" | "user"

export type AuthUser = {
  id: string
  name: string
  phone: string
  email: string | null
  role: AppRole
  title: string | null
  permissions: Array<DashboardPermissionKey | "*">
}

type UserRow = {
  id: string
  full_name: string
  phone: string
  email: string | null
  role: AppRole
}

type SessionRow = {
  id: string
  user_id: string
  expires_at: string
}

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30

export function normalizePhone(rawPhone: string) {
  const latinDigits = rawPhone
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d+]/g, "")

  if (latinDigits.startsWith("00966")) {
    return `+${latinDigits.slice(2)}`
  }

  if (latinDigits.startsWith("966")) {
    return `+${latinDigits}`
  }

  if (latinDigits.startsWith("05") && latinDigits.length === 10) {
    return `+966${latinDigits.slice(1)}`
  }

  if (latinDigits.startsWith("5") && latinDigits.length === 9) {
    return `+966${latinDigits}`
  }

  return latinDigits.startsWith("+") ? latinDigits : `+${latinDigits}`
}

export function isPhoneValid(phone: string) {
  return /^\+\d{9,15}$/.test(phone)
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

async function mapUser(user: UserRow): Promise<AuthUser> {
  if (user.role !== "admin") {
    return {
      id: user.id,
      name: user.full_name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      title: null,
      permissions: [],
    }
  }

  const permissionsContent = await getAdminPermissionsConfig()
  const matchedAccount = permissionsContent.accounts.find((account) => account.userId === user.id)

  return {
    id: user.id,
    name: user.full_name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    title: matchedAccount?.title ?? "مدير النظام",
    permissions: matchedAccount ? matchedAccount.permissions : getDefaultAdminPermissions(),
  }
}

async function getSessionTokenFromCookies() {
  const cookieStore = await cookies()
  const env = getServerEnv()
  return cookieStore.get(env.AUTH_SESSION_COOKIE_NAME)?.value ?? null
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies()
  const env = getServerEnv()

  cookieStore.set(env.AUTH_SESSION_COOKIE_NAME, token, {
    expires: expiresAt,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  const env = getServerEnv()

  cookieStore.set(env.AUTH_SESSION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
}

export async function createSessionForUser(userId: string) {
  const supabase = createSupabaseAdminClient()
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  const { error } = await supabase.from("app_sessions").insert({
    user_id: userId,
    token_hash: hashSessionToken(token),
    expires_at: expiresAt.toISOString(),
  })

  if (error) {
    throw new Error(error.message)
  }

  await setSessionCookie(token, expiresAt)
}

export async function getCurrentUser() {
  const token = await getSessionTokenFromCookies()

  if (!token) {
    return null
  }

  const supabase = createSupabaseAdminClient()
  const tokenHash = hashSessionToken(token)

  const { data: session, error: sessionError } = await supabase
    .from("app_sessions")
    .select("id,user_id,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle<SessionRow>()

  if (sessionError || !session) {
    return null
  }

  if (new Date(session.expires_at) <= new Date()) {
    await supabase.from("app_sessions").delete().eq("id", session.id)
    await clearSessionCookie()
    return null
  }

  const { data: user, error: userError } = await supabase
    .from("app_users")
    .select("id,full_name,phone,email,role")
    .eq("id", session.user_id)
    .maybeSingle<UserRow>()

  if (userError || !user) {
    await supabase.from("app_sessions").delete().eq("id", session.id)
    await clearSessionCookie()
    return null
  }

  return mapUser(user)
}

export function hasPermission(user: AuthUser, permission: DashboardPermissionKey) {
  return user.role === "admin" && (user.permissions.includes("*") || user.permissions.includes(permission))
}

export async function requireCurrentUser() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/")
  }

  return user
}

export async function requireAdminUser(permission?: DashboardPermissionKey) {
  const user = await requireCurrentUser()

  if (user.role !== "admin") {
    redirect("/")
  }

  if (permission && !hasPermission(user, permission)) {
    redirect("/dashboard")
  }

  return user
}

export async function invalidateCurrentSession() {
  const token = await getSessionTokenFromCookies()

  if (!token) {
    await clearSessionCookie()
    return
  }

  const supabase = createSupabaseAdminClient()
  await supabase.from("app_sessions").delete().eq("token_hash", hashSessionToken(token))
  await clearSessionCookie()
}
