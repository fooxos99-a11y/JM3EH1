"use client"

import { Bell, CheckCircle2, ClipboardList, LoaderCircle, Plus, TimerReset } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

export function TasksPageClient({ embedded = false }: { embedded?: boolean }) {
  const [data, setData] = useState<TasksPageData | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [taskForm, setTaskForm] = useState(initialTaskForm)

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

  const stats = useMemo(() => {
    const assignedTasks = data?.assignedTasks ?? []
    const unreadNotifications = (data?.notifications ?? []).filter((notification) => !notification.isRead).length
    const dueSoon = assignedTasks.filter((task) => task.status !== "completed" && new Date(task.dueAt).getTime() - Date.now() <= (1000 * 60 * 60 * 24) && new Date(task.dueAt).getTime() > Date.now()).length
    return {
      total: assignedTasks.length,
      inProgress: assignedTasks.filter((task) => task.status === "in_progress").length,
      completed: assignedTasks.filter((task) => task.status === "completed").length,
      unreadNotifications,
      dueSoon,
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

  async function handleMarkNotificationRead(notificationId: string) {
    const response = await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_notification_read", notificationId }),
    })

    const payload = await response.json() as TasksPageData & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر تحديث الإشعار")
    }

    setData(payload)
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
        <div className="rounded-[2rem] border border-white/70 bg-white/95 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div className="text-right">
              <h1 className="text-3xl font-bold text-foreground">{data.isManager ? "مهام الموظفين" : "المهام"}</h1>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">متابعة المهام الموكلة لك، تحديث حالتها، واستلام إشعارات عند إضافة مهام جديدة أو قبل موعد التسليم.</p>
            </div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ClipboardList className="h-7 w-7" /></div>
          </div>
        </div>

        {message ? <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}><AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle><AlertDescription>{message.text}</AlertDescription></Alert> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">كل المهام</p><p className="mt-2 text-3xl font-bold text-foreground">{stats.total}</p></CardContent></Card>
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">قيد التنفيذ</p><p className="mt-2 text-3xl font-bold text-foreground">{stats.inProgress}</p></CardContent></Card>
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">منجزة</p><p className="mt-2 text-3xl font-bold text-foreground">{stats.completed}</p></CardContent></Card>
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">موعدها قريب</p><p className="mt-2 text-3xl font-bold text-foreground">{stats.dueSoon}</p></CardContent></Card>
          <Card className="rounded-[1.5rem] border-white/80 bg-white/95"><CardContent className="p-5 text-right"><p className="text-xs text-muted-foreground">إشعارات غير مقروءة</p><p className="mt-2 text-3xl font-bold text-foreground">{stats.unreadNotifications}</p></CardContent></Card>
        </div>

        <Tabs defaultValue="my_tasks" className="gap-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 rounded-[1.5rem] bg-white/90 p-2">
            <TabsTrigger value="my_tasks" className="rounded-xl px-4 py-2">مهامي</TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-xl px-4 py-2">التنبيهات</TabsTrigger>
            {data.isManager ? <TabsTrigger value="assign_task" className="rounded-xl px-4 py-2">إضافة مهمة</TabsTrigger> : null}
            {data.isManager ? <TabsTrigger value="team_tasks" className="rounded-xl px-4 py-2">مهام الموظفين</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="my_tasks" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
              <CardHeader>
                <CardTitle>تنبيهات المهام</CardTitle>
                <CardDescription>إشعار عند إضافة مهمة جديدة، وتذكير قبل موعد التسليم عند اقتراب الموعد.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.notifications.length === 0 ? <div className="rounded-[1.25rem] border border-dashed border-border/70 bg-muted/10 px-4 py-10 text-center text-sm text-muted-foreground">لا توجد إشعارات حاليًا.</div> : data.notifications.map((notification) => (
                  <div key={notification.id} className={`flex items-center justify-between gap-4 rounded-[1.25rem] border px-4 py-4 ${notification.isRead ? "border-border/60 bg-muted/10" : "border-amber-200 bg-amber-50/70"}`}>
                    <div className="flex gap-2"><Button type="button" variant="outline" className="rounded-xl" onClick={() => runAction(() => handleMarkNotificationRead(notification.id))} disabled={notification.isRead || isPending}>{notification.isRead ? "تمت القراءة" : "تعليم كمقروء"}</Button></div>
                    <div className="text-right"><div className="flex items-center justify-end gap-2"><Badge variant={notification.isRead ? "outline" : "secondary"}>{notification.type === "new_task" ? "مهمة جديدة" : "تذكير"}</Badge><p className="font-semibold text-foreground">{notification.title}</p></div><p className="mt-2 text-sm leading-7 text-muted-foreground">{notification.body}</p><p className="mt-2 text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</p></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {data.isManager ? (
            <TabsContent value="assign_task" className="space-y-4">
              <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
                <CardHeader>
                  <CardTitle>إضافة مهمة جديدة</CardTitle>
                  <CardDescription>إسناد مهمة لموظف أو مستخدم، مع وصف واضح وموعد تسليم محدد وإشعار مباشر عند الإضافة.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 text-right"><Label>إسناد إلى</Label><Select value={taskForm.assignedToUserId} onValueChange={(value) => setTaskForm((current) => ({ ...current, assignedToUserId: value }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{data.assignableUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} {user.role === "admin" ? "(إداري)" : "(مستخدم)"}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2 text-right"><Label>موعد التسليم</Label><Input type="datetime-local" value={taskForm.dueAt} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: event.target.value }))} /></div>
                  <div className="space-y-2 text-right md:col-span-2"><Label>العنوان</Label><Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></div>
                  <div className="space-y-2 text-right md:col-span-2"><Label>الوصف</Label><Textarea rows={5} value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} /></div>
                </CardContent>
                <div className="px-6 pb-6"><Button type="button" className="rounded-xl" onClick={() => runAction(handleCreateTask)} disabled={isPending}><Plus className="h-4 w-4" />إضافة المهمة</Button></div>
              </Card>
            </TabsContent>
          ) : null}

          {data.isManager ? (
            <TabsContent value="team_tasks" className="space-y-4">
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
            </TabsContent>
          ) : null}
        </Tabs>
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
