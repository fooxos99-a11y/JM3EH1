"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bell, ChevronDown, Menu } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { AdminChatPanel } from "@/components/admin-chat-panel"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { filterDashboardSections } from "@/lib/dashboard"
import type { DashboardPermissionKey } from "@/lib/dashboard-permissions"

type AdminDashboardShellProps = {
  userId: string
  userName: string
  userTitle: string | null
  userPermissions: Array<DashboardPermissionKey | "*">
  logoUrl: string
  logoAlt: string
  children: React.ReactNode
}

function SidebarContent({ permissions, logoUrl, logoAlt }: { permissions: Array<DashboardPermissionKey | "*">; logoUrl: string; logoAlt: string }) {
  const pathname = usePathname()
  const sections = useMemo(() => filterDashboardSections(permissions), [permissions])
  const [isMounted, setIsMounted] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    setOpenGroups((current) => {
      const nextEntries = Object.fromEntries(sections.map((group) => [group.title, current[group.title] ?? true]))
      return nextEntries
    })
  }, [sections])

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-border/60 px-5 py-5 text-right">
        {logoUrl ? (
          <div className="flex justify-end">
            <img src={logoUrl} alt={logoAlt} className="max-h-16 w-auto max-w-full object-contain" />
          </div>
        ) : (
          <h2 className="text-lg font-bold text-foreground">لوحة التحكم</h2>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 text-right">
        {sections.map((group) => {
          const isOpen = isMounted ? (openGroups[group.title] ?? true) : true

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
                        <span>{item.label}</span>
                        <span className={`h-2 w-2 rounded-full ${isActive ? "bg-white" : "bg-primary/20"}`} />
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

export function AdminDashboardShell({ userId, userName, userTitle, userPermissions, logoUrl, logoAlt, children }: AdminDashboardShellProps) {
  return (
    <div dir="rtl" className="min-h-screen bg-[linear-gradient(180deg,#f8fbfb,#eef5f5)] text-right">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[320px] shrink-0 border-r border-white/60 bg-white/95 shadow-[10px_0_35px_rgba(15,23,42,0.04)] lg:block">
          <SidebarContent permissions={userPermissions} logoUrl={logoUrl} logoAlt={logoAlt} />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-4 text-right md:px-6 lg:px-8 lg:py-8 lg:pl-0">
          <div className="mb-6 flex items-center justify-between rounded-[2rem] border border-white/70 bg-white/90 px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-2xl lg:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[320px] border-l border-border/60 p-0 sm:max-w-[320px]">
                  <SheetHeader className="sr-only">
                    <SheetTitle>قائمة لوحة التحكم</SheetTitle>
                  </SheetHeader>
                  <SidebarContent permissions={userPermissions} logoUrl={logoUrl} logoAlt={logoAlt} />
                </SheetContent>
              </Sheet>

              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">مرحبًا</p>
                <p className="text-sm font-bold text-foreground">{userName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="relative h-10 w-10 rounded-full border-primary/15 bg-white/80" aria-label="الإشعارات">
                <Bell className="h-5 w-5" />
                <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-amber-500" />
              </Button>
              <div className="text-right">
                <p className="text-xs font-medium text-muted-foreground">{userTitle ?? "حساب إداري"}</p>
                <p className="text-sm font-bold text-foreground">لوحة التحكم</p>
              </div>
            </div>
          </div>

          <div className="px-1 md:px-2">
            {children}
          </div>

          <AdminChatPanel iconOnly triggerClassName="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full border-white/80 bg-white/95 shadow-[0_20px_45px_rgba(15,23,42,0.18)] backdrop-blur-sm" />
        </main>
      </div>
    </div>
  )
}
