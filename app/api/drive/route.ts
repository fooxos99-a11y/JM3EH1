import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCurrentUser } from "@/lib/auth"
import { driveScopeValues, type DriveScope } from "@/lib/drive"
import { createDriveFolder, deleteDriveItem, getDriveBrowserData, moveDriveItem, renameDriveItem } from "@/lib/google-drive"

const postSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_folder"),
    parentId: z.string().trim().min(1, "المجلد الحالي غير صالح"),
    name: z.string().trim().min(1, "اسم المجلد مطلوب"),
  }),
  z.object({
    action: z.literal("rename_item"),
    itemId: z.string().trim().min(1, "العنصر غير صالح"),
    name: z.string().trim().min(1, "الاسم الجديد مطلوب"),
  }),
  z.object({
    action: z.literal("move_item"),
    itemId: z.string().trim().min(1, "العنصر غير صالح"),
    targetParentId: z.string().trim().min(1, "المجلد الهدف غير صالح"),
  }),
  z.object({
    action: z.literal("delete_item"),
    itemId: z.string().trim().min(1, "العنصر غير صالح"),
  }),
])

function parseScope(request: Request): DriveScope {
  const searchParams = new URL(request.url).searchParams
  const scope = searchParams.get("scope")

  if (scope && driveScopeValues.includes(scope as DriveScope)) {
    return scope as DriveScope
  }

  return "my_files"
}

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser()
    const searchParams = new URL(request.url).searchParams
    const folderId = searchParams.get("folderId")
    const query = searchParams.get("q")

    return NextResponse.json(await getDriveBrowserData(user, parseScope(request), folderId, query))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل الملفات" }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser()
    const parsed = postSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات الطلب غير صحيحة" }, { status: 400 })
    }

    const payload = parsed.data

    if (payload.action === "create_folder") {
      return NextResponse.json({ item: await createDriveFolder(user, payload.parentId, payload.name) })
    }

    if (payload.action === "rename_item") {
      return NextResponse.json({ item: await renameDriveItem(user, payload.itemId, payload.name) })
    }

    if (payload.action === "move_item") {
      return NextResponse.json({ item: await moveDriveItem(user, payload.itemId, payload.targetParentId) })
    }

    await deleteDriveItem(user, payload.itemId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تنفيذ العملية" }, { status: 400 })
  }
}