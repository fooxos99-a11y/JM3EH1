"use client"

import { LoaderCircle, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import {
  calculateOperationalPlanProgress,
  getOperationalPlanOccurrenceStatus,
  getOperationalPlanMonthLabel,
  normalizeOperationalPlanCount,
  type OperationalPlanDistributionMode,
  type OperationalPlanOccurrenceRecord,
  type OperationalPlanRecord,
  type OperationalPlansPageData,
} from "@/lib/operational-plans"

type OperationalPlanMutationPayload = {
  plan: OperationalPlanRecord
}

type OperationalPlanOccurrenceMutationPayload = {
  planId: string
  occurrences: OperationalPlanOccurrenceRecord[]
}

type OperationalPlanDeletePayload = {
  planId: string
}

function createInitialPlanForm() {
  return {
    title: "",
    description: "",
    year: String(new Date().getFullYear()),
    annualTarget: "12",
    distributionMode: "automatic" as OperationalPlanDistributionMode,
    monthlyTargets: Array.from({ length: 12 }, () => 0),
    ownerUserId: "",
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "medium" }).format(new Date(value))
}

function recalculatePlan(plan: OperationalPlanRecord): OperationalPlanRecord {
  const achievedTotal = plan.occurrences.reduce((sum, occurrence) => sum + occurrence.achievedValue, 0)
  const completedCount = plan.occurrences.filter((occurrence) => occurrence.progressPercentage >= 100).length
  const progressPercentage = calculateOperationalPlanProgress(achievedTotal, plan.annualTarget)

  return {
    ...plan,
    achievedTotal,
    completedCount,
    progressPercentage,
  }
}

function getOccurrenceGridTemplate(targetCount: number) {
  return `repeat(${Math.min(targetCount, 12)}, minmax(68px, 1fr))`
}

function getOccurrenceHeaderLabel(plan: OperationalPlanRecord, occurrence: OperationalPlanOccurrenceRecord) {
  void plan
  return occurrence.label
}

function isCurrentPlanMonth(year: number, monthNumber: number) {
  const now = new Date()

  return year === now.getFullYear() && monthNumber === now.getMonth() + 1
}

export function OperationalPlansPageClient({ embedded = false, view = "personal" }: { embedded?: boolean; view?: "personal" | "manager" }) {
  const [data, setData] = useState<OperationalPlansPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pendingOccurrenceIds, setPendingOccurrenceIds] = useState<string[]>([])
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [activeProgressOccurrenceId, setActiveProgressOccurrenceId] = useState<string | null>(null)
  const [occurrenceAchievedDraft, setOccurrenceAchievedDraft] = useState(0)
  const [targetMonthDraft, setTargetMonthDraft] = useState("")
  const [planForm, setPlanForm] = useState(createInitialPlanForm)
  const [selectedOwnerId, setSelectedOwnerId] = useState("")
  const [activeDescriptionPlanId, setActiveDescriptionPlanId] = useState<string | null>(null)
  const [activeDeletePlanId, setActiveDeletePlanId] = useState<string | null>(null)
  const [isCreatingPlan, setIsCreatingPlan] = useState(false)
  const [isDeletingPlan, setIsDeletingPlan] = useState(false)
  const [isSavingOccurrenceProgress, setIsSavingOccurrenceProgress] = useState(false)

  const annualTargetPreview = useMemo(() => normalizeOperationalPlanCount(Number(planForm.annualTarget)), [planForm.annualTarget])
  const manualPlannedTotal = useMemo(() => planForm.monthlyTargets.reduce((sum, value) => sum + value, 0), [planForm.monthlyTargets])
  const remainingManualTarget = annualTargetPreview - manualPlannedTotal
  const planningMonths = useMemo(() => {
    const year = normalizeOperationalPlanCount(Number(planForm.year)) || new Date().getFullYear()

    return Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(Date.UTC(year, index, 1))

      return {
        monthNumber: index + 1,
        label: `${getOperationalPlanMonthLabel(monthDate)} (${index + 1})`,
      }
    })
  }, [planForm.year])
  const ownerOptions = useMemo(() => {
    const owners = new Map<string, { id: string; name: string }>()

    for (const plan of data?.plans ?? []) {
      const ownerId = plan.ownerUserId ?? "unassigned"
      if (!owners.has(ownerId)) {
        owners.set(ownerId, { id: ownerId, name: plan.ownerUserName })
      }
    }

    return Array.from(owners.values())
  }, [data?.plans])
  const plansForSelectedOwner = useMemo(() => {
    return (data?.plans ?? []).filter((plan) => {
      const ownerId = plan.ownerUserId ?? "unassigned"
      return ownerId === selectedOwnerId
    })
  }, [data?.plans, selectedOwnerId])
  const activeDescriptionPlan = useMemo(() => {
    return (data?.plans ?? []).find((plan) => plan.id === activeDescriptionPlanId) ?? null
  }, [activeDescriptionPlanId, data?.plans])
  const activeDeletePlan = useMemo(() => {
    return (data?.plans ?? []).find((plan) => plan.id === activeDeletePlanId) ?? null
  }, [activeDeletePlanId, data?.plans])
  const activeProgressOccurrence = useMemo(() => {
    for (const plan of data?.plans ?? []) {
      const occurrence = plan.occurrences.find((item) => item.id === activeProgressOccurrenceId)
      if (occurrence) {
        return { plan, occurrence }
      }
    }

    return null
  }, [activeProgressOccurrenceId, data?.plans])
  const targetMonthOptions = useMemo(() => {
    if (!activeProgressOccurrence) {
      return []
    }

    return activeProgressOccurrence.plan.occurrences.map((occurrence) => ({
      value: String(occurrence.monthNumber),
      label: occurrence.label,
    }))
  }, [activeProgressOccurrence])
  const selectedTargetMonthMax = useMemo(() => {
    if (!activeProgressOccurrence) {
      return 1
    }

    const sourceTargetValue = activeProgressOccurrence.occurrence.targetValue
    const selectedMonthNumber = Number(targetMonthDraft || activeProgressOccurrence.occurrence.monthNumber)
    const destinationOccurrence = activeProgressOccurrence.plan.occurrences.find((occurrence) => occurrence.monthNumber === selectedMonthNumber)

    if (!destinationOccurrence) {
      return Math.max(sourceTargetValue, 1)
    }

    return Math.max(selectedMonthNumber === activeProgressOccurrence.occurrence.monthNumber ? sourceTargetValue : sourceTargetValue + destinationOccurrence.targetValue, 1)
  }, [activeProgressOccurrence, targetMonthDraft])
  const resolvedSelectedOwnerId = useMemo(() => {
    if (ownerOptions.length === 0) {
      return ""
    }

    return ownerOptions.some((owner) => owner.id === selectedOwnerId) ? selectedOwnerId : ownerOptions[0]?.id ?? ""
  }, [ownerOptions, selectedOwnerId])

  async function loadData() {
    setLoading(true)
    const response = await fetch(`/api/operational-plans?scope=${view === "manager" ? "all" : "self"}`, { cache: "no-store" })
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
  }, [view])

  useEffect(() => {
    function handleOpenCreatePlan() {
      setIsCreateDialogOpen(true)
    }

    window.addEventListener("operational-plans-open-create-plan", handleOpenCreatePlan)

    return () => {
      window.removeEventListener("operational-plans-open-create-plan", handleOpenCreatePlan)
    }
  }, [])

  useEffect(() => {
    if (selectedOwnerId !== resolvedSelectedOwnerId) {
      setSelectedOwnerId(resolvedSelectedOwnerId)
    }
  }, [resolvedSelectedOwnerId, selectedOwnerId])

  function resetCreatePlanState() {
    setPlanForm(createInitialPlanForm())
  }

  function updateMonthlyTarget(monthIndex: number, nextValue: number) {
    setPlanForm((current) => {
      const monthlyTargets = [...current.monthlyTargets]
      monthlyTargets[monthIndex] = normalizeOperationalPlanCount(nextValue)

      return {
        ...current,
        monthlyTargets,
      }
    })
  }

  function incrementMonthlyTarget(monthIndex: number) {
    if (planForm.distributionMode !== "manual" || remainingManualTarget <= 0) {
      return
    }

    updateMonthlyTarget(monthIndex, planForm.monthlyTargets[monthIndex] + 1)
  }

  function decrementMonthlyTarget(monthIndex: number) {
    updateMonthlyTarget(monthIndex, Math.max(0, planForm.monthlyTargets[monthIndex] - 1))
  }

  function resetManualPlanning() {
    setPlanForm((current) => ({
      ...current,
      monthlyTargets: Array.from({ length: 12 }, () => 0),
    }))
  }

  function appendPlanLocally(plan: OperationalPlanRecord) {
    setData((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        plans: [plan, ...current.plans],
      }
    })
    setSelectedOwnerId(plan.ownerUserId ?? "unassigned")
  }

  function applyOccurrenceLocally(planId: string, occurrenceId: string, achievedValue: number) {
    const normalizedAchievedValue = normalizeOperationalPlanCount(achievedValue)

    setData((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        plans: current.plans.map((plan) => {
          if (plan.id !== planId) {
            return plan
          }

          return recalculatePlan({
            ...plan,
            occurrences: plan.occurrences.map((occurrence) => {
              if (occurrence.id !== occurrenceId) {
                return occurrence
              }

              const progressPercentage = calculateOperationalPlanProgress(normalizedAchievedValue, occurrence.targetValue)
              const status = getOperationalPlanOccurrenceStatus(progressPercentage)

              return {
                ...occurrence,
                achievedValue: normalizedAchievedValue,
                progressPercentage,
                status,
                completedAt: status === "completed" ? new Date().toISOString() : null,
              }
            }),
          })
        }),
      }
    })
  }

  function reconcileOccurrenceLocally(payload: OperationalPlanOccurrenceMutationPayload) {
    const occurrencesById = new Map(payload.occurrences.map((occurrence) => [occurrence.id, occurrence]))

    setData((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        plans: current.plans.map((plan) => {
          if (plan.id !== payload.planId) {
            return plan
          }

          return recalculatePlan({
            ...plan,
            occurrences: plan.occurrences.map((occurrence) => {
              const nextOccurrence = occurrencesById.get(occurrence.id)
              if (!nextOccurrence) {
                return occurrence
              }

              return {
                ...occurrence,
                targetValue: nextOccurrence.targetValue,
                achievedValue: nextOccurrence.achievedValue,
                progressPercentage: nextOccurrence.progressPercentage,
                status: nextOccurrence.status,
                completedAt: nextOccurrence.completedAt,
              }
            }),
          })
        }),
      }
    })
  }

  function removePlanLocally(planId: string) {
    setData((current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        plans: current.plans.filter((plan) => plan.id !== planId),
      }
    })
    setActiveDeletePlanId((current) => (current === planId ? null : current))
    setActiveDescriptionPlanId((current) => (current === planId ? null : current))
  }

  async function handleCreatePlan() {
    const response = await fetch("/api/operational-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: planForm.title,
        description: planForm.description,
        year: Number(planForm.year),
        annualTarget: Number(planForm.annualTarget),
        distributionMode: planForm.distributionMode,
        monthlyTargets: planForm.distributionMode === "manual" ? planForm.monthlyTargets : undefined,
        ownerUserId: planForm.ownerUserId,
      }),
    })

    const payload = await response.json() as OperationalPlanMutationPayload & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر إنشاء الخطة التشغيلية")
    }

    appendPlanLocally(payload.plan)
    setMessage({ type: "success", text: "تم إنشاء الخطة التشغيلية" })
    setIsCreateDialogOpen(false)
    resetCreatePlanState()
  }

  async function handleCreatePlanClick() {
    if (isCreatingPlan) {
      return
    }

    setMessage(null)
    setIsCreatingPlan(true)

    try {
      await handleCreatePlan()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
    } finally {
      setIsCreatingPlan(false)
    }
  }

  async function handleUpdateOccurrenceAchievement(planId: string, monthNumber: number, achievedValue: number) {
    const previousData = data

    applyOccurrenceLocally(planId, `${planId}-${monthNumber}`, achievedValue)

    const response = await fetch("/api/operational-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_occurrence_achievement", planId, monthNumber, achievedValue }),
    })

    const payload = await response.json() as OperationalPlanOccurrenceMutationPayload & { error?: string }
    if (!response.ok) {
      setData(previousData)
      throw new Error(payload.error ?? "تعذر تحديث عنصر الخطة")
    }

    reconcileOccurrenceLocally(payload)
  }

  async function handleDeletePlan(planId: string) {
    const response = await fetch(`/api/operational-plans?planId=${planId}`, {
      method: "DELETE",
    })

    const payload = await response.json() as OperationalPlanDeletePayload & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حذف الخطة التشغيلية")
    }

    removePlanLocally(payload.planId)
    setMessage({ type: "success", text: "تم حذف الخطة التشغيلية" })
    setIsDeleteDialogOpen(false)
  }

  function openOccurrenceProgressDialog(occurrence: OperationalPlanOccurrenceRecord) {
    setOccurrenceAchievedDraft(occurrence.achievedValue)
    setTargetMonthDraft(String(occurrence.monthNumber))
    setActiveProgressOccurrenceId(occurrence.id)
  }

  async function handleMoveOccurrenceTarget(planId: string, fromMonthNumber: number, toMonthNumber: number) {
    const response = await fetch("/api/operational-plans", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move_occurrence_target", planId, fromMonthNumber, toMonthNumber }),
    })

    const payload = await response.json() as OperationalPlanOccurrenceMutationPayload & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر نقل الشهر المستهدف")
    }

    reconcileOccurrenceLocally(payload)
  }

  async function handleSaveOccurrenceProgress() {
    if (!activeProgressOccurrence || isSavingOccurrenceProgress) {
      return
    }

    const occurrenceId = activeProgressOccurrence.occurrence.id
    if (pendingOccurrenceIds.includes(occurrenceId)) {
      return
    }

    setMessage(null)
    setIsSavingOccurrenceProgress(true)
    setPendingOccurrenceIds((current) => [...current, occurrenceId])

    try {
      const sourceMonthNumber = activeProgressOccurrence.occurrence.monthNumber
      const destinationMonthNumber = Number(targetMonthDraft)

      if (destinationMonthNumber !== sourceMonthNumber) {
        await handleMoveOccurrenceTarget(activeProgressOccurrence.plan.id, sourceMonthNumber, destinationMonthNumber)
        setActiveProgressOccurrenceId(`${activeProgressOccurrence.plan.id}-${destinationMonthNumber}`)
      }

      await handleUpdateOccurrenceAchievement(
        activeProgressOccurrence.plan.id,
        destinationMonthNumber,
        occurrenceAchievedDraft,
      )
      setActiveProgressOccurrenceId(null)
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
    } finally {
      setIsSavingOccurrenceProgress(false)
      setPendingOccurrenceIds((current) => current.filter((id) => id !== occurrenceId))
    }
  }

  async function handleDeletePlanClick() {
    if (!activeDeletePlan || isDeletingPlan) {
      return
    }

    setMessage(null)
    setIsDeletingPlan(true)

    try {
      await handleDeletePlan(activeDeletePlan.id)
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
    } finally {
      setIsDeletingPlan(false)
    }
  }

  if (loading) {
    return (
      <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>
        <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  const content = (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-6xl space-y-5"}>
      {message ? (
        <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          <AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle>
          {message.type === "error" ? <AlertDescription>{message.text}</AlertDescription> : null}
        </Alert>
      ) : null}

      <div className="grid gap-4">
        {(data?.plans ?? []).length === 0 ? (
          <Card className="rounded-[1.75rem] border border-slate-200 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <CardContent className="space-y-4 py-12 text-center text-muted-foreground">
              <p>لا توجد خطة تشغيلية مخصصة لك حالياً.</p>
            </CardContent>
          </Card>
        ) : ownerOptions.length === 0 ? (
          <Card className="rounded-[1.75rem] border border-slate-200 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <CardContent className="space-y-4 py-12 text-center text-muted-foreground">
              <p>لا يوجد موظفون مرتبطون بخطط تشغيلية حالياً.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_22px_60px_rgba(15,23,42,0.08)]">
            <CardHeader className="border-b border-slate-200/80 bg-white p-5 sm:p-6">
              <div className="space-y-4 text-right">
                <div className="space-y-2">
                  <Label className="text-slate-700">الموظف</Label>
                  <Select value={resolvedSelectedOwnerId} onValueChange={setSelectedOwnerId} disabled={ownerOptions.length <= 1}>
                    <SelectTrigger className="h-12 rounded-2xl border-slate-300 bg-white sm:max-w-sm"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>
                      {ownerOptions.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>{owner.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-5 sm:p-6">
              {plansForSelectedOwner.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  لا توجد خطط تشغيلية لهذا الموظف حالياً.
                </div>
              ) : (
                plansForSelectedOwner.map((plan) => {
                  const gridTemplateColumns = getOccurrenceGridTemplate(plan.targetCount)

                  return (
                    <div key={plan.id} className="rounded-[1.6rem] border border-slate-200 bg-slate-50/45 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1 space-y-3 text-right">
                            <button
                              type="button"
                              className="block w-full text-right text-xl font-bold text-slate-900 transition hover:text-primary"
                              onClick={() => setActiveDescriptionPlanId(plan.id)}
                            >
                              {plan.title}
                            </button>

                            <div className="flex items-center gap-3">
                              <Progress value={plan.progressPercentage} className="h-2.5 w-full max-w-[280px] rounded-full bg-slate-200" />
                              <p className="shrink-0 text-sm text-slate-500">{plan.achievedTotal}/{plan.annualTarget}</p>
                            </div>
                          </div>

                          {data?.isManager ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                setActiveDeletePlanId(plan.id)
                                setIsDeleteDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          ) : <div className="h-9 w-9 shrink-0" />}
                        </div>

                        <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
                          <div className="w-full min-w-full space-y-2">
                            <div className="grid w-full gap-2" style={{ gridTemplateColumns }}>
                              {plan.occurrences.map((occurrence) => (
                                <div key={`header-${occurrence.id}`} className="text-center text-xs font-medium text-slate-400">
                                  {getOccurrenceHeaderLabel(plan, occurrence)}
                                </div>
                              ))}
                            </div>

                            <div className="grid w-full gap-2" style={{ gridTemplateColumns }}>
                              {plan.occurrences.map((occurrence) => (
                                (() => {
                                  const isCurrentMonthOccurrence = isCurrentPlanMonth(plan.year, occurrence.monthNumber)

                                  return (
                                <button
                                  key={occurrence.id}
                                  type="button"
                                  className={`h-11 rounded-xl border px-1 text-center text-xs font-semibold transition sm:h-12 sm:px-2 sm:text-sm ${occurrence.progressPercentage >= 100 ? "border-primary bg-primary text-white shadow-[0_10px_20px_rgba(1,154,151,0.24)]" : occurrence.achievedValue > 0 ? "border-primary/40 bg-primary/10 text-primary hover:border-primary hover:bg-primary/15" : occurrence.targetValue > 0 && isCurrentMonthOccurrence ? "border-[#e3b17a] bg-[#fbf1e4] text-[#a96315] hover:border-[#d89b5d] hover:bg-[#f8e6d0]" : occurrence.targetValue > 0 ? "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50" : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"}`}
                                  title={`${occurrence.label} - ${formatDate(occurrence.dueAt)}`}
                                  onClick={() => {
                                    if (occurrence.targetValue <= 0 && occurrence.achievedValue <= 0) {
                                      return
                                    }

                                    openOccurrenceProgressDialog(occurrence)
                                  }}
                                  disabled={pendingOccurrenceIds.includes(occurrence.id) || (occurrence.targetValue <= 0 && occurrence.achievedValue <= 0)}
                                >
                                  {pendingOccurrenceIds.includes(occurrence.id) ? <LoaderCircle className="mx-auto h-4 w-4 animate-spin" /> : `${occurrence.achievedValue}/${occurrence.targetValue}`}
                                </button>
                                  )
                                })()
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog
        open={data?.isManager ? isCreateDialogOpen : false}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (!open) {
            resetCreatePlanState()
          }
        }}
      >
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
              <Label>المستهدف السنوي</Label>
              <Input type="number" min={1} max={10000} value={planForm.annualTarget} onChange={(event) => setPlanForm((current) => ({ ...current, annualTarget: event.target.value }))} />
            </div>
            <div className="space-y-2 text-right md:col-span-2">
              <Label>طريقة توزيع المستهدف</Label>
              <Select value={planForm.distributionMode} onValueChange={(value) => setPlanForm((current) => ({ ...current, distributionMode: value as OperationalPlanDistributionMode }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="automatic">توزيع تلقائي</SelectItem>
                  <SelectItem value="manual">تحديد يدوي للأشهر</SelectItem>
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
              <p className="text-sm text-muted-foreground">{planForm.distributionMode === "manual" ? "حدد الأشهر المخطط لها يدويًا. البرتقالي يظهر فقط للشهر الحالي عندما يكون مخططًا." : "سيتم توزيع المستهدف السنوي تلقائيًا على 12 شهرًا"}</p>
              <p className="mt-1 text-lg font-semibold text-foreground">المستهدف الحالي: {annualTargetPreview}</p>
              {planForm.distributionMode === "manual" ? <p className="mt-1 text-sm text-slate-500">المخطط يدويًا: {manualPlannedTotal} من {annualTargetPreview}</p> : null}
            </div>
            {planForm.distributionMode === "manual" ? (
              <div className="space-y-3 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Button type="button" variant="outline" className="rounded-xl" onClick={resetManualPlanning}>تصفير التخطيط</Button>
                  <p className={`text-sm ${remainingManualTarget === 0 ? "text-emerald-600" : remainingManualTarget > 0 ? "text-slate-500" : "text-red-600"}`}>المتبقي للتوزيع: {remainingManualTarget}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {planningMonths.map((month, index) => {
                    const plannedValue = planForm.monthlyTargets[index]
                    const isCurrentMonthCard = isCurrentPlanMonth(Number(planForm.year) || new Date().getFullYear(), month.monthNumber)

                    return (
                      <div key={month.monthNumber} className={`rounded-[1.25rem] border p-3 text-right transition ${plannedValue > 0 && isCurrentMonthCard ? "border-[#e3b17a] bg-[#fbf1e4]" : "border-slate-200 bg-white"}`}>
                        <p className={`text-sm font-semibold ${plannedValue > 0 && isCurrentMonthCard ? "text-[#a96315]" : "text-slate-700"}`}>{month.label}</p>
                        <p className="mt-2 text-2xl font-bold text-slate-900">{plannedValue}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => decrementMonthlyTarget(index)} disabled={plannedValue <= 0}>-</Button>
                          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => incrementMonthlyTarget(index)} disabled={remainingManualTarget <= 0}>+</Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="px-6 pb-6">
            <Button type="button" className="rounded-xl" onClick={() => void handleCreatePlanClick()} disabled={isCreatingPlan || !planForm.title.trim() || !planForm.year || !planForm.ownerUserId || annualTargetPreview <= 0 || (planForm.distributionMode === "manual" && manualPlannedTotal !== annualTargetPreview)}>
              <Plus className="h-4 w-4" />
              {isCreatingPlan ? "جارٍ إنشاء الخطة..." : "إضافة الخطة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={activeDescriptionPlan !== null} onOpenChange={(open) => setActiveDescriptionPlanId(open ? activeDescriptionPlanId : null)}>
        <DialogContent className="max-w-xl rounded-[2rem] border-border/60 text-right" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-2xl text-slate-900">{activeDescriptionPlan?.title ?? "تفاصيل الخطة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm leading-8 text-slate-600">{activeDescriptionPlan?.description || "لا يوجد وصف لهذه الخطة."}</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeProgressOccurrence !== null}
        onOpenChange={(open) => {
          if (!open && !isSavingOccurrenceProgress) {
            setActiveProgressOccurrenceId(null)
          }
        }}
      >
        <DialogContent className="max-w-lg rounded-[2rem] border-border/60 text-right" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle className="text-2xl text-slate-900">المنجز الشهري</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 px-2 py-3">
            <div className="space-y-2">
              <Label>الشهر المستهدف</Label>
              <Select value={targetMonthDraft} onValueChange={setTargetMonthDraft}>
                <SelectTrigger className="w-full rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {targetMonthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Slider
              value={[occurrenceAchievedDraft]}
              min={0}
              max={selectedTargetMonthMax}
              step={1}
              className="py-6"
              onValueChange={([value]) => setOccurrenceAchievedDraft(normalizeOperationalPlanCount(value ?? 0))}
            />

            <Button type="button" className="w-full rounded-xl" onClick={() => void handleSaveOccurrenceProgress()} disabled={isSavingOccurrenceProgress}>
              {isSavingOccurrenceProgress ? "جارٍ حفظ المنجز..." : "حفظ المنجز"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={data?.isManager ? isDeleteDialogOpen : false} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md rounded-[2rem] border-border/60 text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الخطة التشغيلية</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الخطة "{activeDeletePlan?.title ?? ""}" نهائياً مع المهام المولدة منها. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault()
                void handleDeletePlanClick()
              }}
            >
              {isDeletingPlan ? "جارٍ حذف الخطة..." : "حذف الخطة"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )

  if (embedded) {
    return content
  }

  return <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb,#eef4f4)] px-4 py-24">{content}</main>
}