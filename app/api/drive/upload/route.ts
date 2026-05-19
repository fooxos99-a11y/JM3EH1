import { NextResponse } from "next/server"

import { requireCurrentUser } from "@/lib/auth"
import { uploadDriveFile } from "@/lib/google-drive"

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser()
    const formData = await request.formData()
    const parentId = formData.get("parentId")
    const file = formData.get("file")
    const fileName = formData.get("fileName")

    if (typeof parentId !== "string" || !parentId.trim()) {
      return NextResponse.json({ error: "المجلد الهدف غير صالح" }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 })
    }

    return NextResponse.json({ item: await uploadDriveFile(user, parentId, file, typeof fileName === "string" ? fileName : null) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر رفع الملف" }, { status: 400 })
  }
}