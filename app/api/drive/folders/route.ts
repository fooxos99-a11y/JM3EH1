import { NextResponse } from "next/server"
import { z } from "zod"

import { requireCurrentUser } from "@/lib/auth"
import { getUserDrivePreference, listDriveFolderOptions, setUserDrivePreference } from "@/lib/google-drive"

const patchSchema = z.object({
  folderId: z.string().trim().min(1, "المجلد غير صالح"),
  folderName: z.string().trim().min(1, "اسم المجلد غير صالح"),
})

export async function GET() {
  try {
    const user = await requireCurrentUser()
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