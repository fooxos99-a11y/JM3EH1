"use client"

import { ClipboardList, LoaderCircle, Plus } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePickerField } from "@/components/ui/date-picker-field"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { getTaskStatusLabel, type TaskStatus, type TasksPageData } from "@/lib/tasks"

const initialTaskForm = {
  assignedToUserId: "",
  title: "",
  description: "",
  dueAt: "",
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function statusVariant(status: TaskStatus) {
  if (status === "completed") return "default"
  if (status === "under_review") return "secondary"
  if (status === "in_progress") return "outline"
  return "destructive"
}

function getDueDateValue(value: string) {
  if (!value) {
    return ""
  }

  return value.slice(0, 10)
}

function getDueTimeValue(value: string) {
  if (!value || !value.includes("T")) {
    return ""
  }

  return value.slice(11, 16)
}

function mergeDueAtValue(dateValue: string, timeValue: string) {
  if (!dateValue) {
    return ""
  }

  return `${dateValue}T${timeValue || "00:00"}`
}

export function TasksPageClient({ embedded = false, view = "personal" }: { embedded?: boolean; view?: "personal" | "manager" }) {
  const [data, setData] = useState<TasksPageData | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [taskForm, setTaskForm] = useState(initialTaskForm)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  async function loadData() {
    setLoading(true)
    const response = await fetch("/api/tasks", { cache: "no-store" })
    const payload = await response.json() as TasksPageData & { error?: string }

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "تعذر تحميل المهام" })
      setLoading(false)
      return
    }

    setData(payload)
    setTaskForm((current) => ({
      ...current,
      assignedToUserId: current.assignedToUserId || payload.assignableUsers[0]?.id || "",
    }))
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const personalStats = useMemo(() => {
    const tasks = data?.assignedTasks ?? []
    const now = Date.now()

    return {
      fresh: tasks.filter((task) => task.status === "not_started").length,
      active: tasks.filter((task) => task.status === "in_progress").length,
      finished: tasks.filter((task) => task.status === "completed").length,
      stalled: tasks.filter((task) => task.status !== "completed" && new Date(task.dueAt).getTime() < now).length,
    }
  }, [data])

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

  async function handleCreateTask() {
    const response = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_task",
        assignedToUserId: taskForm.assignedToUserId,
        title: taskForm.title,
        description: taskForm.description,
        dueAt: new Date(taskForm.dueAt).toISOString(),
      }),
    })

    const payload = await response.json() as TasksPageData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر إنشاء المهمة")
    }

    setData(payload)
    setTaskForm((current) => ({ ...initialTaskForm, assignedToUserId: current.assignedToUserId }))
    setMessage({ type: "success", text: "تمت إضافة المهمة وإرسال إشعار بها للمستخدم" })
    setIsCreateDialogOpen(false)
  }

  async function handleUpdateStatus(taskId: string, status: TaskStatus) {
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", taskId, status }),
    })

    const payload = await response.json() as TasksPageData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر تحديث حالة المهمة")
    }

    setData(payload)
    setMessage({ type: "success", text: "تم تحديث حالة المهمة" })
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
      return <Alert variant="destructive" className="rounded-[1.5rem] text-right"><AlertTitle>تعذر تحميل المهام</AlertTitle><AlertDescription>{message?.text ?? "حدث خطأ أثناء تحميل صفحة المهام"}</AlertDescription></Alert>
    }

    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb,#eef4f4)] px-4 py-24">
        <div className="mx-auto max-w-6xl"><Alert variant="destructive" className="rounded-[1.5rem] text-right"><AlertTitle>تعذر تحميل المهام</AlertTitle><AlertDescription>{message?.text ?? "حدث خطأ أثناء تحميل صفحة المهام"}</AlertDescription></Alert></div>
      </main>
    )
  }

  const content = (
    <div className={`${embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}`}>
        {message ? <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}><AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle><AlertDescription>{message.text}</AlertDescription></Alert> : null}

          {view === "personal" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="rounded-[1.25rem] border-white/80 bg-white/95"><CardContent className="p-4 text-right"><p className="text-xs text-muted-foreground">جديدة</p><p className="mt-2 text-2xl font-bold text-foreground">{personalStats.fresh}</p></CardContent></Card>
                <Card className="rounded-[1.25rem] border-white/80 bg-white/95"><CardContent className="p-4 text-right"><p className="text-xs text-muted-foreground">جارية</p><p className="mt-2 text-2xl font-bold text-foreground">{personalStats.active}</p></CardContent></Card>
                <Card className="rounded-[1.25rem] border-white/80 bg-white/95"><CardContent className="p-4 text-right"><p className="text-xs text-muted-foreground">منتهية</p><p className="mt-2 text-2xl font-bold text-foreground">{personalStats.finished}</p></CardContent></Card>
                <Card className="rounded-[1.25rem] border-white/80 bg-white/95"><CardContent className="p-4 text-right"><p className="text-xs text-muted-foreground">متعثرة</p><p className="mt-2 text-2xl font-bold text-foreground">{personalStats.stalled}</p></CardContent></Card>
              </div>

              <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
                <CardHeader>
                  <CardTitle>جميع المهام الموكلة إليك</CardTitle>
                  <CardDescription>تحديث حالة المهمة متاح لك مباشرة، مع إظهار العنوان والوصف وموعد التسليم والجهة المسندة.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">العنوان</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">تاريخ التسليم</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">من المدير</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.assignedTasks.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد مهام موكلة إليك حاليًا.</TableCell></TableRow>
                      ) : data.assignedTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="text-right font-semibold text-foreground">{task.title}</TableCell>
                          <TableCell className="max-w-[360px] whitespace-normal text-right leading-7">{task.description}</TableCell>
                          <TableCell className="text-right">{formatDateTime(task.dueAt)}</TableCell>
                          <TableCell className="text-right">
                            <Select value={task.status} onValueChange={(value) => runAction(() => handleUpdateStatus(task.id, value as TaskStatus))}>
                              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_started">لم تبدأ</SelectItem>
                                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                                <SelectItem value="under_review">تحت المراجعة</SelectItem>
                                <SelectItem value="completed">منجزة</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right"><Badge variant={statusVariant(task.status)}>{getTaskStatusLabel(task.status)}</Badge><p className="mt-2 text-xs text-muted-foreground">{task.assignedByName}</p></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : null}

          {view === "manager" && data.isManager ? (
            <>
              <div className="flex justify-end">
                <Button type="button" className="rounded-xl" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  إضافة مهمة
                </Button>
              </div>

              <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
                <CardHeader>
                  <CardTitle>مهام الموظفين</CardTitle>
                  <CardDescription>عرض شامل لجميع المهام الموكلة، مع متابعة الحالة الحالية والموظف المستلم وموعد التسليم.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">العنوان</TableHead>
                        <TableHead className="text-right">المستخدم</TableHead>
                        <TableHead className="text-right">موعد التسليم</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">آخر تحديث</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.managedTasks.length === 0 ? <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">لا توجد مهام محفوظة بعد.</TableCell></TableRow> : data.managedTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="max-w-[320px] whitespace-normal text-right"><p className="font-semibold text-foreground">{task.title}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{task.description}</p></TableCell>
                          <TableCell className="text-right">{task.assignedToName}</TableCell>
                          <TableCell className="text-right">{formatDateTime(task.dueAt)}</TableCell>
                          <TableCell className="text-right"><Badge variant={statusVariant(task.status)}>{getTaskStatusLabel(task.status)}</Badge></TableCell>
                          <TableCell className="text-right">{formatDateTime(task.updatedAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-2xl" showCloseButton={false}>
                  <div className="bg-[linear-gradient(135deg,rgba(1,154,151,0.08),rgba(255,255,255,0.98))] p-6">
                    <DialogHeader className="items-start text-left">
                      <DialogTitle className="text-2xl">إضافة مهمة جديدة</DialogTitle>
                    </DialogHeader>
                  </div>

                  <div className="grid gap-4 p-6 pt-2 md:grid-cols-2">
                    <div className="space-y-2 text-right"><Label>إسناد إلى</Label><Select value={taskForm.assignedToUserId} onValueChange={(value) => setTaskForm((current) => ({ ...current, assignedToUserId: value }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{data.assignableUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} {user.role === "admin" ? "(إداري)" : "(مستخدم)"}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2 text-right">
                      <Label>موعد التسليم</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DatePickerField value={getDueDateValue(taskForm.dueAt)} onChange={(value) => setTaskForm((current) => ({ ...current, dueAt: mergeDueAtValue(value, getDueTimeValue(current.dueAt)) }))} placeholder="اختر التاريخ" />
                        <Input type="time" value={getDueTimeValue(taskForm.dueAt)} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: mergeDueAtValue(getDueDateValue(current.dueAt), event.target.value) }))} />
                      </div>
                    </div>
                    <div className="space-y-2 text-right md:col-span-2"><Label>العنوان</Label><Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></div>
                    <div className="space-y-2 text-right md:col-span-2"><Label>الوصف</Label><Textarea rows={5} value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} /></div>
                  </div>
                  <div className="px-6 pb-6"><Button type="button" className="rounded-xl" onClick={() => runAction(handleCreateTask)} disabled={isPending}><Plus className="h-4 w-4" />إضافة المهمة</Button></div>
                </DialogContent>
              </Dialog>
            </>
          ) : null}
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
