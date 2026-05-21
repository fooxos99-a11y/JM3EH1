import "server-only"

import { createClient } from "redis"

import { getServerEnv, hasRedisEnv } from "@/lib/env"

type RedisClient = ReturnType<typeof createClient>

let cachedClient: RedisClient | null = null
let connectPromise: Promise<RedisClient | null> | null = null

async function getRedisClient() {
  if (!hasRedisEnv()) {
    return null
  }

  if (cachedClient?.isOpen) {
    return cachedClient
  }

  if (connectPromise) {
    return connectPromise
  }

  connectPromise = (async () => {
    try {
      const client = createClient({ url: getServerEnv().REDIS_URL })
      client.on("error", () => {
        cachedClient = null
      })
      await client.connect()
      cachedClient = client
      return client
    } catch {
      cachedClient = null
      return null
    } finally {
      connectPromise = null
    }
  })()

  return connectPromise
}

export async function getRedisCache<T>(key: string) {
  const client = await getRedisClient()
  if (!client) {
    return null
  }

  const value = await client.get(key)
  if (!value) {
    return null
  }

  return JSON.parse(value) as T
}

export async function setRedisCache(key: string, value: unknown, ttlSeconds = 60) {
  const client = await getRedisClient()
  if (!client) {
    return false
  }

  await client.set(key, JSON.stringify(value), {
    EX: ttlSeconds,
  })

  return true
}

export async function deleteRedisCacheKeys(keys: string[]) {
  const client = await getRedisClient()
  if (!client || keys.length === 0) {
    return 0
  }

  return client.del(keys)
}

export async function deleteRedisCacheByPrefix(prefix: string) {
  const client = await getRedisClient()
  if (!client) {
    return 0
  }

  const keys = await client.keys(`${prefix}*`)
  if (keys.length === 0) {
    return 0
  }

  return client.del(keys)
}