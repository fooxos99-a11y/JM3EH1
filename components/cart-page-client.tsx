"use client"

import Link from "next/link"
import { ShoppingCart, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/hooks/use-toast"
import { clearCartEntries, getDetailHref, readCartEntries, removeCartEntry, type CartEntry } from "@/lib/fundraising-cart"

export function CartPageClient() {
  const [items, setItems] = useState<CartEntry[]>([])

  useEffect(() => {
    setItems(readCartEntries())
  }, [])

  const totalAmount = useMemo(
    () => items.reduce((sum, item) => sum + item.amount, 0),
    [items],
  )

  function handleRemove(key: string) {
    const nextItems = removeCartEntry(key)
    setItems(nextItems)
    toast({ title: "تم حذف العنصر من السلة" })
  }

  function handleClear() {
    clearCartEntries()
    setItems([])
    toast({ title: "تم تفريغ السلة" })
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[2.25rem] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f5fbfb_100%)] px-6 py-12 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <ShoppingCart className="mx-auto h-10 w-10 text-primary/60" />
        <h1 className="mt-4 text-2xl font-bold text-foreground">السلة فارغة</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">أضف عناصر من فرص التبرع أو المشاريع، وستظهر هنا مباشرة.</p>
        <Button asChild className="mt-6 rounded-2xl">
          <Link href="/">العودة إلى الرئيسية</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2.25rem] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f5fbfb_100%)] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <Button type="button" variant="outline" className="rounded-2xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleClear}>
          <Trash2 className="h-4 w-4" />
          تفريغ السلة
        </Button>
        <div className="text-right">
          <h1 className="text-2xl font-bold text-foreground">سلة التبرعات</h1>
          <p className="mt-1 text-sm text-muted-foreground">{items.length} عنصر | الإجمالي التقريبي: {totalAmount} ريال</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr,300px]">
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.key} className="overflow-hidden rounded-[1.9rem] border-white/80 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <CardContent className="flex flex-col gap-4 p-0 md:flex-row">
                <div className="relative md:w-60">
                  <img src={item.image} alt={item.title} className="h-44 w-full object-cover md:h-full" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#072b2a]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-3 right-3 rounded-full bg-white/92 px-3 py-1 text-xs font-bold text-primary">
                    {item.type === "donations" ? "فرصة تبرع" : "مشروع"}
                  </div>
                </div>
                <div className="flex flex-1 flex-col justify-between gap-4 text-right">
                  <div className="p-5 pb-0 md:pb-5">
                    <h2 className="mt-1 text-xl font-bold text-foreground">{item.title}</h2>
                    <p className="mt-3 inline-flex rounded-full bg-primary/[0.08] px-3 py-1 text-sm font-semibold text-primary">{item.amount} ريال</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 p-5 pt-0">
                    <Button asChild variant="outline" className="rounded-2xl border-primary/15 hover:bg-primary/5 hover:text-primary">
                      <Link href={getDetailHref(item.type, item.itemId)}>عرض التفاصيل</Link>
                    </Button>
                    <Button type="button" variant="ghost" className="rounded-2xl text-red-600 hover:text-red-700" onClick={() => handleRemove(item.key)}>
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="h-fit rounded-[1.9rem] border-white/80 bg-[linear-gradient(180deg,#0f766e_0%,#0b4d4a_100%)] text-white shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <CardContent className="space-y-4 p-5 text-right">
            <h2 className="text-lg font-bold text-white">ملخص السلة</h2>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/10 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-white">{totalAmount} ريال</span>
                <span className="text-sm text-white/70">الإجمالي</span>
              </div>
            </div>
            <Button asChild className="h-11 w-full rounded-2xl border-0 bg-white text-primary hover:bg-[#f4fffe]">
              <Link href="/">متابعة التصفح</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}