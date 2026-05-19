"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, ChevronDown, FolderPlus, MapPinned, Menu, Upload, UserRound } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { AdminChatPanel } from "@/components/admin-chat-panel"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { filterDashboardSections } from "@/lib/dashboard"
import type { DashboardPermissionKey } from "@/lib/dashboard-permissions"
import type { TasksPageData } from "@/lib/tasks"

function getWeightClass(weight: "normal" | "bold") {
  return weight === "bold" ? "font-extrabold" : "font-normal"
}

type AdminDashboardShellProps = {
  userId: string
  userName: string
  userTitle: string | null
  userProfileSummary: {
    phone: string
    email: string | null
    nationalId: string
    jobRank: string
  }
  userPermissions: Array<DashboardPermissionKey | "*">
  logoUrl: string
  logoAlt: string
  logoArabicName: string
  logoEnglishName: string
  logoTextColor: string
  logoArabicFontWeight: "normal" | "bold"
  logoEnglishFontWeight: "normal" | "bold"
  children: React.ReactNode
}

function ProfileInfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-border/70 bg-muted/15 p-4 text-right">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value || "-"}</p>
    </div>
  )
}

function SidebarContent({ permissions, logoUrl, logoAlt, logoArabicName, logoEnglishName, logoTextColor, logoArabicFontWeight, logoEnglishFontWeight }: { permissions: Array<DashboardPermissionKey | "*">; logoUrl: string; logoAlt: string; logoArabicName: string; logoEnglishName: string; logoTextColor: string; logoArabicFontWeight: "normal" | "bold"; logoEnglishFontWeight: "normal" | "bold" }) {
  const pathname = usePathname()
  const sections = useMemo(() => filterDashboardSections(permissions), [permissions])
  const [isMounted, setIsMounted] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [pendingTasksCount, setPendingTasksCount] = useState(0)
  const [pendingTransactionsCount, setPendingTransactionsCount] = useState(0)
  const [pendingStaffRequestsCount, setPendingStaffRequestsCount] = useState(0)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setOpenGroups((current) => {
      const nextEntries = Object.fromEntries(sections.map((group) => [group.title, current[group.title] ?? false]))
      return nextEntries
    })
  }, [sections])

  useEffect(() => {
    let isCancelled = false

    async function loadSidebarBadges() {
      try {
        const hasTasksAccess = permissions.includes("*") || permissions.includes("tasks")
        const hasAdministrativeAccess = permissions.includes("*") || permissions.includes("administrative_requests")
        const isManager = permissions.includes("*")

        const requests: Array<Promise<Response>> = []

        if (hasTasksAccess) {
          requests.push(fetch("/api/tasks?kind=task", { cache: "no-store" }))
          requests.push(fetch("/api/tasks?kind=internal_transaction", { cache: "no-store" }))
        }

        if (hasAdministrativeAccess && isManager) {
          requests.push(fetch("/api/admin/administrative-requests?summary=counts", { cache: "no-store" }))
        }

        if (requests.length === 0) {
          if (!isCancelled) {
            setPendingTasksCount(0)
            setPendingTransactionsCount(0)
            setPendingStaffRequestsCount(0)
          }
          return
        }

        const responses = await Promise.all(requests)
        const payloads = await Promise.all(responses.map(async (response) => {
          if (!response.ok) {
            return null
          }

          return response.json()
        }))

        if (!isCancelled) {
          const tasksPayload = payloads[0] as TasksPageData | null
          const transactionsPayload = payloads[1] as TasksPageData | null
          const administrativePayload = (hasAdministrativeAccess && isManager ? payloads[payloads.length - 1] : null) as { unreadReviewRequestsCount?: number } | null

          setPendingTasksCount(tasksPayload?.pendingTasksCount ?? 0)
          setPendingTransactionsCount(transactionsPayload?.unreadNotificationsCount ?? 0)
          setPendingStaffRequestsCount(administrativePayload?.unreadReviewRequestsCount ?? 0)
        }
      } catch {
        // Ignore sidebar badge failures to avoid blocking navigation.
      }
    }

    void loadSidebarBadges()

    function handleBadgeRefresh() {
      void loadSidebarBadges()
    }

    window.addEventListener("dashboard-badges-changed", handleBadgeRefresh)

    return () => {
      isCancelled = true
      window.removeEventListener("dashboard-badges-changed", handleBadgeRefresh)
    }
  }, [permissions, pathname])

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-border/60 px-4 py-5 text-right">
        {logoUrl ? (
          <div className="mr-auto flex w-full max-w-[252px] items-center justify-end gap-3 pr-2">
            <div className="shrink-0">
              <img src={logoUrl} alt={logoAlt} className="h-14 w-14 object-contain" />
            </div>
            <div className="text-right">
              <p className={`whitespace-nowrap text-sm leading-tight ${getWeightClass(logoArabicFontWeight)}`} style={{ color: logoTextColor }}>{logoArabicName}</p>
              <p className={`mt-1 text-[10px] tracking-[0.02em] ${getWeightClass(logoEnglishFontWeight)}`} style={{ color: logoTextColor }} dir="ltr">{logoEnglishName}</p>
            </div>
          </div>
        ) : (
          <h2 className="text-lg font-bold text-foreground">{logoArabicName}</h2>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 text-right">
        {sections.map((group) => {
          const isOpen = isMounted ? (openGroups[group.title] ?? false) : false

          return (
            <section key={group.title} className="border-b border-border/50 py-2 last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  if (!isMounted) {
                    return
                  }

                  setOpenGroups((current) => ({ ...current, [group.title]: !isOpen }))
                }}
                className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] font-bold text-foreground transition-[background-color,color,transform] duration-300 hover:bg-primary/5 hover:text-primary"
              >
                <span>{group.title}</span>
                <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform duration-300 ${isOpen ? "rotate-0" : "-rotate-90"}`} />
              </button>

              <div className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-70"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-1 pb-1 pt-1.5">
                  {group.items.map((item) => {
                    const href = `/dashboard/${item.slug}`
                    const isActive = isMounted && pathname === href
                    const badgeCount = item.slug === "my_tasks"
                      ? pendingTasksCount
                      : item.slug === "my_transactions"
                        ? pendingTransactionsCount
                        : item.slug === "staff_requests"
                          ? pendingStaffRequestsCount
                          : 0

                    return (
                      <Link
                        key={item.slug}
                        href={href}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-300 ${
                          isActive
                            ? "bg-primary text-white shadow-lg shadow-primary/20"
                            : "text-foreground hover:bg-primary/5 hover:text-primary"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{item.label}</span>
                        </div>
                        {badgeCount > 0 ? (
                          <span
                            className={`inline-flex min-w-3 items-center justify-center text-[11px] font-bold leading-none ${
                              isActive
                                ? "text-white"
                                : "text-rose-500"
                            }`}
                          >
                            {badgeCount}
                          </span>
                        ) : (
                          <span className={`h-2 w-2 rounded-full ${isActive ? "bg-white" : "bg-primary/20"}`} />
                        )}
                      </Link>
                    )
                  })}
                </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

export function AdminDashboardShell({ userId, userName, userTitle, userProfileSummary, userPermissions, logoUrl, logoAlt, logoArabicName, logoEnglishName, logoTextColor, logoArabicFontWeight, logoEnglishFontWeight, children }: AdminDashboardShellProps) {
  const pathname = usePathname()
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [driveActionsState, setDriveActionsState] = useState({ canUpload: false, canCreateFolder: false, googleEmail: null as string | null, canDisconnect: false, canChooseLocation: false })

  useEffect(() => {
    if (pathname !== "/dashboard/my_files") {
      setDriveActionsState({ canUpload: false, canCreateFolder: false })
      return
    }

    function handleDriveActionsState(event: Event) {
      const customEvent = event as CustomEvent<{ canUpload: boolean; canCreateFolder: boolean; googleEmail: string | null; canDisconnect: boolean; canChooseLocation: boolean }>
      setDriveActionsState({
        canUpload: Boolean(customEvent.detail?.canUpload),
        canCreateFolder: Boolean(customEvent.detail?.canCreateFolder),
        googleEmail: customEvent.detail?.googleEmail ?? null,
        canDisconnect: Boolean(customEvent.detail?.canDisconnect),
        canChooseLocation: Boolean(customEvent.detail?.canChooseLocation),
      })
    }

    window.addEventListener("drive-files-actions-state", handleDriveActionsState as EventListener)

    return () => {
      window.removeEventListener("drive-files-actions-state", handleDriveActionsState as EventListener)
    }
  }, [pathname])

  const isDriveFilesPage = pathname === "/dashboard/my_files"

  return (
    <div dir="rtl" className="dashboard-rtl min-h-screen bg-[linear-gradient(180deg,#f8fbfb,#eef5f5)] text-right">
      <div className="flex min-h-screen w-full items-start lg:flex-row">
        <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 border-l border-white/60 bg-white/95 shadow-[10px_0_35px_rgba(15,23,42,0.04)] lg:block">
          <SidebarContent permissions={userPermissions} logoUrl={logoUrl} logoAlt={logoAlt} logoArabicName={logoArabicName} logoEnglishName={logoEnglishName} logoTextColor={logoTextColor} logoArabicFontWeight={logoArabicFontWeight} logoEnglishFontWeight={logoEnglishFontWeight} />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 text-right md:px-6 lg:px-8 lg:py-8">
          <div className="w-full">
            <div className="mb-6 flex w-full items-center justify-between rounded-[2rem] border border-white/70 bg-white/90 px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">مرحبًا</p>
                <p className="text-sm font-bold text-foreground">{userName}</p>
              </div>

              <div className="flex items-center gap-3">
                {isDriveFilesPage ? (
                  <>
                    {driveActionsState.googleEmail ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <button
                          type="button"
                          className="font-medium text-red-600 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => window.dispatchEvent(new Event("drive-files-disconnect"))}
                          disabled={!driveActionsState.canDisconnect}
                        >
                          فصل الحساب
                        </button>
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl border-primary/15 bg-white/80"
                      onClick={() => window.dispatchEvent(new Event("drive-files-open-location"))}
                      disabled={!driveActionsState.canChooseLocation}
                    >
                      <MapPinned className="h-4 w-4" />
                      مكان ملفاتي
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl border-primary/15 bg-white/80"
                      onClick={() => window.dispatchEvent(new Event("drive-files-create-folder"))}
                      disabled={!driveActionsState.canCreateFolder}
                    >
                      <FolderPlus className="h-4 w-4" />
                      إنشاء مجلد
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-2xl border-primary/15 bg-white/80"
                      onClick={() => window.dispatchEvent(new Event("drive-files-upload"))}
                      disabled={!driveActionsState.canUpload}
                    >
                      <Upload className="h-4 w-4" />
                      رفع ملف
                    </Button>
                  </>
                ) : null}
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="rounded-2xl lg:hidden">
                      <Menu className="h-5 w-5" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[320px] border-r border-border/60 p-0 text-right sm:max-w-[320px]">
                    <SheetHeader className="sr-only">
                      <SheetTitle>قائمة لوحة التحكم</SheetTitle>
                    </SheetHeader>
                    <SidebarContent permissions={userPermissions} logoUrl={logoUrl} logoAlt={logoAlt} logoArabicName={logoArabicName} logoEnglishName={logoEnglishName} logoTextColor={logoTextColor} logoArabicFontWeight={logoArabicFontWeight} logoEnglishFontWeight={logoEnglishFontWeight} />
                  </SheetContent>
                </Sheet>
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/15 bg-white/80 text-foreground" aria-label="الإشعارات">
                  <Bell className="h-5 w-5" />
                </div>
                <Button variant="outline" size="icon" className="rounded-full border-primary/15 bg-white/80" onClick={() => setIsProfileDialogOpen(true)} aria-label="الملف الوظيفي المختصر">
                  <UserRound className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <Dialog open={isProfileDialogOpen} onOpenChange={setIsProfileDialogOpen}>
              <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-2xl" showCloseButton={false}>
                <div className="bg-[linear-gradient(135deg,rgba(1,154,151,0.08),rgba(255,255,255,0.98))] p-6">
                  <DialogHeader className="items-start text-left">
                    <DialogTitle className="text-2xl">الملف الوظيفي</DialogTitle>
                  </DialogHeader>
                </div>
                <div className="space-y-5 p-6 pt-2">
                  <div className="rounded-[1.4rem] border border-border/70 bg-muted/15 p-5 text-right">
                    <p className="text-xs text-muted-foreground">بيانات مختصرة</p>
                    <h3 className="mt-2 text-xl font-bold text-foreground">{userName}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{userTitle || "-"}</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ProfileInfoItem label="رقم الجوال" value={userProfileSummary.phone} />
                    <ProfileInfoItem label="البريد الإلكتروني" value={userProfileSummary.email ?? ""} />
                    <ProfileInfoItem label="رقم الهوية" value={userProfileSummary.nationalId} />
                    <ProfileInfoItem label="الرتبة الوظيفية" value={userProfileSummary.jobRank} />
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="mx-auto w-full max-w-[1280px] px-1 md:px-2">
              {children}
            </div>
          </div>

          <AdminChatPanel iconOnly triggerClassName="fixed right-6 bottom-6 z-50 h-14 w-14 rounded-full border-white/80 bg-white/95 shadow-[0_20px_45px_rgba(15,23,42,0.18)] backdrop-blur-sm" />
        </main>
      </div>
    </div>
  )
}
