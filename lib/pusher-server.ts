import "server-only"

import Pusher from "pusher"

import { getServerEnv, hasPusherEnv } from "@/lib/env"
import type { TaskKind } from "@/lib/tasks"

let pusherServer: Pusher | null = null

function getPusherServer() {
  if (!hasPusherEnv()) {
    return null
  }

  if (pusherServer) {
    return pusherServer
  }

  const env = getServerEnv()
  pusherServer = new Pusher({
    appId: env.PUSHER_APP_ID!,
    key: env.PUSHER_KEY!,
    secret: env.PUSHER_SECRET!,
    cluster: env.PUSHER_CLUSTER!,
    useTLS: true,
  })

  return pusherServer
}

export async function triggerTasksRealtimeUpdate(kind: TaskKind) {
  const client = getPusherServer()
  if (!client) {
    return false
  }

  await client.trigger("tasks", "tasks-updated", {
    kind,
    updatedAt: new Date().toISOString(),
  })

  return true
}