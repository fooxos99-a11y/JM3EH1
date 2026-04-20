"use client"

import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const initialForm = {
  fullName: "",
  gender: "male",
  phone: "",
  email: "",
  nationalId: "",
  educationLevel: "",
  jobTitle: "",
  employer: "",
}

export function GovernanceMembershipForm() {
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setMessage(null)
    setError(null)

    startTransition(async () => {
      const response = await fetch("/api/governance/membership-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(payload.error ?? "تعذر إرسال طلب العضوية")
        return
      }

      setForm(initialForm)
      setMessage("تم إرسال طلب العضوية بنجاح")
    })
  }

  return (
    <Card className="mx-auto max-w-4xl rounded-[2rem] border-white/80 bg-white/95 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <CardContent className="grid gap-4 p-6 md:grid-cols-2">
        <div className="space-y-2 text-right">
          <Label htmlFor="membership-full-name">الاسم</Label>
          <Input id="membership-full-name" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
        </div>
        <div className="space-y-2 text-right">
          <Label>الجنس</Label>
          <Select value={form.gender} onValueChange={(value) => setForm((current) => ({ ...current, gender: value }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">ذكر</SelectItem>
              <SelectItem value="female">أنثى</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 text-right">
          <Label htmlFor="membership-phone">رقم الجوال</Label>
          <Input id="membership-phone" dir="ltr" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
        </div>
        <div className="space-y-2 text-right">
          <Label htmlFor="membership-email">البريد الإلكتروني</Label>
          <Input id="membership-email" dir="ltr" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
        </div>
        <div className="space-y-2 text-right">
          <Label htmlFor="membership-national-id">الهوية الوطنية</Label>
          <Input id="membership-national-id" value={form.nationalId} onChange={(event) => setForm((current) => ({ ...current, nationalId: event.target.value }))} />
        </div>
        <div className="space-y-2 text-right">
          <Label htmlFor="membership-education">المؤهل العلمي</Label>
          <Input id="membership-education" value={form.educationLevel} onChange={(event) => setForm((current) => ({ ...current, educationLevel: event.target.value }))} />
        </div>
        <div className="space-y-2 text-right">
          <Label htmlFor="membership-job-title">المسمى الوظيفي</Label>
          <Input id="membership-job-title" value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} />
        </div>
        <div className="space-y-2 text-right">
          <Label htmlFor="membership-employer">جهة العمل</Label>
          <Input id="membership-employer" value={form.employer} onChange={(event) => setForm((current) => ({ ...current, employer: event.target.value }))} />
        </div>

        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-right">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          </div>
          <Button type="button" className="rounded-2xl" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "جارٍ الإرسال..." : "إرسال"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}