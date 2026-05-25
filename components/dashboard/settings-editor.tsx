"use client"

import { CircleAlert } from "lucide-react"
import { useState, useTransition } from "react"

import { WorkLocationSettingsCard } from "@/components/dashboard/work-location-settings-card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { operationalPlanWeekEndDayLabels, operationalPlanWeekEndDayValues, type OperationalPlanWeekEndDay } from "@/lib/operational-plan-settings"
import type { SettingsContent } from "@/lib/site-content"

function HelpTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full text-primary transition hover:bg-primary/10 hover:text-primary" aria-label="معلومات إضافية">
          <CircleAlert className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="max-w-72 rounded-2xl border border-white/80 bg-white px-4 py-3 text-right text-sm leading-6 text-slate-700 shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

export function SettingsEditor({ initialContent }: { initialContent: SettingsContent }) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      })

      setMessage(response.ok ? "تم حفظ الإعدادات" : "تعذر حفظ الإعدادات")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="space-y-5">
          <div className="space-y-2 text-right">
            <div className="flex flex-row-reverse items-center justify-end gap-2 text-right">
              <HelpTooltip text="اليوم المختار يحدد نهاية المهام الأسبوعية داخل الخطة التشغيلية، وتبدأ المهمة التالية بعده مباشرة." />
              <Label className="text-right">نهاية أسبوع الخطة التشغيلية</Label>
            </div>
            <Select value={content.operationalPlanWeekEndDay} onValueChange={(value) => setContent((current) => ({ ...current, operationalPlanWeekEndDay: value as OperationalPlanWeekEndDay }))}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="اختر اليوم" />
              </SelectTrigger>
              <SelectContent>
                {operationalPlanWeekEndDayValues.map((day) => (
                  <SelectItem key={day} value={day}>{operationalPlanWeekEndDayLabels[day]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            {message ? <p className="text-sm text-muted-foreground">{message}</p> : <span />}
            <Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</Button>
          </div>
        </div>
      </div>

      <WorkLocationSettingsCard />
    </section>
  )
}