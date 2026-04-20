import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminUser } from "@/lib/auth"
import type { AdminChatAttachment, AdminChatData, AdminChatMessage } from "@/lib/admin-chat"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type AdminChatRow = {
  id: string
  sender_user_id: string
  message_text: string
  attachments: AdminChatAttachment[] | null
  created_at: string
}

type AppUserRow = {
  id: string
  full_name: string
}

const attachmentSchema = z.object({
  name: z.string().trim().min(1, "اسم الملف مطلوب"),
  url: z.string().url("رابط الملف غير صالح"),
  mimeType: z.string().trim().min(1, "نوع الملف مطلوب"),
  size: z.number().nonnegative().default(0),
})

const postSchema = z.object({
  messageText: z.string().default(""),
  attachments: z.array(attachmentSchema).default([]),
}).superRefine((value, context) => {
  if (!value.messageText.trim() && value.attachments.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["messageText"],
      message: "أدخل نصًا أو أرفق ملفًا واحدًا على الأقل",
    })
  }
})

function mapMessage(row: AdminChatRow, usersById: Map<string, AppUserRow>): AdminChatMessage {
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    senderName: usersById.get(row.sender_user_id)?.full_name ?? "موظف إداري",
    messageText: row.message_text,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    createdAt: row.created_at,
  }
}

async function loadChatData(currentUserId: string): Promise<AdminChatData> {
  const supabase = createSupabaseAdminClient()
  const { data: messageRows, error: messageError } = await supabase
    .from("admin_chat_messages")
    .select("id,sender_user_id,message_text,attachments,created_at")
    .order("created_at", { ascending: true })
    .limit(200)

  if (messageError) {
    throw new Error(messageError.message)
  }

  const senderIds = Array.from(new Set((messageRows ?? []).map((row) => row.sender_user_id)))
  const usersById = new Map<string, AppUserRow>()

  if (senderIds.length > 0) {
    const { data: userRows, error: userError } = await supabase
      .from("app_users")
      .select("id,full_name")
      .in("id", senderIds)

    if (userError) {
      throw new Error(userError.message)
    }

    for (const row of userRows ?? []) {
      usersById.set(row.id, row as AppUserRow)
    }
  }

  return {
    currentUserId,
    messages: (messageRows ?? []).map((row) => mapMessage(row as AdminChatRow, usersById)),
  }
}

export async function GET() {
  try {
    const user = await requireAdminUser()
    return NextResponse.json(await loadChatData(user.id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل المحادثة" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminUser()
    const payload = postSchema.parse(await request.json())
    const supabase = createSupabaseAdminClient()

    const { error } = await supabase.from("admin_chat_messages").insert({
      sender_user_id: user.id,
      message_text: payload.messageText.trim(),
      attachments: payload.attachments,
    })

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json(await loadChatData(user.id))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر إرسال الرسالة" }, { status: 400 })
  }
}
