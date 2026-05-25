import "server-only"

import { createClient } from "redis"

import { getServerEnv, hasRedisEnv } from "@/lib/env"

type RedisClient = ReturnType<typeof createClient>

let cachedClient: RedisClient | null = null
let connectPromise: Promise<RedisClient | null> | null = null
let redisDisabledUntil = 0

const REDIS_TIMEOUT_MS = 1200
const REDIS_COOLDOWN_MS = 60_000

function withTimeout<T>(promise: Promise<T>, timeoutMs = REDIS_TIMEOUT_MS) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("REDIS_TIMEOUT"))
    }, timeoutMs)

    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

function disableRedisTemporarily() {
  redisDisabledUntil = Date.now() + REDIS_COOLDOWN_MS
}

async function getRedisClient() {
  if (!hasRedisEnv()) {
    return null
  }

  if (Date.now() < redisDisabledUntil) {
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
        disableRedisTemporarily()
      })
      await withTimeout(client.connect())
      cachedClient = client
      return client
    } catch {
      cachedClient = null
      disableRedisTemporarily()
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

  try {
    const value = await withTimeout(client.get(key))
    if (!value) {
      return null
    }

    return JSON.parse(value) as T
  } catch {
    cachedClient = null
    disableRedisTemporarily()
    return null
  }
}

export async function setRedisCache(key: string, value: unknown, ttlSeconds = 60) {
  const client = await getRedisClient()
  if (!client) {
    return false
  }

  try {
    await withTimeout(client.set(key, JSON.stringify(value), {
      EX: ttlSeconds,
    }))
  } catch {
    cachedClient = null
    disableRedisTemporarily()
    return false
  }

  return true
}

export async function deleteRedisCacheKeys(keys: string[]) {
  const client = await getRedisClient()
  if (!client || keys.length === 0) {
    return 0
  }

  try {
    return await withTimeout(client.del(keys))
  } catch {
    cachedClient = null
    disableRedisTemporarily()
    return 0
  }
}

export async function deleteRedisCacheByPrefix(prefix: string) {
  const client = await getRedisClient()
  if (!client) {
    return 0
  }

  try {
    const keys = await withTimeout(client.keys(`${prefix}*`))
    if (keys.length === 0) {
      return 0
    }

    return await withTimeout(client.del(keys))
  } catch {
    cachedClient = null
    disableRedisTemporarily()
    return 0
  }
}