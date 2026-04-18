import { NextResponse } from "next/server"
import { z } from "zod"

import { requireAdminUser } from "@/lib/auth"
import type { ServiceAsset, ServiceDocumentTemplate, ServicesDashboardData } from "@/lib/services"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

type AssetRow = {
  id: string
  name: string
  asset_kind: "stamp" | "signature"
  image_url: string
  created_at: string
  updated_at: string
}

type TemplateRow = {
  id: string
  title: string
  description: string
  content_html: string
  created_at: string
  updated_at: string
}

const createAssetSchema = z.object({
  type: z.literal("asset"),
  name: z.string().trim().min(1, "اسم الأصل مطلوب"),
  kind: z.enum(["stamp", "signature"]),
  imageUrl: z.string().url("رابط الصورة غير صالح"),
})

const createTemplateSchema = z.object({
  type: z.literal("template"),
  title: z.string().trim().min(1, "عنوان القالب مطلوب"),
  description: z.string().trim().default(""),
  contentHtml: z.string().default(""),
})

const updateAssetSchema = z.object({
  type: z.literal("asset"),
  id: z.string().uuid("معرّف الأصل غير صالح"),
  name: z.string().trim().min(1, "اسم الأصل مطلوب"),
  kind: z.enum(["stamp", "signature"]),
  imageUrl: z.string().url("رابط الصورة غير صالح"),
})

const updateTemplateSchema = z.object({
  type: z.literal("template"),
  id: z.string().uuid("معرّف القالب غير صالح"),
  title: z.string().trim().min(1, "عنوان القالب مطلوب"),
  description: z.string().trim().default(""),
  contentHtml: z.string().default(""),
})

const deleteSchema = z.object({
  type: z.enum(["asset", "template"]),
  id: z.string().uuid("المعرّف غير صالح"),
})

function mapAsset(row: AssetRow): ServiceAsset {
  return {
    id: row.id,
    name: row.name,
    kind: row.asset_kind,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapTemplate(row: TemplateRow): ServiceDocumentTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    contentHtml: row.content_html,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function loadDashboardData(): Promise<ServicesDashboardData> {
  const supabase = createSupabaseAdminClient()
  const [{ data: assetRows, error: assetError }, { data: templateRows, error: templateError }] = await Promise.all([
    supabase.from("service_media_assets").select("id,name,asset_kind,image_url,created_at,updated_at").order("updated_at", { ascending: false }),
    supabase.from("service_document_templates").select("id,title,description,content_html,created_at,updated_at").order("updated_at", { ascending: false }),
  ])

  if (assetError) {
    throw new Error(assetError.message)
  }

  if (templateError) {
    throw new Error(templateError.message)
  }

  return {
    assets: (assetRows ?? []).map((row) => mapAsset(row as AssetRow)),
    templates: (templateRows ?? []).map((row) => mapTemplate(row as TemplateRow)),
  }
}

export async function GET() {
  try {
    await requireAdminUser("services")
    const data = await loadDashboardData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحميل الخدمات" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdminUser("services")
    const body = await request.json()

    const supabase = createSupabaseAdminClient()

    if (body?.type === "asset") {
      const payload = createAssetSchema.parse(body)
      const { error } = await supabase.from("service_media_assets").insert({
        name: payload.name,
        asset_kind: payload.kind,
        image_url: payload.imageUrl,
        created_by: user.id,
      })

      if (error) {
        throw new Error(error.message)
      }
    } else {
      const payload = createTemplateSchema.parse(body)
      const { error } = await supabase.from("service_document_templates").insert({
        title: payload.title,
        description: payload.description,
        content_html: payload.contentHtml,
        created_by: user.id,
      })

      if (error) {
        throw new Error(error.message)
      }
    }

    return NextResponse.json(await loadDashboardData())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حفظ العنصر" }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminUser("services")
    const body = await request.json()
    const supabase = createSupabaseAdminClient()

    if (body?.type === "asset") {
      const payload = updateAssetSchema.parse(body)
      const { error } = await supabase.from("service_media_assets").update({
        name: payload.name,
        asset_kind: payload.kind,
        image_url: payload.imageUrl,
      }).eq("id", payload.id)

      if (error) {
        throw new Error(error.message)
      }
    } else {
      const payload = updateTemplateSchema.parse(body)
      const { error } = await supabase.from("service_document_templates").update({
        title: payload.title,
        description: payload.description,
        content_html: payload.contentHtml,
      }).eq("id", payload.id)

      if (error) {
        throw new Error(error.message)
      }
    }

    return NextResponse.json(await loadDashboardData())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر تحديث العنصر" }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminUser("services")
    const body = deleteSchema.parse(await request.json())
    const supabase = createSupabaseAdminClient()

    if (body.type === "asset") {
      const { error } = await supabase.from("service_media_assets").delete().eq("id", body.id)
      if (error) {
        throw new Error(error.message)
      }
    } else {
      const { error } = await supabase.from("service_document_templates").delete().eq("id", body.id)
      if (error) {
        throw new Error(error.message)
      }
    }

    return NextResponse.json(await loadDashboardData())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "تعذر حذف العنصر" }, { status: 400 })
  }
}
