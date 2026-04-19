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
      <div className="rounded-[2rem] border border-white/80 bg-white/95 px-6 py-12 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-white/80 bg-white/95 px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <Button type="button" variant="outline" className="rounded-2xl" onClick={handleClear}>
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
            <Card key={item.key} className="rounded-[1.75rem] border-white/80 bg-white/95">
              <CardContent className="flex flex-col gap-4 p-5 md:flex-row">
                <img src={item.image} alt={item.title} className="h-36 w-full rounded-[1.25rem] object-cover md:w-52" />
                <div className="flex flex-1 flex-col justify-between gap-4 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">{item.type === "donations" ? "فرصة تبرع" : "مشروع"}</p>
                    <h2 className="mt-1 text-xl font-bold text-foreground">{item.title}</h2>
                    <p className="mt-3 text-sm font-semibold text-primary">{item.amount} ريال</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button asChild variant="outline" className="rounded-2xl">
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

        <Card className="h-fit rounded-[1.75rem] border-white/80 bg-white/95">
          <CardContent className="space-y-4 p-5 text-right">
            <h2 className="text-lg font-bold text-foreground">ملخص السلة</h2>
            <div className="rounded-[1.25rem] border border-border/60 bg-muted/10 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-foreground">{totalAmount} ريال</span>
                <span className="text-sm text-muted-foreground">الإجمالي</span>
              </div>
            </div>
            <Button asChild className="h-11 w-full rounded-2xl">
              <Link href="/">متابعة التصفح</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}