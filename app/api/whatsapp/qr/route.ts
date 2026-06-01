import { NextResponse } from "next/server"

import QRCode from "qrcode"

import { hasPermission, requireCurrentUser } from "@/lib/auth"
import { readWhatsAppWorkerStatus } from "@/lib/whatsapp-worker-status"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  const user = await requireCurrentUser()
  if (user.role !== "admin" || !hasPermission(user, "supporters")) {
    return new NextResponse("Unauthorized", { status: 403 })
  }

  try {
    const status = await readWhatsAppWorkerStatus()
    if (!status.qrValue) {
      return new NextResponse("QR not available", { status: 404 })
    }

    const imageBuffer = await QRCode.toBuffer(status.qrValue, {
      type: "png",
      margin: 2,
      width: 420,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
    })

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    })
  } catch (error) {
    console.error("[WhatsApp] QR image error:", error)
    return new NextResponse("Failed to load QR image", { status: 500 })
  }
}