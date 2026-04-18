import "server-only"

import { z } from "zod"

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  AUTH_SESSION_COOKIE_NAME: z.string().min(1).default("nm_session"),
})

type ServerEnv = z.infer<typeof serverEnvSchema>

let cachedEnv: ServerEnv | null = null

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) {
    return cachedEnv
  }

  cachedEnv = serverEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^servic:/, ""),
    AUTH_SESSION_COOKIE_NAME: process.env.AUTH_SESSION_COOKIE_NAME ?? "nm_session",
  })

  return cachedEnv
}