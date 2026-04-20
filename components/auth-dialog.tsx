"use client"

import { useEffect, useState } from "react"
import { LoaderCircle, LogIn, LogOut, ShieldCheck, UserPlus, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { supabaseBrowserClient } from "@/lib/supabase/client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type SessionUser = {
  id: string
  name: string
  phone: string
  email: string | null
  role: "admin" | "user"
}

type AuthDialogProps = {
  isScrolled: boolean
}

const defaultLoginForm = {
  phone: "",
  password: "",
}

const defaultRegisterForm = {
  name: "",
  phone: "",
  email: "",
  password: "",
}

const defaultPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
}

function normalizePhone(rawPhone: string) {
  const latinDigits = rawPhone
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[^\d+]/g, "")

  if (latinDigits.startsWith("00966")) {
    return `+${latinDigits.slice(2)}`
  }

  if (latinDigits.startsWith("966")) {
    return `+${latinDigits}`
  }

  if (latinDigits.startsWith("05") && latinDigits.length === 10) {
    return `+966${latinDigits.slice(1)}`
  }

  if (latinDigits.startsWith("5") && latinDigits.length === 9) {
    return `+966${latinDigits}`
  }

  return latinDigits.startsWith("+") ? latinDigits : `+${latinDigits}`
}

export function AuthDialog({ isScrolled }: AuthDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("login")
  const [user, setUser] = useState<SessionUser | null>(null)
  const [isConfigured, setIsConfigured] = useState(true)
  const [isPending, setIsPending] = useState(false)
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: "error" | "success"; text: string } | null>(null)
  const [loginForm, setLoginForm] = useState(defaultLoginForm)
  const [registerForm, setRegisterForm] = useState(defaultRegisterForm)
  const [passwordForm, setPasswordForm] = useState(defaultPasswordForm)
  const [otpCode, setOtpCode] = useState("")
  const [isOtpSent, setIsOtpSent] = useState(false)
  const [isPhoneVerified, setIsPhoneVerified] = useState(false)
  const [verifiedAccessToken, setVerifiedAccessToken] = useState<string | null>(null)

  async function loadSession() {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" })
      const payload = (await response.json()) as { user: SessionUser | null; configured?: boolean }
      setIsConfigured(payload.configured ?? true)
      setUser(payload.user)
    } catch {
      setIsConfigured(false)
      setUser(null)
    }
  }

  useEffect(() => {
    void loadSession()
  }, [])

  useEffect(() => {
    setOtpCode("")
    setIsOtpSent(false)
    setIsPhoneVerified(false)
    setVerifiedAccessToken(null)
  }, [registerForm.phone])

  async function submitForm(url: string, payload: Record<string, string>) {
    setIsPending(true)
    setMessage(null)

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      const result = (await response.json()) as {
        error?: string
        user?: SessionUser
      }

      if (!response.ok || !result.user) {
        setMessage({ type: "error", text: result.error ?? "تعذر إكمال العملية" })
        return
      }

      await supabaseBrowserClient.auth.signOut()
      setUser(result.user)
      setMessage({ type: "success", text: "تم تسجيل الدخول بنجاح" })
      setLoginForm(defaultLoginForm)
      setRegisterForm(defaultRegisterForm)
      setOtpCode("")
      setIsOtpSent(false)
      setIsPhoneVerified(false)
      setVerifiedAccessToken(null)
      setOpen(false)
    } catch {
      setMessage({ type: "error", text: "تعذر الاتصال بالخادم" })
    } finally {
      setIsPending(false)
    }
  }

  async function sendOtpCode() {
    if (!registerForm.phone.trim()) {
      setMessage({ type: "error", text: "أدخل رقم الجوال أولًا" })
      return
    }

    setIsPending(true)
    setMessage(null)

    try {
      const { error } = await supabaseBrowserClient.auth.signInWithOtp({
        phone: normalizePhone(registerForm.phone),
        options: {
          shouldCreateUser: true,
        },
      })

      if (error) {
        setMessage({ type: "error", text: error.message })
        return
      }

      setIsOtpSent(true)
      setIsPhoneVerified(false)
      setVerifiedAccessToken(null)
      setMessage({ type: "success", text: "تم إرسال رمز التحقق إلى الجوال" })
    } catch {
      setMessage({ type: "error", text: "تعذر إرسال رمز التحقق" })
    } finally {
      setIsPending(false)
    }
  }

  async function verifyOtpCode() {
    if (!otpCode.trim()) {
      setMessage({ type: "error", text: "أدخل رمز التحقق أولًا" })
      return
    }

    setIsPending(true)
    setMessage(null)

    try {
      const { data, error } = await supabaseBrowserClient.auth.verifyOtp({
        phone: normalizePhone(registerForm.phone),
        token: otpCode,
        type: "sms",
      })

      if (error || !data.session?.access_token) {
        setMessage({ type: "error", text: error?.message ?? "رمز التحقق غير صحيح أو منتهي" })
        return
      }

      setIsPhoneVerified(true)
      setVerifiedAccessToken(data.session.access_token)
      setMessage({ type: "success", text: "تم توثيق رقم الجوال بنجاح" })
    } catch {
      setMessage({ type: "error", text: "تعذر التحقق من الرمز" })
    } finally {
      setIsPending(false)
    }
  }

  async function handleLogout() {
    setIsPending(true)
    setMessage(null)

    try {
      await fetch("/api/auth/logout", { method: "POST" })
      await supabaseBrowserClient.auth.signOut()
      setUser(null)
      setOpen(false)
      router.push("/")
      router.refresh()
    } finally {
      setIsPending(false)
    }
  }

  async function handleChangePassword() {
    setIsPending(true)
    setPasswordMessage(null)

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordForm),
      })

      const result = (await response.json()) as { error?: string }

      if (!response.ok) {
        setPasswordMessage({ type: "error", text: result.error ?? "تعذر تغيير كلمة المرور" })
        return
      }

      setPasswordForm(defaultPasswordForm)
      setPasswordMessage({ type: "success", text: "تم تغيير كلمة المرور بنجاح" })
      setTimeout(() => {
        setPasswordDialogOpen(false)
        setPasswordMessage(null)
      }, 1200)
    } catch {
      setPasswordMessage({ type: "error", text: "تعذر الاتصال بالخادم" })
    } finally {
      setIsPending(false)
    }
  }

  const triggerButton = (
    <button
      className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-medium transition-all duration-300 sm:h-14 sm:w-14 ${
        isScrolled
          ? "text-foreground hover:bg-primary/8 hover:text-primary"
          : "text-white hover:bg-white/10"
      }`}
      aria-label={user ? `الحساب: ${user.name}` : "الحساب"}
      title={user ? user.name : "الحساب"}
      type="button"
    >
      <UserRound className="h-6 w-6 sm:h-7 sm:w-7" />
    </button>
  )

  if (user) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl border-border/70 p-2 text-right">
            <DropdownMenuLabel className="text-right">
              <div>
                <p className="font-bold text-foreground">{user.name}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-end rounded-xl px-3 py-2" onSelect={() => router.push("/profile")}>
              الملف الشخصي
            </DropdownMenuItem>
            <DropdownMenuItem className="justify-end rounded-xl px-3 py-2" onSelect={() => {
              setPasswordMessage(null)
              setPasswordForm(defaultPasswordForm)
              setPasswordDialogOpen(true)
            }}>
              تغيير كلمة المرور
            </DropdownMenuItem>
            {user.role === "admin" ? (
              <DropdownMenuItem className="justify-end rounded-xl px-3 py-2" onSelect={() => router.push("/dashboard")}>
                لوحة التحكم
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-end rounded-xl px-3 py-2" disabled={isPending} onSelect={() => void handleLogout()} variant="destructive">
              تسجيل الخروج
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-lg" showCloseButton={false}>
            <div className="bg-[linear-gradient(135deg,rgba(1,154,151,0.08),rgba(255,255,255,0.98))] p-6">
              <DialogHeader className="items-start text-left">
                <DialogTitle className="text-2xl">تغيير كلمة المرور</DialogTitle>
              </DialogHeader>
            </div>

            <div className="space-y-4 p-6 pt-2">
              {passwordMessage ? (
                <div
                  className={`rounded-2xl border px-4 py-3 text-sm ${
                    passwordMessage.type === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {passwordMessage.text}
                </div>
              ) : null}

              <div className="space-y-2 text-right">
                <label className="text-sm font-medium text-foreground">كلمة المرور الحالية</label>
                <Input
                  type="password"
                  className="text-right"
                  value={passwordForm.currentPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                />
              </div>

              <div className="space-y-2 text-right">
                <label className="text-sm font-medium text-foreground">كلمة المرور الجديدة</label>
                <Input
                  type="password"
                  className="text-right"
                  value={passwordForm.newPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                />
              </div>

              <div className="space-y-2 text-right">
                <label className="text-sm font-medium text-foreground">تأكيد كلمة المرور الجديدة</label>
                <Input
                  type="password"
                  className="text-right"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                />
              </div>

              <Button className="h-11 w-full rounded-2xl" disabled={isPending} onClick={() => void handleChangePassword()} type="button">
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                حفظ كلمة المرور الجديدة
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton}
      </DialogTrigger>

      <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-xl" showCloseButton={false}>
        <div className="bg-[linear-gradient(135deg,rgba(1,154,151,0.08),rgba(255,255,255,0.98))] p-6">
          <DialogHeader className="items-start text-left">
            <DialogTitle className="text-2xl">إنشاء حساب أو تسجيل الدخول</DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 pt-2">
          {message ? (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
                message.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {message.text}
            </div>
          ) : null}

          {!isConfigured ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              نافذة الحساب جاهزة، لكن يلزمك أولًا تعبئة بيانات Supabase في ملف البيئة ثم تشغيل ملف إعداد الجداول الموجود داخل مجلد supabase.
            </div>
          ) : null}

          {user ? (
            <div className="space-y-4">
              <div className="rounded-[1.75rem] border border-border/60 bg-muted/30 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{user.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{user.phone}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{user.email ?? "لا يوجد بريد إلكتروني"}</p>
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <ShieldCheck className="h-4 w-4" />
                    {user.role === "admin" ? "حساب إداري" : "حساب مستخدم"}
                  </span>
                </div>
              </div>

              <Button className="h-11 w-full rounded-2xl" onClick={handleLogout} disabled={isPending} variant="outline">
                {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                تسجيل الخروج
              </Button>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
              <TabsList className="grid h-auto w-full grid-cols-2 rounded-[1.5rem] border border-border/70 bg-slate-50 p-1.5">
                <TabsTrigger value="login" className="min-h-[64px] rounded-[1.1rem] border-0 bg-transparent px-4 py-3 text-foreground/70 shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
                  <LogIn className="h-4 w-4" />
                  <span>تسجيل الدخول</span>
                </TabsTrigger>
                <TabsTrigger value="register" className="min-h-[64px] rounded-[1.1rem] border-0 bg-transparent px-4 py-3 text-foreground/70 shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none">
                  <UserPlus className="h-4 w-4" />
                  <span>حساب جديد</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-0">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void submitForm("/api/auth/login", loginForm)
                  }}
                >
                  <div className="space-y-2 text-right">
                    <label className="text-sm font-medium text-foreground">
                      <span className="text-red-500">*</span> رقم الجوال
                    </label>
                    <Input
                      dir="ltr"
                      className="text-right"
                      placeholder="05xxxxxxxx"
                      value={loginForm.phone}
                      onChange={(event) => setLoginForm((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2 text-right">
                    <label className="text-sm font-medium text-foreground">
                      <span className="text-red-500">*</span> كلمة المرور
                    </label>
                    <Input
                      type="password"
                      className="text-right"
                      placeholder="********"
                      value={loginForm.password}
                      onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                    />
                  </div>

                  <Button className="h-11 w-full rounded-2xl" disabled={isPending} type="submit">
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    دخول
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-0">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!isPhoneVerified || !verifiedAccessToken) {
                      setMessage({ type: "error", text: "يجب توثيق رقم الجوال عبر رمز التحقق قبل إنشاء الحساب" })
                      return
                    }

                    void submitForm("/api/auth/register", {
                      ...registerForm,
                      supabaseAccessToken: verifiedAccessToken,
                    })
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 text-right md:col-span-2">
                      <label className="text-sm font-medium text-foreground">
                        <span className="text-red-500">*</span> الاسم
                      </label>
                      <Input
                        className="text-right"
                        placeholder="الاسم الكامل"
                        value={registerForm.name}
                        onChange={(event) => setRegisterForm((current) => ({ ...current, name: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 text-right">
                      <label className="text-sm font-medium text-foreground">
                        <span className="text-red-500">*</span> رقم الجوال
                      </label>
                      <div className="flex items-stretch gap-2">
                        <Button className="h-11 min-w-[82px] rounded-xl px-2.5 text-sm" disabled={isPending} onClick={sendOtpCode} type="button" variant="outline">
                          {isOtpSent ? "إعادة الإرسال" : "إرسال الرمز"}
                        </Button>
                        <Input
                          dir="ltr"
                          className="text-right"
                          placeholder="05xxxxxxxx"
                          value={registerForm.phone}
                          onChange={(event) => setRegisterForm((current) => ({ ...current, phone: event.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2 text-right">
                      <label className="text-sm font-medium text-foreground">البريد الإلكتروني</label>
                      <Input
                        dir="ltr"
                        className="text-right"
                        placeholder="example@email.com"
                        value={registerForm.email}
                        onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 text-right md:col-span-2">
                      <label className="text-sm font-medium text-foreground">
                        <span className="text-red-500">*</span> كلمة المرور
                      </label>
                      <Input
                        type="password"
                        className="text-right"
                        placeholder="6 أحرف أو أكثر"
                        value={registerForm.password}
                        onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-2 text-right md:col-span-2">
                      <label className="text-sm font-medium text-foreground">رمز التحقق بالجوال</label>
                      <div className="flex items-stretch gap-2">
                        <Button className="h-11 min-w-[82px] rounded-xl px-2.5 text-sm" disabled={isPending || !isOtpSent} onClick={verifyOtpCode} type="button" variant={isPhoneVerified ? "secondary" : "outline"}>
                          تحقق من الرمز
                        </Button>
                        <Input
                          dir="ltr"
                          className="text-right"
                          inputMode="numeric"
                          placeholder="123456"
                          value={otpCode}
                          onChange={(event) => setOtpCode(event.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Button className="h-11 w-full rounded-2xl" disabled={isPending} type="submit">
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    إنشاء الحساب
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}