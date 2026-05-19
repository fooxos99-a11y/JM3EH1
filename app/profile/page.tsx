import { ShieldCheck, UserRound } from "lucide-react"

import { requireCurrentUser } from "@/lib/auth"

export default async function ProfilePage() {
  const user = await requireCurrentUser()

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7fbfb,#eef4f4)] px-4 py-24">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/70 bg-white/95 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4">
          <div className="text-right">
            <h1 className="text-3xl font-bold text-foreground">الملف الشخصي</h1>
            <p className="mt-2 text-sm text-muted-foreground">معلومات الحساب الحالية والدور المرتبط به.</p>
          </div>

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UserRound className="h-7 w-7" />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-border/60 bg-muted/20 p-5 text-right">
            <p className="text-xs font-medium text-muted-foreground">الاسم</p>
            <p className="mt-2 text-lg font-bold text-foreground">{user.name}</p>
          </div>

          <div className="rounded-[1.5rem] border border-border/60 bg-muted/20 p-5 text-right">
            <p className="text-xs font-medium text-muted-foreground">رقم الجوال</p>
            <p className="mt-2 text-lg font-bold text-foreground" dir="ltr">{user.phone}</p>
          </div>

          <div className="rounded-[1.5rem] border border-border/60 bg-muted/20 p-5 text-right">
            <p className="text-xs font-medium text-muted-foreground">البريد الإلكتروني</p>
            <p className="mt-2 text-lg font-bold text-foreground" dir="ltr">{user.email ?? "غير مضاف"}</p>
          </div>

          <div className="rounded-[1.5rem] border border-border/60 bg-muted/20 p-5 text-right">
            <p className="text-xs font-medium text-muted-foreground">نوع الحساب</p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              <ShieldCheck className="h-4 w-4" />
              {user.role === "admin" ? "إداري" : "مستخدم"}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}