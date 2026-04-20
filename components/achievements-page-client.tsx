"use client"

import { ChevronLeft, ChevronRight, Eye, ImagePlus, LoaderCircle, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { AchievementsPageData, WeeklyAchievementEntry } from "@/lib/achievements-log"

const initialForm = {
  achievementText: "",
  imageUrl: "",
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function shiftWeek(value: string, weeks: number) {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + (weeks * 7))
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${year}-${month}-${day}`
}

export function AchievementsPageClient({ embedded = false, view = "personal" }: { embedded?: boolean; view?: "personal" | "manager" }) {
  const [data, setData] = useState<AchievementsPageData | null>(null)
  const [selectedWeekStartDate, setSelectedWeekStartDate] = useState<string>("")
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [form, setForm] = useState(initialForm)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [isUploading, setIsUploading] = useState(false)
  const [viewerEntries, setViewerEntries] = useState<WeeklyAchievementEntry[]>([])
  const [viewerIndex, setViewerIndex] = useState(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)

  async function loadData(weekStartDate?: string) {
    setLoading(true)
    const response = await fetch(`/api/achievements${weekStartDate ? `?weekStartDate=${weekStartDate}` : ""}`, { cache: "no-store" })
    const payload = await response.json() as AchievementsPageData & { error?: string }

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "تعذر تحميل الإنجازات" })
      setLoading(false)
      return
    }

    setData(payload)
    setSelectedWeekStartDate(payload.selectedWeekStartDate)
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  useEffect(() => {
    if (view !== "manager" || !data) {
      return
    }

    const currentUserExists = data.teamUsers.some((user) => user.userId === selectedUserId)
    if (!currentUserExists) {
      setSelectedUserId(data.teamUsers[0]?.userId ?? "")
    }
  }, [data, selectedUserId, view])

  const isCurrentWeek = useMemo(
    () => data ? data.selectedWeekStartDate === data.currentWeekStartDate : false,
    [data],
  )

  const selectedTeamGroup = useMemo(() => {
    if (!data || !selectedUserId) {
      return null
    }

    return data.teamGroups.find((group) => group.userId === selectedUserId) ?? null
  }, [data, selectedUserId])

  const hasPreviousWeekEntries = useMemo(() => {
    if (!data) {
      return false
    }

    if (view === "manager") {
      return data.teamGroups.some((group) => group.entries.length > 0)
    }

    return data.myEntries.length > 0
  }, [data, view])

  async function uploadImage(file: File) {
    setIsUploading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const payload = await response.json() as { url?: string; error?: string }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "تعذر رفع الصورة")
      }

      setForm((current) => ({ ...current, imageUrl: payload.url ?? "" }))
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر رفع الصورة" })
    } finally {
      setIsUploading(false)
    }
  }

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

  async function handleCreateAchievement() {
    const response = await fetch("/api/achievements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        achievementText: form.achievementText,
        imageUrl: form.imageUrl || null,
        weekStartDate: selectedWeekStartDate,
      }),
    })

    const payload = await response.json() as AchievementsPageData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حفظ الإنجاز")
    }

    setData(payload)
    setForm(initialForm)
    setMessage({ type: "success", text: "تم حفظ الإنجاز في الأسبوع الحالي" })
  }

  async function handleSaveAchievement() {
    if (editingEntryId) {
      const response = await fetch("/api/achievements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: editingEntryId,
          achievementText: form.achievementText,
          imageUrl: form.imageUrl || null,
        }),
      })

      const payload = await response.json() as AchievementsPageData & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر تعديل الإنجاز")
      }

      setData(payload)
      setForm(initialForm)
      setEditingEntryId(null)
      setMessage({ type: "success", text: "تم تعديل الإنجاز" })
      return
    }

    await handleCreateAchievement()
  }

  async function handleDeleteAchievement(entryId: string) {
    const response = await fetch("/api/achievements", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId }),
    })

    const payload = await response.json() as AchievementsPageData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حذف الإنجاز")
    }

    setData(payload)
    if (editingEntryId === entryId) {
      setForm(initialForm)
      setEditingEntryId(null)
    }
    setMessage({ type: "success", text: "تم حذف الإنجاز" })
  }

  function handleEditAchievement(entryId: string) {
    const entry = data?.myEntries.find((item) => item.id === entryId)
    if (!entry) {
      return
    }

    setEditingEntryId(entryId)
    setForm({
      achievementText: entry.achievementText,
      imageUrl: entry.imageUrl ?? "",
    })
  }

  function openViewer(entries: WeeklyAchievementEntry[], entryId?: string) {
    const index = entryId ? entries.findIndex((entry) => entry.id === entryId) : 0
    if (entryId && index < 0) {
      return
    }

    setViewerEntries(entries)
    setViewerIndex(index >= 0 ? index : 0)
    setIsViewerOpen(true)
  }

  function showPreviousViewerEntry() {
    setViewerIndex((current) => Math.max(0, current - 1))
  }

  function showNextViewerEntry() {
    setViewerIndex((current) => Math.min(viewerEntries.length - 1, current + 1))
  }

  useEffect(() => {
    if (!isViewerOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        showNextViewerEntry()
      }

      if (event.key === "ArrowRight") {
        showPreviousViewerEntry()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isViewerOpen, viewerEntries.length])

  const activeViewerEntry = viewerEntries[viewerIndex] ?? null

  if (loading) {
    if (embedded) {
      return (
        <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
        </div>
      )
    }

    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb,#eef4f4)] px-4 py-24">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/70 bg-white/95 p-12 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
        </div>
      </main>
    )
  }

  if (!data) {
    if (embedded) {
      return <Alert variant="destructive" className="rounded-[1.5rem] text-right"><AlertTitle>تعذر تحميل صفحة الإنجازات</AlertTitle><AlertDescription>{message?.text ?? "حدث خطأ أثناء تحميل البيانات"}</AlertDescription></Alert>
    }

    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb,#eef4f4)] px-4 py-24">
        <div className="mx-auto max-w-6xl"><Alert variant="destructive" className="rounded-[1.5rem] text-right"><AlertTitle>تعذر تحميل صفحة الإنجازات</AlertTitle><AlertDescription>{message?.text ?? "حدث خطأ أثناء تحميل البيانات"}</AlertDescription></Alert></div>
      </main>
    )
  }

  const content = (
    <div className={`${embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}`}>
        {message ? <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}><AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle><AlertDescription>{message.text}</AlertDescription></Alert> : null}

        {view === "manager" ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="w-full md:w-[280px]">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full rounded-xl flex-row-reverse text-right [&_svg]:shrink-0"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                <SelectContent>
                  {data.teamUsers.map((user) => <SelectItem key={user.userId} value={user.userId}>{user.userName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-end gap-2 text-right">
              <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => void loadData(shiftWeek(selectedWeekStartDate, 1))} disabled={isCurrentWeek}><ChevronRight className="h-4 w-4" /></Button>
              <span className="text-base font-medium text-foreground">{isCurrentWeek ? "الأسبوع الحالي" : "أسبوع مختار"}</span>
              <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => void loadData(shiftWeek(selectedWeekStartDate, -1))} disabled={!hasPreviousWeekEntries}><ChevronLeft className="h-4 w-4" /></Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 text-right">
            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => void loadData(shiftWeek(selectedWeekStartDate, 1))} disabled={isCurrentWeek}><ChevronRight className="h-4 w-4" /></Button>
            <span className="text-base font-medium text-foreground">{isCurrentWeek ? "الأسبوع الحالي" : "أسبوع مختار"}</span>
            <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => void loadData(shiftWeek(selectedWeekStartDate, -1))} disabled={!hasPreviousWeekEntries}><ChevronLeft className="h-4 w-4" /></Button>
          </div>
        )}

        {view === "personal" ? (
          <>
            {isCurrentWeek ? (
              <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
                <CardHeader>
                  <CardTitle>رفع إنجاز جديد</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 text-right md:col-span-2"><Label>نص الإنجاز</Label><Textarea rows={5} value={form.achievementText} onChange={(event) => setForm((current) => ({ ...current, achievementText: event.target.value }))} /></div>
                  <div className="space-y-3 text-right md:col-span-2">
                    <Label>صورة الإنجاز</Label>
                    <Input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void uploadImage(file) } }} />
                    <div className="flex justify-start"><Button type="button" variant="outline" className="rounded-xl" disabled={isUploading}>{isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{isUploading ? "جارٍ رفع الصورة..." : form.imageUrl ? "تغيير الصورة" : "رفع صورة"}</Button></div>
                  </div>
                </CardContent>
                <div className="flex gap-3 px-6 pb-6"><Button type="button" className="rounded-xl" onClick={() => runAction(handleSaveAchievement)} disabled={isPending || isUploading}><Plus className="h-4 w-4" />{editingEntryId ? "حفظ التعديل" : "حفظ الإنجاز"}</Button>{editingEntryId ? <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setEditingEntryId(null); setForm(initialForm) }} disabled={isPending || isUploading}>إلغاء</Button> : null}</div>
              </Card>
            ) : (
              <Alert className="rounded-[1.5rem] border-border/60 bg-white/95 text-right"><AlertTitle>عرض أسبوع سابق</AlertTitle><AlertDescription>يمكنك تصفح الأسابيع السابقة، لكن رفع الإنجازات متاح للأسبوع الحالي فقط.</AlertDescription></Alert>
            )}

            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>إنجازاتي</CardTitle>
                  {data.myEntries.length > 0 ? <Button type="button" variant="outline" className="rounded-xl" onClick={() => openViewer(data.myEntries)}><Eye className="h-4 w-4" />عرض الإنجازات</Button> : <span />}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.myEntries.length === 0 ? <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">لا توجد إنجازات محفوظة لك في هذا الأسبوع.</div> : data.myEntries.map((entry) => (
                  <div key={entry.id} className="rounded-[1.5rem] border border-border/60 bg-muted/10 p-5">
                    <div className="flex items-start justify-start gap-4"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => handleEditAchievement(entry.id)} disabled={!isCurrentWeek || isPending}><Pencil className="h-4 w-4" />تعديل</Button><Button type="button" variant="outline" size="sm" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => runAction(() => handleDeleteAchievement(entry.id))} disabled={!isCurrentWeek || isPending}><Trash2 className="h-4 w-4" />حذف</Button></div></div>
                    <p className="mt-3 whitespace-pre-wrap text-right text-sm leading-8 text-foreground">{entry.achievementText}</p>
                    {entry.imageUrl ? <img src={entry.imageUrl} alt="Achievement" className="mt-4 max-h-96 rounded-[1.25rem] border border-border/60 bg-white object-contain" /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardContent className="pt-6">
              {!selectedUserId ? <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">لا يوجد موظفون متاحون للعرض حاليًا.</div> : !selectedTeamGroup ? <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">لا توجد إنجازات مرفوعة لهذا الموظف في الأسبوع المحدد.</div> : (
                <Accordion type="multiple" className="space-y-3">
                  <AccordionItem value={selectedTeamGroup.userId} className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-muted/10 px-4">
                    <AccordionTrigger className="text-right hover:no-underline [&_svg]:shrink-0"><div className="flex w-full items-center justify-between gap-4"><Badge variant="secondary">{selectedTeamGroup.entries.length} إنجاز</Badge><div className="text-right"><p className="font-bold text-foreground">{selectedTeamGroup.userName}</p></div></div></AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div className="flex justify-start">
                          <Button type="button" variant="outline" className="rounded-xl" onClick={() => openViewer(selectedTeamGroup.entries)}>
                            <Eye className="h-4 w-4" />
                            عرض الإنجازات
                          </Button>
                        </div>
                        {selectedTeamGroup.entries.map((entry) => (
                          <div key={entry.id} className="rounded-[1.25rem] border border-white/80 bg-white p-4">
                            <div className="flex items-start justify-end gap-4"><div className="text-right"><p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p><Badge variant="outline">{entry.userName}</Badge></div></div>
                            <p className="mt-3 whitespace-pre-wrap text-right text-sm leading-8 text-foreground">{entry.achievementText}</p>
                            {entry.imageUrl ? <img src={entry.imageUrl} alt="Achievement" className="mt-4 max-h-96 rounded-[1.25rem] border border-border/60 bg-muted/10 object-contain" /> : null}
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
          </CardContent>
        </Card>
        )}

        <Dialog open={isViewerOpen} onOpenChange={setIsViewerOpen}>
          <DialogContent className="h-[100svh] w-screen max-w-none translate-x-[-50%] translate-y-[-50%] rounded-none border-0 bg-[radial-gradient(circle_at_top,#27d3c3_0%,#11999b_30%,#0c6f75_62%,#0a4d57_100%)] p-0 text-white shadow-none" showCloseButton={false}>
            {activeViewerEntry ? (
              <div className="relative flex h-full items-center justify-center overflow-hidden p-4 sm:p-6 lg:p-8">
                <div className="absolute left-4 top-4 z-30 flex items-center gap-2">
                  <Button type="button" variant="ghost" size="icon" className="rounded-full bg-white/15 text-white hover:bg-white/25 hover:text-white" onClick={() => setIsViewerOpen(false)}>
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="absolute right-4 top-4 z-30 rounded-full border border-white/20 bg-white/15 px-4 py-2 text-sm text-white/95">
                  {viewerIndex + 1} / {viewerEntries.length}
                </div>

                <div className="relative flex h-[88svh] w-full max-w-[1400px] flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] shadow-[0_30px_100px_rgba(2,41,48,0.28)]">
                  <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-visible px-14 py-6 sm:px-20 sm:py-8 lg:px-24 lg:py-10">
                    <div className="flex h-full w-full items-center justify-center rounded-[1.75rem] border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04))] p-4 sm:p-6 lg:p-8">
                      {activeViewerEntry.imageUrl ? (
                        <img src={activeViewerEntry.imageUrl} alt="Achievement" className="max-h-full w-full rounded-[1.5rem] object-contain shadow-[0_24px_80px_rgba(0,0,0,0.22)]" />
                      ) : (
                        <div className="flex h-full min-h-[420px] w-full items-center justify-center rounded-[1.75rem] border border-white/20 bg-[linear-gradient(180deg,rgba(18,127,129,0.48),rgba(8,86,91,0.58))] text-center shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
                          <div>
                            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-white/15">
                              <Sparkles className="h-12 w-12 text-white/90" />
                            </div>
                            <p className="mt-5 text-lg font-semibold text-white/90">إنجاز بدون صورة</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button type="button" variant="ghost" size="icon" className="absolute left-2 top-1/2 z-20 h-14 w-14 -translate-y-1/2 rounded-full border border-white/20 bg-white/15 text-white hover:bg-white/25 hover:text-white disabled:opacity-30 sm:left-4 lg:left-6" onClick={showNextViewerEntry} disabled={viewerIndex === viewerEntries.length - 1}>
                      <ChevronLeft className="h-6 w-6" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 z-20 h-14 w-14 -translate-y-1/2 rounded-full border border-white/20 bg-white/15 text-white hover:bg-white/25 hover:text-white disabled:opacity-30 sm:right-4 lg:right-6" onClick={showPreviousViewerEntry} disabled={viewerIndex === 0}>
                      <ChevronRight className="h-6 w-6" />
                    </Button>
                  </div>

                  <div className="border-t border-white/15 bg-[linear-gradient(180deg,rgba(6,71,76,0.22),rgba(4,50,54,0.36))] px-6 py-5 backdrop-blur-sm sm:px-8 lg:px-10">
                    <div className="text-right">
                      <h2 className="text-xl font-semibold leading-tight text-white sm:text-2xl">الإنجاز</h2>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-white/92 sm:text-base sm:leading-9">{activeViewerEntry.achievementText}</p>
                    </div>

                    {viewerEntries.length > 1 ? (
                      <div className="mt-5 flex flex-wrap justify-start gap-2">
                        {viewerEntries.map((entry, index) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => setViewerIndex(index)}
                            className={`h-2.5 rounded-full transition-all duration-300 ${index === viewerIndex ? "w-10 bg-white" : "w-2.5 bg-white/35 hover:bg-white/60"}`}
                            aria-label={`عرض الإنجاز ${index + 1}`}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
    </div>
  )

  if (embedded) {
    return content
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb,#eef4f4)] px-4 py-24">
      {content}
    </main>
  )
}
