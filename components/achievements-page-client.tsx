"use client"

import { CalendarRange, ChevronLeft, ChevronRight, ImagePlus, LoaderCircle, Plus, Sparkles } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { AchievementsPageData } from "@/lib/achievements-log"

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
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [isUploading, setIsUploading] = useState(false)

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
        <div className="rounded-[2rem] border border-white/70 bg-white/95 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="text-right">
              <h1 className="text-3xl font-bold text-foreground">{view === "manager" ? "إنجازات الموظفين" : "إنجازاتي"}</h1>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{view === "manager" ? "اختر الموظف ثم تنقّل بين الأسابيع لمراجعة إنجازاته المرفوعة، مع عرض أسبوعي مبسّط مخصص للإدارة." : "رفع إنجازاتك أسبوعيًا كنص وصورة، مع تصفح الأسابيع السابقة ومراجعة إنجازاتك الشخصية."}</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-7 w-7" /></div>
          </div>
        </div>

        {message ? <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}><AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle><AlertDescription>{message.text}</AlertDescription></Alert> : null}

        <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            {view === "manager" ? (
              <div className="grid w-full gap-4 md:grid-cols-[minmax(0,280px)_1fr] md:items-center">
                <div className="space-y-2 text-right">
                  <Label>الموظف</Label>
                  <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                    <SelectTrigger className="w-full rounded-xl"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
                    <SelectContent>
                      {data.teamUsers.map((user) => <SelectItem key={user.userId} value={user.userId}>{user.userName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => void loadData(shiftWeek(selectedWeekStartDate, 1))} disabled={isCurrentWeek}><ChevronRight className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" className="rounded-xl px-4">{isCurrentWeek ? "الأسبوع الحالي" : "أسبوع مختار"}</Button>
                  <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => void loadData(shiftWeek(selectedWeekStartDate, -1))}><ChevronLeft className="h-4 w-4" /></Button>
                </div>
              </div>
            ) : (
              <div className="flex w-full items-center justify-end gap-2">
                <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => void loadData(shiftWeek(selectedWeekStartDate, 1))} disabled={isCurrentWeek}><ChevronRight className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" className="rounded-xl px-4">{isCurrentWeek ? "الأسبوع الحالي" : "أسبوع مختار"}</Button>
                <Button type="button" variant="outline" size="icon" className="rounded-full" onClick={() => void loadData(shiftWeek(selectedWeekStartDate, -1))}><ChevronLeft className="h-4 w-4" /></Button>
              </div>
            )}
          </CardContent>
        </Card>

        {view === "personal" ? (
          <>
            {isCurrentWeek ? (
              <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
                <CardHeader>
                  <CardTitle>رفع إنجاز جديد</CardTitle>
                  <CardDescription>يمكنك إضافة إنجازات الأسبوع الحالي فقط، مع نص وصورة اختيارية لكل إنجاز.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 text-right md:col-span-2"><Label>نص الإنجاز</Label><Textarea rows={5} value={form.achievementText} onChange={(event) => setForm((current) => ({ ...current, achievementText: event.target.value }))} /></div>
                  <div className="space-y-3 text-right md:col-span-2">
                    <Label>صورة الإنجاز</Label>
                    <Input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) { void uploadImage(file) } }} />
                    {form.imageUrl ? <img src={form.imageUrl} alt="Achievement" className="max-h-72 rounded-[1.25rem] border border-border/60 bg-white object-contain" /> : null}
                    <div className="flex justify-start"><Button type="button" variant="outline" className="rounded-xl" disabled={isUploading}>{isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{isUploading ? "جارٍ رفع الصورة..." : "الصورة اختيارية"}</Button></div>
                  </div>
                </CardContent>
                <div className="px-6 pb-6"><Button type="button" className="rounded-xl" onClick={() => runAction(handleCreateAchievement)} disabled={isPending || isUploading}><Plus className="h-4 w-4" />حفظ الإنجاز</Button></div>
              </Card>
            ) : (
              <Alert className="rounded-[1.5rem] border-border/60 bg-white/95 text-right"><AlertTitle>عرض أسبوع سابق</AlertTitle><AlertDescription>يمكنك تصفح الأسابيع السابقة، لكن رفع الإنجازات متاح للأسبوع الحالي فقط.</AlertDescription></Alert>
            )}

            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>إنجازاتي</CardTitle>
                <CardDescription>جميع الإنجازات التي رفعتها في الأسبوع المحدد، مرتبة من الأحدث إلى الأقدم.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.myEntries.length === 0 ? <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">لا توجد إنجازات محفوظة لك في هذا الأسبوع.</div> : data.myEntries.map((entry) => (
                  <div key={entry.id} className="rounded-[1.5rem] border border-border/60 bg-muted/10 p-5">
                    <div className="flex items-start justify-between gap-4"><p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p><Badge variant="secondary">{entry.userName}</Badge></div>
                    <p className="mt-3 whitespace-pre-wrap text-right text-sm leading-8 text-foreground">{entry.achievementText}</p>
                    {entry.imageUrl ? <img src={entry.imageUrl} alt="Achievement" className="mt-4 max-h-96 rounded-[1.25rem] border border-border/60 bg-white object-contain" /> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
            <CardHeader>
              <CardTitle>إنجازات الموظفين</CardTitle>
              <CardDescription>اختر الموظف من الأعلى ثم تنقّل بين الأسابيع لعرض إنجازاته المرفوعة فقط.</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedUserId ? <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">لا يوجد موظفون متاحون للعرض حاليًا.</div> : !selectedTeamGroup ? <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">لا توجد إنجازات مرفوعة لهذا الموظف في الأسبوع المحدد.</div> : (
                <Accordion type="multiple" className="space-y-3">
                  <AccordionItem value={selectedTeamGroup.userId} className="overflow-hidden rounded-[1.5rem] border border-border/60 bg-muted/10 px-4">
                    <AccordionTrigger className="text-right hover:no-underline"><div className="flex w-full items-center justify-between gap-4"><Badge variant="secondary">{selectedTeamGroup.entries.length} إنجاز</Badge><div className="text-right"><p className="font-bold text-foreground">{selectedTeamGroup.userName}</p></div></div></AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        {selectedTeamGroup.entries.map((entry) => (
                          <div key={entry.id} className="rounded-[1.25rem] border border-white/80 bg-white p-4">
                            <div className="flex items-start justify-between gap-4"><p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p><Badge variant="outline">{entry.userName}</Badge></div>
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
