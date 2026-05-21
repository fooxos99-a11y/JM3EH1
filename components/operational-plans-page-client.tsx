"use client"

import { CheckCircle2, LoaderCircle, Plus } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  getOperationalPlanRecurrenceLabel,
  getOperationalPlanStatusLabel,
  getOperationalPlanTargetCount,
  operationalPlanRecurrenceValues,
  type OperationalPlansPageData,
  type OperationalPlanRecurrence,
} from "@/lib/operational-plans"

const initialPlanForm = {
  title: "",
  description: "",
  year: String(new Date().getFullYear()),
  recurrence: "monthly" as OperationalPlanRecurrence,
  ownerUserId: "",
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(value))
}

export function OperationalPlansPageClient({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<OperationalPlansPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [planForm, setPlanForm] = useState(initialPlanForm)

  const targetCountPreview = useMemo(() => getOperationalPlanTargetCount(planForm.recurrence), [planForm.recurrence])

  async function loadData() {
    setLoading(true)
    const response = await fetch("/api/operational-plans", { cache: "no-store" })
    const payload = await response.json() as OperationalPlansPageData & { error?: string }

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "تعذر تحميل الخطة التشغيلية" })
      setLoading(false)
      return
    }

    setData(payload)
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  function runAction(task: () => Promise<void>) {
    setMessage(null)
    startTransition(async () => {
      try {
        await task()
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
      }
    })
  }

  function resetCreatePlanState() {
    setPlanForm(initialPlanForm)
  }

  async function handleCreatePlan() {
    const response = await fetch("/api/operational-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: planForm.title,
        description: planForm.description,
        year: Number(planForm.year),
        recurrence: planForm.recurrence,
        ownerUserId: planForm.ownerUserId,
      }),
    })

    const payload = await response.json() as OperationalPlansPageData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر إنشاء الخطة التشغيلية")
    }

    setData(payload)
    setMessage({ type: "success", text: "تم إنشاء الخطة التشغيلية" })
    setIsCreateDialogOpen(false)
    resetCreatePlanState()
  }

  async function handleUpdateOccurrenceStatus(occurrenceId: string, status: "pending" | "completed") {
    const response = await fetch("/api/operational-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_occurrence_status", occurrenceId, status }),
    })

    const payload = await response.json() as OperationalPlansPageData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر تحديث عنصر الخطة")
    }

    setData(payload)
  }

  if (loading) {
    return (
      <div className={`${embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}`}>
        <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  const content = (
    <div className={`${embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}`}>
      {message ? (
        <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          <AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle>
          {message.type === "error" ? <AlertDescription>{message.text}</AlertDescription> : null}
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" className="rounded-xl" onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          إضافة خطة تشغيلية
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {(data?.plans ?? []).length === 0 ? (
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95 xl:col-span-2">
            <CardContent className="py-12 text-center text-muted-foreground">لا توجد خطط تشغيلية مسجلة حتى الآن.</CardContent>
          </Card>
        ) : (
          (data?.plans ?? []).map((plan) => (
            <Card key={plan.id} className="rounded-[1.75rem] border-white/80 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
              <CardHeader className="space-y-4 text-right">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={plan.progressPercentage >= 100 ? "default" : "secondary"}>{getOperationalPlanStatusLabel(plan.progressPercentage)}</Badge>
                    <Badge variant="outline">{getOperationalPlanRecurrenceLabel(plan.recurrence)}</Badge>
                  </div>
                  <div className="space-y-1 text-right">
                    <CardTitle>{plan.title}</CardTitle>
                    <CardDescription>{plan.description || "بدون وصف"}</CardDescription>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                    <p className="text-xs text-muted-foreground">السنة</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{plan.year}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                    <p className="text-xs text-muted-foreground">المسؤول</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{plan.ownerUserName}</p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right">
                    <p className="text-xs text-muted-foreground">الإنجاز</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{plan.completedCount} / {plan.targetCount}</p>
                  </div>
                </div>

                <div className="space-y-2 text-right">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{plan.progressPercentage}%</span>
                    <span className="text-sm text-muted-foreground">نسبة الإنجاز</span>
                  </div>
                  <Progress value={plan.progressPercentage} className="h-3" />
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="space-y-2">
                  {plan.occurrences.map((occurrence) => (
                    <div key={occurrence.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-white/80 p-4">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={occurrence.status === "completed" ? "default" : "outline"}
                          className="rounded-xl"
                          onClick={() => runAction(() => handleUpdateOccurrenceStatus(occurrence.id, occurrence.status === "completed" ? "pending" : "completed"))}
                          disabled={isPending}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          {occurrence.status === "completed" ? "تم الإنجاز" : "تحديد كمنجز"}
                        </Button>
                      </div>
                      <div className="space-y-1 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={occurrence.status === "completed" ? "default" : "outline"}>{occurrence.status === "completed" ? "منجز" : "بانتظار التنفيذ"}</Badge>
                          <p className="font-semibold text-foreground">{occurrence.label}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">موعد التنفيذ: {formatDate(occurrence.dueAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open)
        if (!open) {
          resetCreatePlanState()
        }
      }}>
        <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-2xl" showCloseButton={false}>
          <div className="bg-[linear-gradient(135deg,rgba(1,154,151,0.08),rgba(255,255,255,0.98))] p-6">
            <DialogHeader className="items-start text-left">
              <DialogTitle className="text-2xl">إضافة خطة تشغيلية</DialogTitle>
            </DialogHeader>
          </div>

          <div className="grid gap-4 p-6 pt-2 md:grid-cols-2">
            <div className="space-y-2 text-right md:col-span-2">
              <Label>اسم الخطة</Label>
              <Input value={planForm.title} onChange={(event) => setPlanForm((current) => ({ ...current, title: event.target.value }))} />
            </div>
            <div className="space-y-2 text-right md:col-span-2">
              <Label>الوصف</Label>
              <Textarea rows={4} value={planForm.description} onChange={(event) => setPlanForm((current) => ({ ...current, description: event.target.value }))} placeholder="اختياري" />
            </div>
            <div className="space-y-2 text-right">
              <Label>السنة</Label>
              <Input type="number" min={2024} max={2100} value={planForm.year} onChange={(event) => setPlanForm((current) => ({ ...current, year: event.target.value }))} />
            </div>
            <div className="space-y-2 text-right">
              <Label>نوع التكرار</Label>
              <Select value={planForm.recurrence} onValueChange={(value) => setPlanForm((current) => ({ ...current, recurrence: value as OperationalPlanRecurrence }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {operationalPlanRecurrenceValues.map((recurrence) => (
                    <SelectItem key={recurrence} value={recurrence}>{getOperationalPlanRecurrenceLabel(recurrence)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 text-right md:col-span-2">
              <Label>المسؤول</Label>
              <Select value={planForm.ownerUserId} onValueChange={(value) => setPlanForm((current) => ({ ...current, ownerUserId: value }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(data?.assignableUsers ?? []).map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-right md:col-span-2">
              <p className="text-sm text-muted-foreground">العدد المستهدف لهذا التكرار</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{targetCountPreview} مرة خلال السنة</p>
            </div>
          </div>

          <div className="px-6 pb-6">
            <Button type="button" className="rounded-xl" onClick={() => runAction(handleCreatePlan)} disabled={isPending || !planForm.title.trim() || !planForm.year || !planForm.ownerUserId}>
              <Plus className="h-4 w-4" />
              {isPending ? "جارٍ إنشاء الخطة..." : "إضافة الخطة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )

  if (embedded) {
    return content
  }

  return <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb,#eef4f4)] px-4 py-24">{content}</main>
}