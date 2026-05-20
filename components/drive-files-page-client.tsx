"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { ExternalLink, FileImage, FileText, Folder, FolderPlus, LoaderCircle, Pencil, Search, Trash2, Upload } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { DriveBrowserData, DriveItem, DriveScope } from "@/lib/drive"

type GoogleDriveStatus = {
  configured: boolean
  connected: boolean
  googleEmail: string | null
}

type FolderOptionsPayload = {
  folders?: Array<{ id: string; name: string; path: string }>
  defaultFolderId?: string | null
  defaultFolderName?: string | null
  error?: string
}

const GOOGLE_DRIVE_CONNECT_REQUIRED = "GOOGLE_DRIVE_CONNECT_REQUIRED"
const VIRTUAL_ALL_FILES_ROOT_ID = "__all_files__"

function isPdfFile(item: DriveItem) {
  return item.mimeType === "application/pdf" || item.name.toLowerCase().endsWith(".pdf")
}

function isImageFile(item: DriveItem) {
  return item.mimeType.startsWith("image/")
}

function getPreviewImageSrc(item: DriveItem) {
  if (!item.thumbnailLink) {
    return null
  }

  return item.thumbnailLink.replace(/=s\d+$/, "=s800")
}

function renderItemPreview(item: DriveItem) {
  if (item.isFolder) {
    return <Folder className="h-20 w-20 text-amber-500" />
  }

  if (isImageFile(item) && getPreviewImageSrc(item)) {
    return <img src={getPreviewImageSrc(item) ?? undefined} alt={item.name} className="h-full w-full object-contain bg-white" referrerPolicy="no-referrer" />
  }

  if (isPdfFile(item)) {
    return <FileText className="h-20 w-20 text-red-500" />
  }

  if (item.iconLink) {
    return <img src={item.iconLink} alt={item.name} className="h-16 w-16 object-contain" />
  }

  return <FileImage className="h-20 w-20 text-slate-400" />
}

export function DriveFilesPageClient({ embedded = false }: { embedded?: boolean }) {
  const [scope, setScope] = useState<DriveScope>("my_files")
  const [data, setData] = useState<DriveBrowserData | null>(null)
  const [googleDriveStatus, setGoogleDriveStatus] = useState<GoogleDriveStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [createFolderName, setCreateFolderName] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false)
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; name: string; path: string }>>([])
  const [folderSearchQuery, setFolderSearchQuery] = useState("")
  const [selectedDefaultFolderId, setSelectedDefaultFolderId] = useState("")
  const [defaultFolderName, setDefaultFolderName] = useState<string | null>(null)
  const [loadingFolderOptions, setLoadingFolderOptions] = useState(false)
  const [renameItem, setRenameItem] = useState<DriveItem | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isVirtualAllFilesRoot = Boolean(data && scope === "all_files" && data.currentFolderId === VIRTUAL_ALL_FILES_ROOT_ID)

  function getMutationParentId() {
    if (!data) {
      return null
    }

    return isVirtualAllFilesRoot ? "root" : data.currentFolderId
  }

  async function reloadCurrentView() {
    if (!data) {
      return
    }

    if (isVirtualAllFilesRoot) {
      await loadData(scope)
      return
    }

    await loadData(scope, data.currentFolderId)
  }

  async function loadGoogleDriveStatus() {
    const response = await fetch("/api/auth/google/status", { cache: "no-store" })
    const payload = (await response.json()) as GoogleDriveStatus & { error?: string }

    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر تحميل حالة Google Drive")
    }

    setGoogleDriveStatus(payload)
    return payload
  }

  async function loadFolderOptions() {
    setLoadingFolderOptions(true)

    try {
      const response = await fetch("/api/drive/folders", { cache: "no-store" })
      const payload = (await response.json()) as FolderOptionsPayload

      if (!response.ok || !payload.folders) {
        throw new Error(payload.error ?? "تعذر تحميل مجلدات الموقع")
      }

      setFolderOptions(payload.folders)
      setSelectedDefaultFolderId(payload.defaultFolderId ?? "")
      setDefaultFolderName(payload.defaultFolderName ?? null)
      return payload
    } finally {
      setLoadingFolderOptions(false)
    }
  }

  async function loadData(nextScope = scope, folderId?: string | null, query?: string) {
    setLoading(true)
    const searchParams = new URLSearchParams({ scope: nextScope })

    if (folderId) {
      searchParams.set("folderId", folderId)
    }

    if (query?.trim()) {
      searchParams.set("q", query.trim())
    }

    const response = await fetch(`/api/drive?${searchParams.toString()}`, { cache: "no-store" })
    const payload = (await response.json()) as DriveBrowserData & { error?: string }

    if (!response.ok) {
      if (payload.error === GOOGLE_DRIVE_CONNECT_REQUIRED) {
        setData(null)
        setLoading(false)
        return
      }

      setMessage({ type: "error", text: payload.error ?? "تعذر تحميل الملفات" })
      setLoading(false)
      return
    }

    setData(payload)
    setLoading(false)
  }

  useEffect(() => {
    void (async () => {
      try {
        const status = await loadGoogleDriveStatus()
        if (status.configured && !status.connected) {
          setLoading(false)
          setData(null)
          return
        }

        await loadData(scope)
      } catch (error) {
        setMessage({ type: "error", text: error instanceof Error ? error.message : "تعذر تحميل بيانات Google Drive" })
        setLoading(false)
      }
    })()
  }, [scope])

  useEffect(() => {
    if (!googleDriveStatus?.connected || folderOptions.length > 0 || loadingFolderOptions) {
      return
    }

    void loadFolderOptions().catch(() => {
      // Keep the page usable even if preloading folder options fails.
    })
  }, [googleDriveStatus?.connected, folderOptions.length, loadingFolderOptions])

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

  async function handleCreateFolder() {
    const parentId = getMutationParentId()
    if (!parentId) {
      return
    }

    const response = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_folder",
        parentId,
        name: createFolderName,
      }),
    })
    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر إنشاء المجلد")
    }

    setCreateFolderName("")
    setIsCreateDialogOpen(false)
    await reloadCurrentView()
    setMessage({ type: "success", text: "تم إنشاء المجلد" })
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const parentId = getMutationParentId()
    if (!file || !parentId) {
      return
    }

    runAction(async () => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("parentId", parentId)

      const response = await fetch("/api/drive/upload", {
        method: "POST",
        body: formData,
      })
      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر رفع الملف")
      }

      await reloadCurrentView()
      setMessage({ type: "success", text: "تم رفع الملف" })
    })

    event.target.value = ""
  }

  async function handleRename() {
    if (!renameItem || !renameValue.trim() || !data) {
      return
    }

    const response = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "rename_item",
        itemId: renameItem.id,
        name: renameValue,
      }),
    })
    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر إعادة التسمية")
    }

    setRenameItem(null)
    setRenameValue("")
    await reloadCurrentView()
    setMessage({ type: "success", text: "تم تحديث الاسم" })
  }

  async function handleDelete(item: DriveItem) {
    if (!data || !window.confirm(`سيتم حذف ${item.isFolder ? "المجلد" : "الملف"} نهائيًا. هل تريد المتابعة؟`)) {
      return
    }

    const response = await fetch("/api/drive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delete_item",
        itemId: item.id,
      }),
    })
    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر الحذف")
    }

    await reloadCurrentView()
    setMessage({ type: "success", text: "تم حذف العنصر" })
  }

  async function handleDisconnectGoogleDrive() {
    const response = await fetch("/api/auth/google/disconnect", { method: "POST" })
    const payload = (await response.json()) as { error?: string }

    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر فصل حساب Google")
    }

    setData(null)
    setGoogleDriveStatus((current) => current ? { ...current, connected: false, googleEmail: null } : current)
    setMessage({ type: "success", text: "تم فصل Google Drive" })
  }

  async function handleSaveDefaultFolder() {
    if (!selectedDefaultFolderId) {
      throw new Error("اختر مجلدًا أولًا")
    }

    const selectedFolder = folderOptions.find((folder) => folder.id === selectedDefaultFolderId)
    if (!selectedFolder) {
      throw new Error("المجلد المحدد غير موجود")
    }

    const response = await fetch("/api/drive/folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId: selectedFolder.id, folderName: selectedFolder.name }),
    })
    const payload = (await response.json()) as { defaultFolderId?: string; defaultFolderName?: string; error?: string }

    if (!response.ok) {
      throw new Error(payload.error ?? "تعذر حفظ مكان ملفاتي")
    }

    setDefaultFolderName(payload.defaultFolderName ?? selectedFolder.name)
    setIsLocationDialogOpen(false)
    await loadData(scope)
    setMessage({ type: "success", text: "تم حفظ مكان ملفاتي" })
  }

  async function handleOpenItem(item: DriveItem) {
    if (item.isFolder) {
      await loadData(scope, item.id)
      return
    }

    if (item.webViewLink) {
      window.open(item.webViewLink, "_blank", "noopener,noreferrer")
    }
  }

  const canUseTopBarActions = Boolean(data && !(googleDriveStatus?.configured && !googleDriveStatus.connected))

  useEffect(() => {
    function handleUploadRequest() {
      if (canUseTopBarActions) {
        fileInputRef.current?.click()
      }
    }

    function handleCreateFolderRequest() {
      if (canUseTopBarActions) {
        setIsCreateDialogOpen(true)
      }
    }

    function handleDisconnectRequest() {
      if (googleDriveStatus?.connected) {
        runAction(handleDisconnectGoogleDrive)
      }
    }

    function handleOpenLocationRequest() {
      if (!googleDriveStatus?.connected) {
        return
      }

      setFolderSearchQuery("")
      setIsLocationDialogOpen(true)

      if (folderOptions.length === 0 && !loadingFolderOptions) {
        runAction(async () => {
          await loadFolderOptions()
        })
      }
    }

    window.addEventListener("drive-files-upload", handleUploadRequest)
    window.addEventListener("drive-files-create-folder", handleCreateFolderRequest)
    window.addEventListener("drive-files-disconnect", handleDisconnectRequest)
    window.addEventListener("drive-files-open-location", handleOpenLocationRequest)

    return () => {
      window.removeEventListener("drive-files-upload", handleUploadRequest)
      window.removeEventListener("drive-files-create-folder", handleCreateFolderRequest)
      window.removeEventListener("drive-files-disconnect", handleDisconnectRequest)
      window.removeEventListener("drive-files-open-location", handleOpenLocationRequest)
    }
  }, [canUseTopBarActions, folderOptions.length, googleDriveStatus?.connected, loadingFolderOptions])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("drive-files-actions-state", {
      detail: {
        canUpload: canUseTopBarActions,
        canCreateFolder: canUseTopBarActions,
        googleEmail: googleDriveStatus?.googleEmail ?? null,
        canDisconnect: Boolean(googleDriveStatus?.connected),
        canChooseLocation: Boolean(googleDriveStatus?.connected),
      },
    }))

    return () => {
      window.dispatchEvent(new CustomEvent("drive-files-actions-state", {
        detail: {
          canUpload: false,
          canCreateFolder: false,
          googleEmail: null,
          canDisconnect: false,
          canChooseLocation: false,
        },
      }))
    }
  }, [canUseTopBarActions, googleDriveStatus?.googleEmail, googleDriveStatus?.connected])

  const filteredFolderOptions = folderOptions.filter((folder) => {
    const query = folderSearchQuery.trim().toLowerCase()
    if (!query) {
      return true
    }

    return folder.name.toLowerCase().includes(query) || folder.path.toLowerCase().includes(query)
  })

  if (loading) {
    return (
      <div className={embedded ? "rounded-[1.75rem] border border-white/80 bg-white/95 p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]" : "mx-auto max-w-6xl rounded-[1.75rem] border border-white/80 bg-white/95 p-12 text-center shadow-[0_18px_45px_rgba(15,23,42,0.05)]"}>
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className={embedded ? "space-y-6" : "mx-auto max-w-6xl space-y-6"}>
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />

      {message ? (
        <Alert className={message.type === "success" ? "rounded-[1.5rem] border-emerald-200 bg-emerald-50/80 text-right text-emerald-900" : "rounded-[1.5rem] border-red-200 bg-red-50/80 text-right"}>
          <AlertTitle>{message.type === "success" ? "تم تنفيذ العملية" : "يوجد تنبيه"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      ) : null}

      {googleDriveStatus?.configured && !googleDriveStatus.connected ? (
        <Alert className="rounded-[1.5rem] border-amber-200 bg-amber-50/80 text-right text-amber-900">
          <AlertTitle>يلزم ربط Google Drive</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>اربط حساب Google الخاص بك ليظهر لك كل ما في Drive داخل هذه الصفحة.</span>
            <Button type="button" className="rounded-xl" onClick={() => { window.location.href = "/api/auth/google/connect" }}>
              ربط Google Drive
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-[1.5rem] border-white/80 bg-white/95">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-start gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant={scope === "my_files" ? "default" : "outline"} className="rounded-xl" onClick={() => setScope("my_files")}>ملفاتي</Button>
              <Button type="button" variant={scope === "all_files" ? "default" : "outline"} className="rounded-xl" onClick={() => setScope("all_files")}>جميع الملفات</Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-3">
            <div className="grid w-full max-w-md grid-cols-[minmax(0,1fr)_auto] items-center gap-2" dir="ltr">
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="ابحث بالاسم في Google Drive" className="text-right" />
              <Button type="button" className="rounded-xl" onClick={() => void loadData(scope, undefined, searchQuery)} disabled={isPending}>
                <Search className="h-4 w-4" />
                بحث
              </Button>
            </div>
          </div>

        </CardHeader>
        <CardContent>
          {!data || data.items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">{googleDriveStatus?.configured && !googleDriveStatus.connected ? "اربط Google Drive أولًا." : "لا توجد عناصر في هذا المجلد."}</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {data.items.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-[1.5rem] border border-border/60 bg-white p-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
                >
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg bg-white/95"
                      onClick={(event) => {
                        event.stopPropagation()
                        setRenameItem(item)
                        setRenameValue(item.name)
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7 rounded-lg bg-white/95 text-red-600 hover:text-red-700"
                      onClick={(event) => {
                        event.stopPropagation()
                        runAction(() => handleDelete(item))
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <button type="button" className="block w-full text-right" onClick={() => void handleOpenItem(item)}>
                    <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[1.25rem] bg-muted/30">
                      {renderItemPreview(item)}
                    </div>
                    <div className="mt-3">
                      <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.name}</p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-[1.75rem]" showCloseButton={false}>
          <DialogHeader className="text-right">
            <DialogTitle>إنشاء مجلد جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-right">اسم المجلد</Label>
            <Input value={createFolderName} onChange={(event) => setCreateFolderName(event.target.value)} className="text-right" />
            <Button type="button" className="rounded-xl" onClick={() => runAction(handleCreateFolder)} disabled={isPending || !createFolderName.trim()}>
              <FolderPlus className="h-4 w-4" />
              إنشاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameItem)} onOpenChange={(open) => { if (!open) { setRenameItem(null); setRenameValue("") } }}>
        <DialogContent className="rounded-[1.75rem]" showCloseButton={false}>
          <DialogHeader className="text-right">
            <DialogTitle>إعادة تسمية العنصر</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-right">الاسم الجديد</Label>
            <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} className="text-right" />
            <Button type="button" className="rounded-xl" onClick={() => runAction(handleRename)} disabled={isPending || !renameValue.trim()}>
              <Pencil className="h-4 w-4" />
              حفظ الاسم
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isLocationDialogOpen} onOpenChange={setIsLocationDialogOpen}>
        <DialogContent className="rounded-[1.75rem]" showCloseButton={false}>
          <DialogHeader className="text-right">
            <DialogTitle>مكان ملفاتي</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Button type="button" className="rounded-xl" onClick={() => runAction(handleSaveDefaultFolder)} disabled={!selectedDefaultFolderId || isPending}>
                حفظ
              </Button>
              <Input value={folderSearchQuery} onChange={(event) => setFolderSearchQuery(event.target.value)} placeholder="ابحث في المجلدات" className="text-right" />
            </div>
            <div className="max-h-[22rem] space-y-2 overflow-y-auto rounded-[1.25rem] border border-border/60 p-2">
              {loadingFolderOptions ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                </div>
              ) : filteredFolderOptions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">لا توجد مجلدات مطابقة.</p>
              ) : filteredFolderOptions.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={`flex w-full flex-col items-end rounded-[1rem] border px-4 py-3 text-right transition ${selectedDefaultFolderId === folder.id ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/30 hover:bg-muted/30"}`}
                  onClick={() => setSelectedDefaultFolderId(folder.id)}
                >
                  <span className="font-semibold text-foreground">{folder.name}</span>
                  <span className="text-xs text-muted-foreground">{folder.path}</span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}