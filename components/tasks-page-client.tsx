"use client"

import { Eye, LoaderCircle, Paperclip, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"

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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import { countVisiblePendingTasks, getTaskEffectiveDueAt, getTaskStatusLabel, isVisibleCurrentTask, type TaskKind, type TaskRecord, type TaskStatus, type TasksPageData } from "@/lib/tasks"

type TaskMutationPayload = Omit<TaskRecord, "assignedToName" | "assignedByName" | "canUpdateStatus">

type PersonalTaskFilter = "all" | "in_progress" | "under_review" | "finished" | "stalled"
type PersonalTransactionView = "incoming" | "outgoing"

const DEFAULT_DUE_TIME = "23:59"

const initialTaskForm = {
  taskId: "",
  assignedToUserId: "",
  title: "",
  description: "",
  dueAt: getDefaultDueAtInput(),
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function isVisibleTaskForList(task: TaskRecord, operationalPlanWeekEndDay?: TasksPageData["operationalPlanWeekEndDay"]) {
  return isVisibleCurrentTask(task, operationalPlanWeekEndDay)
}

function statusVariant(status: TaskStatus) {
  if (status === "completed") return "default"
  if (status === "stalled") return "destructive"
  if (status === "under_review") return "secondary"
  if (status === "in_progress") return "outline"
  return "secondary"
}

function getStatusBadgeClass(task: Pick<TasksPageData["assignedTasks"][number], "status" | "dueAt" | "operationalPlanOccurrenceId" | "operationalPlanTaskCount" | "operationalPlanReleaseAt">) {
  if (task.status === "under_review") {
    return "border-transparent bg-orange-100 text-orange-700 hover:bg-orange-100"
  }

  if (getTaskCategory(task) === "stalled") {
    return ""
  }

  return ""
}

function isTaskStalled(task: Pick<TasksPageData["assignedTasks"][number], "status" | "dueAt" | "operationalPlanOccurrenceId" | "operationalPlanTaskCount" | "operationalPlanReleaseAt">, operationalPlanWeekEndDay?: TasksPageData["operationalPlanWeekEndDay"]) {
  return task.status === "stalled" || (task.status !== "completed" && task.status !== "under_review" && new Date(getTaskEffectiveDueAt(task, operationalPlanWeekEndDay)).getTime() < Date.now())
}

function getTaskCategory(task: Pick<TasksPageData["assignedTasks"][number], "status" | "dueAt" | "operationalPlanOccurrenceId" | "operationalPlanTaskCount" | "operationalPlanReleaseAt">, operationalPlanWeekEndDay?: TasksPageData["operationalPlanWeekEndDay"]): Exclude<PersonalTaskFilter, "all"> {
  if (task.status === "completed") {
    return "finished"
  }

  if (isTaskStalled(task, operationalPlanWeekEndDay)) {
    return "stalled"
  }

  if (task.status === "under_review") {
    return "under_review"
  }

  return "in_progress"
}

function getTaskDisplayLabel(task: Pick<TasksPageData["assignedTasks"][number], "status" | "dueAt" | "operationalPlanOccurrenceId" | "operationalPlanTaskCount" | "operationalPlanReleaseAt">, operationalPlanWeekEndDay?: TasksPageData["operationalPlanWeekEndDay"]) {
  const category = getTaskCategory(task, operationalPlanWeekEndDay)

  switch (category) {
    case "in_progress":
      return "قيد التنفيذ"
    case "under_review":
      return "قيد المراجعة"
    case "finished":
      return "منتهية"
    case "stalled":
      return "متعثرة"
    default:
      return "قيد التنفيذ"
  }
}

function getTaskDisplayVariant(task: Pick<TasksPageData["assignedTasks"][number], "status" | "dueAt" | "operationalPlanOccurrenceId" | "operationalPlanTaskCount" | "operationalPlanReleaseAt">, operationalPlanWeekEndDay?: TasksPageData["operationalPlanWeekEndDay"]) {
  if (getTaskCategory(task, operationalPlanWeekEndDay) === "stalled") {
    return "destructive"
  }

  return statusVariant(task.status)
}

function getDueDateValue(value: string) {
  if (!value) {
    return ""
  }

  return value.slice(0, 10)
}

function getDueTimeValue(value: string) {
  if (!value || !value.includes("T")) {
    return DEFAULT_DUE_TIME
  }

  return value.slice(11, 16)
}

function mergeDueAtValue(dateValue: string, timeValue: string) {
  if (!dateValue) {
    return ""
  }

  return `${dateValue}T${timeValue || DEFAULT_DUE_TIME}`
}

function getDefaultDueAtInput() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  const hours = String(now.getHours()).padStart(2, "0")
  const minutes = String(now.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function isImageAttachment(url: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(url)
}

function extractGoogleDriveFileId(url: string) {
  const patterns = [
    /\/file\/d\/([^/]+)/i,
    /[?&]id=([^&#]+)/i,
    /\/thumbnail\?id=([^&#]+)/i,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

function getAttachmentPreviewUrl(url: string) {
  const driveFileId = extractGoogleDriveFileId(url)

  if (!driveFileId) {
    return url
  }

  return `https://drive.google.com/file/d/${driveFileId}/preview`
}

export function TasksPageClient({ embedded = false, view = "personal", kind = "task" }: { embedded?: boolean; view?: "personal" | "manager"; kind?: TaskKind }) {
  const tasksApiUrl = `/api/tasks?kind=${kind}`
  const [data, setData] = useState<TasksPageData | null>(null)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [isEditingTask, setIsEditingTask] = useState(false)
  const [pendingDeleteTaskIds, setPendingDeleteTaskIds] = useState<string[]>([])
  const [taskForm, setTaskForm] = useState(initialTaskForm)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedManagedUserId, setSelectedManagedUserId] = useState("all")
  const [selectedPersonalFilter, setSelectedPersonalFilter] = useState<PersonalTaskFilter>("in_progress")
  const [selectedTransactionView, setSelectedTransactionView] = useState<PersonalTransactionView>("incoming")
  const [attachmentTaskId, setAttachmentTaskId] = useState<string | null>(null)
  const [createAttachmentFile, setCreateAttachmentFile] = useState<File | null>(null)
  const [previewAttachment, setPreviewAttachment] = useState<{ title: string; url: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const createAttachmentInputRef = useRef<HTMLInputElement>(null)
  const isPersonalTaskPage = view === "personal" && kind === "task"
  const operationalPlanWeekEndDay = data?.operationalPlanWeekEndDay
  const assignableUsers = data?.assignableUsers ?? []

  function enrichTask(task: TaskMutationPayload, current: TasksPageData, existing?: TaskRecord): TaskRecord {
    return {
      ...task,
      assignedToName: current.assignableUsers.find((user) => user.id === task.assignedToUserId)?.name ?? existing?.assignedToName ?? "-",
      assignedByName: current.assignableUsers.find((user) => user.id === task.assignedByUserId)?.name ?? existing?.assignedByName ?? "-",
      canUpdateStatus: current.isManager || task.assignedToUserId === current.currentUserId,
    }
  }

  function recalculateTaskMeta(current: TasksPageData, nextAssignedTasks: TaskRecord[], nextNotifications = current.notifications) {
    const assignedTaskIds = new Set(nextAssignedTasks.map((task) => task.id))

    return {
      pendingTasksCount: countVisiblePendingTasks(nextAssignedTasks, current.operationalPlanWeekEndDay),
      unreadNotificationsCount: nextNotifications.filter((notification) => !notification.isRead && notification.type === "new_task" && !!notification.taskId && assignedTaskIds.has(notification.taskId)).length,
    }
  }

  function applyTaskMutation(task: TaskMutationPayload) {
    setData((current) => {
      if (!current) {
        return current
      }

      const existing = [...current.assignedTasks, ...current.managedTasks, ...current.outgoingTasks].find((entry) => entry.id === task.id)
      const nextTask = enrichTask(task, current, existing)

      const nextAssignedTasks = nextTask.assignedToUserId === current.currentUserId
        ? (current.assignedTasks.some((entry) => entry.id === nextTask.id)
          ? current.assignedTasks.map((entry) => (entry.id === nextTask.id ? nextTask : entry))
          : [nextTask, ...current.assignedTasks])
        : current.assignedTasks.filter((entry) => entry.id !== nextTask.id)

      const nextManagedTasks = current.isManager && nextTask.kind === "task"
        ? (current.managedTasks.some((entry) => entry.id === nextTask.id)
          ? current.managedTasks.map((entry) => (entry.id === nextTask.id ? nextTask : entry))
          : [nextTask, ...current.managedTasks])
        : current.managedTasks.filter((entry) => entry.id !== nextTask.id)

      const shouldAppearInOutgoing = nextTask.kind === "internal_transaction" && nextTask.assignedByUserId === current.currentUserId
      const nextOutgoingTasks = shouldAppearInOutgoing
        ? (current.outgoingTasks.some((entry) => entry.id === nextTask.id)
          ? current.outgoingTasks.map((entry) => (entry.id === nextTask.id ? nextTask : entry))
          : [nextTask, ...current.outgoingTasks])
        : current.outgoingTasks.filter((entry) => entry.id !== nextTask.id)

      return {
        ...current,
        assignedTasks: nextAssignedTasks,
        managedTasks: nextManagedTasks,
        outgoingTasks: nextOutgoingTasks,
        ...recalculateTaskMeta(current, nextAssignedTasks),
      }
    })
  }

  function removeTaskLocally(taskId: string) {
    setData((current) => {
      if (!current) {
        return current
      }

      const nextAssignedTasks = current.assignedTasks.filter((task) => task.id !== taskId)
      const nextNotifications = current.notifications.filter((notification) => notification.taskId !== taskId)

      return {
        ...current,
        assignedTasks: nextAssignedTasks,
        managedTasks: current.managedTasks.filter((task) => task.id !== taskId),
        outgoingTasks: current.outgoingTasks.filter((task) => task.id !== taskId),
        notifications: nextNotifications,
        ...recalculateTaskMeta(current, nextAssignedTasks, nextNotifications),
      }
    })
  }

  function applyPayload(payload: TasksPageData) {
    setData(payload)
    setTaskForm((current) => ({
      ...current,
      assignedToUserId: current.assignedToUserId || payload.assignableUsers[0]?.id || "",
    }))
  }

  async function loadData() {
    setLoading(true)
    const response = await fetch(tasksApiUrl, { cache: "no-store" })
    const payload = await response.json() as TasksPageData & { error?: string }

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "تعذر تحميل المهام" })
      setLoading(false)
      return
    }

    applyPayload(payload)
    setLoading(false)
  }

  async function markKindNotificationsRead(targetKind: TaskKind) {
    setLoading(true)
    const response = await fetch(`/api/tasks?kind=${targetKind}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_kind_notifications_read", kind: targetKind }),
    })
    const payload = await response.json() as TasksPageData & { error?: string }

    if (!response.ok) {
      setMessage({ type: "error", text: payload.error ?? "تعذر تحديث الإشعارات" })
      setLoading(false)
      return
    }

    applyPayload(payload)
    setLoading(false)
    window.dispatchEvent(new Event("dashboard-badges-changed"))
  }

  useEffect(() => {
    if (kind === "internal_transaction") {
      void markKindNotificationsRead(kind)
      return
    }

    void loadData()
  }, [kind])

  useEffect(() => {
    const pusherKey = process.env.NEXT_PUBLIC_PUSHER_KEY
    const pusherCluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER

    if (!pusherKey || !pusherCluster) {
      return
    }

    let cancelled = false
    let pusherClient: { subscribe: (channelName: string) => { bind: (eventName: string, callback: (payload: { kind?: TaskKind }) => void) => void; unbind_all: () => void }; disconnect: () => void } | null = null
    let channel: { bind: (eventName: string, callback: (payload: { kind?: TaskKind }) => void) => void; unbind_all: () => void } | null = null

    void import("pusher-js").then(({ default: Pusher }) => {
      if (cancelled) {
        return
      }

      pusherClient = new Pusher(pusherKey, {
        cluster: pusherCluster,
      })

      channel = pusherClient.subscribe("tasks")
      channel.bind("tasks-updated", (payload: { kind?: TaskKind }) => {
        if (!payload.kind || payload.kind === kind) {
          void loadData()
          window.dispatchEvent(new Event("dashboard-badges-changed"))
        }
      })
    })

    return () => {
      cancelled = true
      channel?.unbind_all()
      pusherClient?.disconnect()
    }
  }, [kind])

  const currentMonthAssignedTasks = useMemo(() => {
    const tasks = data?.assignedTasks ?? []

    if (kind !== "task") {
      return tasks
    }

    return tasks.filter((task) => isVisibleTaskForList(task, operationalPlanWeekEndDay))
  }, [data?.assignedTasks, kind, operationalPlanWeekEndDay])

  const currentMonthManagedTasks = useMemo(() => {
    const tasks = data?.managedTasks ?? []

    if (kind !== "task") {
      return tasks
    }

    return tasks.filter((task) => isVisibleTaskForList(task, operationalPlanWeekEndDay))
  }, [data?.managedTasks, kind, operationalPlanWeekEndDay])

  const personalStats = useMemo(() => {
    const tasks = currentMonthAssignedTasks

    return {
      inProgress: tasks.filter((task) => getTaskCategory(task, operationalPlanWeekEndDay) === "in_progress").length,
      underReview: tasks.filter((task) => getTaskCategory(task, operationalPlanWeekEndDay) === "under_review").length,
      finished: tasks.filter((task) => getTaskCategory(task, operationalPlanWeekEndDay) === "finished").length,
      stalled: tasks.filter((task) => getTaskCategory(task, operationalPlanWeekEndDay) === "stalled").length,
    }
  }, [currentMonthAssignedTasks, operationalPlanWeekEndDay])

  const filteredAssignedTasks = useMemo(() => {
    const tasks = currentMonthAssignedTasks

    if (selectedPersonalFilter === "all") {
      return tasks
    }

    return tasks.filter((task) => getTaskCategory(task, operationalPlanWeekEndDay) === selectedPersonalFilter)
  }, [currentMonthAssignedTasks, selectedPersonalFilter, operationalPlanWeekEndDay])

  const transactionViewOptions = useMemo(
    () => [
      { key: "incoming" as const, label: "المعاملات الموكلة إلي", count: data?.assignedTasks.length ?? 0 },
      { key: "outgoing" as const, label: "معاملاتي", count: data?.outgoingTasks.length ?? 0 },
    ],
    [data?.assignedTasks.length, data?.outgoingTasks.length],
  )

  const visibleTransactions = useMemo(
    () => selectedTransactionView === "incoming" ? (data?.assignedTasks ?? []) : (data?.outgoingTasks ?? []),
    [data?.assignedTasks, data?.outgoingTasks, selectedTransactionView],
  )

  const personalRows = useMemo(
    () => kind === "internal_transaction" ? visibleTransactions : filteredAssignedTasks,
    [filteredAssignedTasks, kind, visibleTransactions],
  )

  const taskById = useMemo(() => {
    const tasks = [...(data?.assignedTasks ?? []), ...(data?.managedTasks ?? []), ...(data?.outgoingTasks ?? [])]
    return new Map(tasks.map((task) => [task.id, task] as const))
  }, [data?.assignedTasks, data?.managedTasks, data?.outgoingTasks])

  const personalTaskViewOptions = useMemo(
    () => [
      { key: "in_progress" as const, label: "قيد التنفيذ", count: personalStats.inProgress },
      { key: "under_review" as const, label: "قيد المراجعة", count: personalStats.underReview },
      { key: "finished" as const, label: "المهام المنتهية", count: personalStats.finished },
      { key: "stalled" as const, label: "المهام المتعثرة", count: personalStats.stalled },
    ],
    [personalStats.finished, personalStats.inProgress, personalStats.stalled, personalStats.underReview],
  )

  const itemLabel = kind === "internal_transaction" ? "معاملة" : "مهمة"
  const itemLabelPlural = kind === "internal_transaction" ? "معاملات" : "مهام"
  const isInternalTransaction = kind === "internal_transaction"

  const personalSectionTitle = useMemo(() => {
    if (isInternalTransaction) {
      return selectedTransactionView === "incoming" ? "المعاملات الموكلة إلي" : "معاملاتي"
    }

    const noun = isInternalTransaction ? "المعاملات" : "المهام"

    switch (selectedPersonalFilter) {
      case "in_progress":
        return `${noun} قيد التنفيذ`
      case "under_review":
        return `${noun} قيد المراجعة`
      case "finished":
        return `${noun} المنتهية`
      case "stalled":
        return `${noun} المتعثرة`
      default:
        return isInternalTransaction ? "جميع المعاملات الداخلية الواردة لك" : "جميع المهام الموكلة إليك"
    }
  }, [isInternalTransaction, selectedPersonalFilter, selectedTransactionView])

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

  function resetCreateTaskState() {
    setTaskForm({
      ...initialTaskForm,
      assignedToUserId: isPersonalTaskPage ? (data?.currentUserId ?? "") : (data?.assignableUsers[0]?.id ?? ""),
      dueAt: getDefaultDueAtInput(),
    })
    setCreateAttachmentFile(null)

    if (createAttachmentInputRef.current) {
      createAttachmentInputRef.current.value = ""
    }
  }

  function openCreateTaskDialog() {
    resetCreateTaskState()
    setIsCreateDialogOpen(true)
  }

  async function handleCreateTask() {
    if (!data) {
      return
    }

    const assignedToUserId = isPersonalTaskPage ? (data?.currentUserId ?? "") : taskForm.assignedToUserId
    const pendingAttachmentFile = createAttachmentFile
    const pendingTaskTitle = taskForm.title

    const response = await fetch(tasksApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_task",
        assignedToUserId,
        title: taskForm.title,
        description: taskForm.description,
        dueAt: new Date(taskForm.dueAt).toISOString(),
        attachmentUrl: null,
      }),
    })

    const payload = await response.json() as { task?: Omit<TaskRecord, "assignedToName" | "assignedByName" | "canUpdateStatus">; error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر إنشاء المهمة")
    }

    if (payload.task) {
      const currentUserName = data.assignableUsers.find((user) => user.id === data.currentUserId)?.name ?? "-"
      const assignedUserName = data.assignableUsers.find((user) => user.id === assignedToUserId)?.name ?? currentUserName
      const optimisticTask: TaskRecord = {
        ...payload.task,
        assignedToName: assignedUserName,
        assignedByName: currentUserName,
        canUpdateStatus: true,
      }

      setData((current) => {
        if (!current) {
          return current
        }

        return {
          ...current,
          assignedTasks: assignedToUserId === current.currentUserId ? [optimisticTask, ...current.assignedTasks] : current.assignedTasks,
          managedTasks: current.isManager ? [optimisticTask, ...current.managedTasks] : current.managedTasks,
          pendingTasksCount:
            assignedToUserId === current.currentUserId && isVisibleCurrentTask(optimisticTask, current.operationalPlanWeekEndDay) && optimisticTask.status !== "completed"
              ? current.pendingTasksCount + 1
              : current.pendingTasksCount,
        }
      })
    }

    resetCreateTaskState()
    setMessage({ type: "success", text: pendingAttachmentFile ? "تم إنشاء المهمة ويجري رفع المرفق" : "تم إنشاء المهمة" })
    setIsCreateDialogOpen(false)

    if (payload.task?.id && pendingAttachmentFile) {
      void (async () => {
        try {
          const attachmentUrl = await uploadAttachmentFile(pendingAttachmentFile, pendingTaskTitle)
          const attachmentResponse = await fetch(tasksApiUrl, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "update_attachment",
              taskId: payload.task?.id,
              attachmentUrl,
            }),
          })

          const attachmentPayload = await attachmentResponse.json() as { task?: TaskMutationPayload; error?: string }
          if (!attachmentResponse.ok) {
            throw new Error(attachmentPayload.error ?? "تعذر حفظ المرفق")
          }

          if (attachmentPayload.task) {
            applyTaskMutation(attachmentPayload.task)
          }
          setMessage({ type: "success", text: "تم رفع مرفق المهمة" })
        } catch (error) {
          setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ أثناء رفع المرفق" })
        }
      })()
    }
  }

  async function handleCreateTaskClick() {
    if (isCreatingTask) {
      return
    }

    setMessage(null)
    setIsCreatingTask(true)

    try {
      await handleCreateTask()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
    } finally {
      setIsCreatingTask(false)
    }
  }

  async function handleEditTaskClick() {
    if (isEditingTask) {
      return
    }

    setMessage(null)
    setIsEditingTask(true)

    try {
      await handleEditTask()
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
    } finally {
      setIsEditingTask(false)
    }
  }

  async function handleDeleteTaskClick(taskId: string) {
    if (pendingDeleteTaskIds.includes(taskId)) {
      return
    }

    setMessage(null)
    setPendingDeleteTaskIds((current) => [...current, taskId])

    try {
      await handleDeleteTask(taskId)
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
    } finally {
      setPendingDeleteTaskIds((current) => current.filter((id) => id !== taskId))
    }
  }

  async function handleEditTask() {
    const response = await fetch(tasksApiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_task",
        taskId: taskForm.taskId,
        assignedToUserId: taskForm.assignedToUserId,
        title: taskForm.title,
        description: taskForm.description,
        dueAt: new Date(taskForm.dueAt).toISOString(),
      }),
    })

    const payload = await response.json() as { task?: TaskMutationPayload; error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر تعديل المهمة")
    }

    if (payload.task) {
      applyTaskMutation(payload.task)
    }
    setTaskForm((current) => ({ ...initialTaskForm, assignedToUserId: current.assignedToUserId }))
    setMessage({ type: "success", text: "تم تعديل المهمة" })
    setIsEditDialogOpen(false)
  }

  async function handleDeleteTask(taskId: string) {
    const response = await fetch(tasksApiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete_task", taskId }),
    })

    const payload = await response.json() as { taskId?: string; error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حذف المهمة")
    }

    if (payload.taskId) {
      removeTaskLocally(payload.taskId)
    }
  }

  async function uploadAttachmentFile(file: File, taskTitle: string, parentFolderId?: string | null) {
    const targetFolderId = parentFolderId || (await fetch("/api/drive/folders", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { defaultFolderId?: string | null; error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر تحميل مكان ملفاتي")
      }

      return payload.defaultFolderId ?? null
    }))

    if (targetFolderId) {
      const extensionMatch = file.name.match(/(\.[^.]+)$/)
      const nextFileName = `${taskTitle}${extensionMatch?.[1] ?? ""}`
      const formData = new FormData()
      formData.append("file", file)
      formData.append("parentId", targetFolderId)
      formData.append("fileName", nextFileName)

      const response = await fetch("/api/drive/upload", {
        method: "POST",
        body: formData,
      })

      const payload = await response.json() as { item?: { id: string; webViewLink: string | null }; error?: string }
      if (!response.ok || !payload.item) {
        throw new Error(payload.error ?? "تعذر رفع الملف إلى Google Drive")
      }

      return payload.item.webViewLink ?? `https://drive.google.com/file/d/${payload.item.id}/view`
    }

    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    const payload = await response.json() as { url?: string; error?: string }
    if (!response.ok || !payload.url) {
      throw new Error(payload.error ?? "تعذر رفع الملف")
    }

    return payload.url
  }

  async function handleDirectAttachmentChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const taskId = attachmentTaskId

    if (!file || !taskId) {
      return
    }

    setMessage(null)

    try {
      const task = taskById.get(taskId)
      const attachmentUrl = await uploadAttachmentFile(file, task?.title ?? "مهمة", task?.driveFolderId)

      const response = await fetch(tasksApiUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_attachment",
          taskId,
          attachmentUrl,
        }),
      })

      const payload = await response.json() as { task?: TaskMutationPayload; error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر حفظ المرفق")
      }

      if (payload.task) {
        applyTaskMutation(payload.task)
      }
      setMessage({ type: "success", text: "تم حفظ مرفق المهمة" })
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "حدث خطأ غير متوقع" })
    } finally {
      setAttachmentTaskId(null)
      event.target.value = ""
    }
  }

  async function handleSaveAttachment() {
    const response = await fetch(tasksApiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_attachment",
        taskId: "",
        attachmentUrl: null,
      }),
    })

    const payload = await response.json() as { task?: TaskMutationPayload; error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حفظ المرفق")
    }

    if (payload.task) {
      applyTaskMutation(payload.task)
    }
    setMessage({ type: "success", text: "تم حفظ مرفق المهمة" })
  }

  async function handleUpdateStatus(taskId: string, status: TaskStatus) {
    const response = await fetch(tasksApiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_status", taskId, status }),
    })

    const payload = await response.json() as { task?: TaskMutationPayload; error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر تحديث حالة المهمة")
    }

    if (payload.task) {
      applyTaskMutation(payload.task)
    }
  }

  function openEditDialog(task: TasksPageData["managedTasks"][number]) {
    setTaskForm({
      taskId: task.id,
      assignedToUserId: task.assignedToUserId,
      title: task.title,
      description: task.description,
      dueAt: task.dueAt.slice(0, 16),
    })
    setIsEditDialogOpen(true)
  }

  function openAttachmentPicker(task: TasksPageData["assignedTasks"][number]) {
    setAttachmentTaskId(task.id)
    fileInputRef.current?.click()
  }

  function openAttachmentPreview(title: string, url: string) {
    if (!url) {
      return
    }

    setPreviewAttachment({ title, url: getAttachmentPreviewUrl(url) })
  }

  useEffect(() => {
    if (kind !== "task") {
      return
    }

    function handleOpenCreateTask() {
      openCreateTaskDialog()
    }

    window.addEventListener("tasks-open-create-task", handleOpenCreateTask)

    return () => {
      window.removeEventListener("tasks-open-create-task", handleOpenCreateTask)
    }
  }, [kind])

  const filteredManagedTasks = useMemo(() => {
    const tasks = currentMonthManagedTasks

    if (selectedManagedUserId === "all") {
      return tasks
    }

    return tasks.filter((task) => task.assignedToUserId === selectedManagedUserId)
  }, [currentMonthManagedTasks, selectedManagedUserId])

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
        <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar" className="hidden" onChange={handleDirectAttachmentChange} />
        {message ? <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}><AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle>{message.type === "error" ? <AlertDescription>{message.text}</AlertDescription> : null}</Alert> : null}

          {view === "personal" ? (
            <>
              <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
                <CardHeader className="items-end text-right">
                  <div className="flex w-full flex-col items-end gap-3 text-right">
                    <div className="w-full text-right">
                      <CardTitle className="text-right">{personalSectionTitle}</CardTitle>
                    </div>
                    {kind === "internal_transaction" ? (
                      <div className="flex w-full flex-wrap justify-start gap-2" dir="rtl">
                        {transactionViewOptions.map((option) => (
                          <Button
                            key={option.key}
                            type="button"
                            variant={selectedTransactionView === option.key ? "default" : "outline"}
                            className="h-9 rounded-xl px-3 text-xs"
                            onClick={() => setSelectedTransactionView(option.key)}
                          >
                            {option.label}
                            <span className="mr-2 inline-flex min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-bold leading-none">
                              {option.count}
                            </span>
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex w-full flex-wrap justify-start gap-2" dir="rtl">
                        {personalTaskViewOptions.map((option) => (
                          <Button
                            key={option.key}
                            type="button"
                            variant={selectedPersonalFilter === option.key ? "default" : "outline"}
                            className="h-9 rounded-xl px-3 text-xs"
                            onClick={() => setSelectedPersonalFilter(option.key)}
                          >
                            {option.label}
                            <span className="mr-2 inline-flex min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 py-0.5 text-[11px] font-bold leading-none">
                              {option.count}
                            </span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">العنوان</TableHead>
                        <TableHead className="text-right">الوصف</TableHead>
                        <TableHead className="text-right">تاريخ التسليم</TableHead>
                        {kind === "internal_transaction" ? <TableHead className="text-right">{selectedTransactionView === "incoming" ? "من" : "إلى"}</TableHead> : null}
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">المرفق</TableHead>
                        {isPersonalTaskPage && selectedPersonalFilter === "finished" ? <TableHead className="w-[88px] text-center">الحذف</TableHead> : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {personalRows.length === 0 ? (
                        <TableRow><TableCell colSpan={kind === "internal_transaction" ? 6 : (isPersonalTaskPage && selectedPersonalFilter === "finished" ? 6 : 5)} className="py-8 text-center text-muted-foreground">{kind === "internal_transaction" ? (selectedTransactionView === "incoming" ? "لا توجد معاملات موكلة إليك حاليًا." : "لا توجد معاملات قمت بإرسالها حتى الآن.") : "لا توجد مهام لهذا الشهر ضمن هذه الفئة حاليًا."}</TableCell></TableRow>
                      ) : personalRows.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="text-right font-semibold text-foreground">{task.title}</TableCell>
                          <TableCell className="max-w-[360px] whitespace-normal text-right leading-7">{task.description}</TableCell>
                          <TableCell className="text-right">{formatDateTime(getTaskEffectiveDueAt(task, operationalPlanWeekEndDay))}</TableCell>
                          {kind === "internal_transaction" ? <TableCell className="text-right">{selectedTransactionView === "incoming" ? task.assignedByName : task.assignedToName}</TableCell> : null}
                          <TableCell className="text-right">
                            {kind === "internal_transaction" && selectedTransactionView === "outgoing" ? (
                              <Badge variant={getTaskDisplayVariant(task, operationalPlanWeekEndDay)} className={getStatusBadgeClass(task)}>{getTaskDisplayLabel(task, operationalPlanWeekEndDay)}</Badge>
                            ) : (
                              <Select value={task.status} onValueChange={(value) => runAction(() => handleUpdateStatus(task.id, value as TaskStatus))}>
                                <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                                  <SelectItem value="under_review">قيد المراجعة</SelectItem>
                                  <SelectItem value="stalled">متعثرة</SelectItem>
                                  <SelectItem value="completed">منتهية</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="text-right align-top">
                            <div className="inline-flex items-center justify-end gap-2 text-right">
                              {task.attachmentUrl ? (
                                <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openAttachmentPreview(task.title, task.attachmentUrl ?? "")}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {kind === "internal_transaction" && selectedTransactionView === "outgoing" ? null : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-9 w-9 rounded-xl"
                                  onClick={() => openAttachmentPicker(task)}
                                  disabled={attachmentTaskId === task.id}
                                  aria-label={task.attachmentUrl ? "تعديل المرفق" : "إرفاق ملف"}
                                >
                                  {attachmentTaskId === task.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          {isPersonalTaskPage && selectedPersonalFilter === "finished" ? (
                            <TableCell className="text-center align-top">
                              {task.operationalPlanOccurrenceId ? null : (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:text-red-700">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent dir="rtl">
                                    <AlertDialogHeader className="text-right">
                                      <AlertDialogTitle>حذف المهمة</AlertDialogTitle>
                                      <AlertDialogDescription>سيتم حذف المهمة فقط من قائمة المهام، ولن يتم حذف الملف المحفوظ في Google Drive.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => void handleDeleteTaskClick(task.id)}>{pendingDeleteTaskIds.includes(task.id) ? "جارٍ الحذف..." : "حذف"}</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </TableCell>
                          ) : null}
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
                <Button type="button" className="rounded-xl" onClick={openCreateTaskDialog}>
                  <Plus className="h-4 w-4" />
                  إضافة مهمة
                </Button>
              </div>

              <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
                <CardHeader>
                  <CardTitle>مهام الموظفين</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-5 max-w-sm text-right">
                    <Label className="mb-2 block">فلترة حسب الموظف</Label>
                    <Select value={selectedManagedUserId} onValueChange={setSelectedManagedUserId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="جميع الموظفين" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الموظفين</SelectItem>
                        {assignableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">العنوان</TableHead>
                        <TableHead className="text-right">المستخدم</TableHead>
                        <TableHead className="text-right">موعد التسليم</TableHead>
                        <TableHead className="text-right">الحالة</TableHead>
                        <TableHead className="text-right">المرفق</TableHead>
                        <TableHead className="w-[120px] text-center">الإجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredManagedTasks.length === 0 ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">لا توجد مهام لهذا الشهر مطابقة لهذا الموظف.</TableCell></TableRow> : filteredManagedTasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell className="max-w-[320px] whitespace-normal text-right"><p className="font-semibold text-foreground">{task.title}</p>{task.description ? <p className="mt-2 text-xs leading-6 text-muted-foreground">{task.description}</p> : null}</TableCell>
                          <TableCell className="text-right">{task.assignedToName}</TableCell>
                          <TableCell className="text-right">{formatDateTime(getTaskEffectiveDueAt(task, operationalPlanWeekEndDay))}</TableCell>
                          <TableCell className="text-right">
                            {getTaskCategory(task, operationalPlanWeekEndDay) === "stalled" ? (
                              <Badge variant={getTaskDisplayVariant(task, operationalPlanWeekEndDay)} className={getStatusBadgeClass(task)}>{getTaskDisplayLabel(task, operationalPlanWeekEndDay)}</Badge>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                className="h-auto cursor-pointer p-0 hover:bg-transparent"
                                onClick={() => runAction(() => handleUpdateStatus(task.id, task.status === "completed" ? "under_review" : "completed"))}
                              >
                                <Badge variant={getTaskDisplayVariant(task, operationalPlanWeekEndDay)} className={getStatusBadgeClass(task)}>
                                  {getTaskDisplayLabel(task, operationalPlanWeekEndDay)}
                                </Badge>
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {task.attachmentUrl ? (
                              <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openAttachmentPreview(task.title, task.attachmentUrl ?? "")}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-sm text-muted-foreground">لا يوجد</span>
                            )}
                          </TableCell>
                          <TableCell className="w-[120px] text-center">
                            <div className="inline-flex items-center justify-center gap-2">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl text-red-600 hover:text-red-700">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent dir="rtl">
                                  <AlertDialogHeader className="text-right">
                                    <AlertDialogTitle>حذف المهمة</AlertDialogTitle>
                                    <AlertDialogDescription>سيتم حذف المهمة نهائياً من قائمة الموظف والتنبيهات المرتبطة بها.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => void handleDeleteTaskClick(task.id)}>{pendingDeleteTaskIds.includes(task.id) ? "جارٍ الحذف..." : "حذف"}</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-xl" onClick={() => openEditDialog(task)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-2xl" showCloseButton={false}>
                  <div className="bg-[linear-gradient(135deg,rgba(1,154,151,0.08),rgba(255,255,255,0.98))] p-6">
                    <DialogHeader className="items-start text-left">
                      <DialogTitle className="text-2xl">تعديل المهمة</DialogTitle>
                    </DialogHeader>
                  </div>

                  <div className="grid gap-4 p-6 pt-2 md:grid-cols-2">
                    <div className="space-y-2 text-right"><Label>إسناد إلى</Label><Select value={taskForm.assignedToUserId} onValueChange={(value) => setTaskForm((current) => ({ ...current, assignedToUserId: value }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{assignableUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} {user.role === "admin" ? "(إداري)" : "(مستخدم)"}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2 text-right">
                      <Label>موعد التسليم</Label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DatePickerField value={getDueDateValue(taskForm.dueAt)} onChange={(value) => setTaskForm((current) => ({ ...current, dueAt: mergeDueAtValue(value, getDueTimeValue(current.dueAt)) }))} placeholder="اختر التاريخ" />
                        <Input type="time" value={getDueTimeValue(taskForm.dueAt)} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: mergeDueAtValue(getDueDateValue(current.dueAt), event.target.value) }))} />
                      </div>
                    </div>
                    <div className="space-y-2 text-right md:col-span-2"><Label>العنوان</Label><Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} /></div>
                    <div className="space-y-2 text-right md:col-span-2"><Label>الوصف</Label><Textarea rows={5} value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} placeholder="اختياري" /></div>
                  </div>
                  <div className="px-6 pb-6"><Button type="button" className="rounded-xl" onClick={() => void handleEditTaskClick()} disabled={isEditingTask}><Pencil className="h-4 w-4" />{isEditingTask ? "جارٍ حفظ التعديل..." : "حفظ التعديل"}</Button></div>
                </DialogContent>
              </Dialog>

            </>
          ) : null}

        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open)

            if (!open) {
              resetCreateTaskState()
            }
          }}
        >
          <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-2xl" showCloseButton={false}>
            <div className="bg-[linear-gradient(135deg,rgba(1,154,151,0.08),rgba(255,255,255,0.98))] p-6">
              <DialogHeader className="items-start text-left">
                <DialogTitle className="text-2xl">إضافة مهمة جديدة</DialogTitle>
              </DialogHeader>
            </div>

            <div className="grid gap-4 p-6 pt-2 md:grid-cols-2">
              {!isPersonalTaskPage ? (
                <div className="space-y-2 text-right">
                  <Label>إسناد إلى</Label>
                  <Select value={taskForm.assignedToUserId} onValueChange={(value) => setTaskForm((current) => ({ ...current, assignedToUserId: value }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {assignableUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name} {user.role === "admin" ? "(إداري)" : "(مستخدم)"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2 text-right md:col-span-2">
                <Label>اسم المهمة</Label>
                <input
                  ref={createAttachmentInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => setCreateAttachmentFile(event.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-2">
                  <Input value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
                  <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={() => createAttachmentInputRef.current?.click()} aria-label="رفع صورة المهمة">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 text-right md:col-span-2">
                <Label>الوصف</Label>
                <Textarea rows={5} value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} placeholder="اختياري" />
              </div>
              <div className="space-y-2 text-right md:col-span-2">
                <Label>موعد التسليم</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <DatePickerField value={getDueDateValue(taskForm.dueAt)} onChange={(value) => setTaskForm((current) => ({ ...current, dueAt: mergeDueAtValue(value, getDueTimeValue(current.dueAt)) }))} placeholder="اختر التاريخ" />
                  <Input type="time" value={getDueTimeValue(taskForm.dueAt)} onChange={(event) => setTaskForm((current) => ({ ...current, dueAt: mergeDueAtValue(getDueDateValue(current.dueAt), event.target.value) }))} />
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <Button type="button" className="rounded-xl" onClick={() => void handleCreateTaskClick()} disabled={isCreatingTask || !taskForm.title.trim() || !taskForm.dueAt}>
                <Plus className="h-4 w-4" />
                {isCreatingTask ? "جارٍ إضافة المهمة..." : "إضافة المهمة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(previewAttachment)} onOpenChange={(open) => { if (!open) setPreviewAttachment(null) }}>
          <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-4xl" showCloseButton={false}>
            <DialogHeader className="sr-only">
              <DialogTitle>{previewAttachment ? `معاينة مرفق ${previewAttachment.title}` : "معاينة المرفق"}</DialogTitle>
            </DialogHeader>
            <div className="p-6 pt-2">
              {previewAttachment ? (
                isImageAttachment(previewAttachment.url) ? (
                  <img src={previewAttachment.url} alt={previewAttachment.title} className="max-h-[70vh] w-full rounded-[1.25rem] object-contain" />
                ) : (
                  <iframe src={previewAttachment.url} title={previewAttachment.title} className="h-[70vh] w-full rounded-[1.25rem] border border-border/60 bg-white" />
                )
              ) : null}
            </div>
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
