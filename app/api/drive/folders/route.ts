import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCurrentUser } from "@/lib/auth"
import { browseDriveFolders, getUserDrivePreference, listDriveFolderOptions, setUserDrivePreference } from "@/lib/google-drive"

const getSchema = z.object({
  mode: z.enum(["list", "browser"]).optional(),
  parentId: z.string().trim().min(1).optional(),
  q: z.string().trim().optional(),
})

const patchSchema = z.object({
  folderId: z.string().trim().min(1, "المجلد غير صالح"),
  folderName: z.string().trim().min(1, "اسم المجلد غير صالح"),
})

export async function GET(request: Request) {
  try {
    const user = await requireCurrentUser()
    const parsed = getSchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات المجلدات غير صحيحة" }, { status: 400 })
    }

    if (parsed.data.mode === "browser") {
      const [browserData, preference] = await Promise.all([
        browseDriveFolders(user, parsed.data.parentId, parsed.data.q),
        getUserDrivePreference(user),
      ])

      return NextResponse.json({
        ...browserData,
        defaultFolderId: preference.defaultFolderId,
        defaultFolderName: preference.defaultFolderName,
      })
    }

    const [folders, preference] = await Promise.all([listDriveFolderOptions(user), getUserDrivePreference(user)])

    return NextResponse.json({
      folders,
      defaultFolderId: preference.defaultFolderId,
      defaultFolderName: preference.defaultFolderName,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل المجلدات" }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireCurrentUser()
    const parsed = patchSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "بيانات المجلد غير صحيحة" }, { status: 400 })
    }

    const preference = await setUserDrivePreference(user, parsed.data.folderId, parsed.data.folderName)
    return NextResponse.json(preference)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ مكان ملفاتي" }, { status: 400 })
  }
}