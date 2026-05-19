import { NextResponse } from "next/server"

import { getCurrentUser } from "@/lib/auth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const BUCKET_NAME = "site-assets"

function getFileExtension(fileName: string) {
  const normalizedName = fileName.trim().toLowerCase()
  const lastDotIndex = normalizedName.lastIndexOf(".")

  if (lastDotIndex === -1) {
    return ""
  }

  return normalizedName.slice(lastDotIndex + 1)
}

function inferContentType(file: File) {
  if (file.type) {
    return file.type
  }

  const extension = getFileExtension(file.name)

  if (extension === "png") return "image/png"
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg"
  if (extension === "webp") return "image/webp"
  if (extension === "gif") return "image/gif"
  if (extension === "svg") return "image/svg+xml"
  if (extension === "bmp") return "image/bmp"
  if (extension === "avif") return "image/avif"
  if (extension === "pdf") return "application/pdf"

  return "application/octet-stream"
}

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "لم يتم اختيار ملف" }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    await supabase.storage.createBucket(BUCKET_NAME, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
    })

    const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin"
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`
    const arrayBuffer = await file.arrayBuffer()

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(path, Buffer.from(arrayBuffer), {
      contentType: inferContentType(file),
      upsert: false,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, path })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر رفع الملف" }, { status: 500 })
  }
}
