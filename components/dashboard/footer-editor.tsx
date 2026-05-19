"use client"

import { Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { FooterContent } from "@/lib/site-content"

export function FooterEditor({ initialContent }: { initialContent: FooterContent }) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateQuickLink(index: number, field: "label" | "href", value: string) {
    setContent((current) => ({ ...current, quickLinks: current.quickLinks.map((link, linkIndex) => (linkIndex === index ? { ...link, [field]: value } : link)) }))
  }

  function updateSocialLink(index: number, field: "label" | "href" | "icon", value: string) {
    setContent((current) => ({ ...current, socialLinks: current.socialLinks.map((link, linkIndex) => (linkIndex === index ? { ...link, [field]: value } : link)) }))
  }

  function addQuickLink() {
    setContent((current) => ({ ...current, quickLinks: [...current.quickLinks, { id: Math.max(0, ...current.quickLinks.map((link) => link.id)) + 1, label: "رابط جديد", href: "#" }] }))
  }

  function removeQuickLink(id: number) {
    setContent((current) => ({ ...current, quickLinks: current.quickLinks.filter((link) => link.id !== id) }))
  }

  function addSocialLink() {
    setContent((current) => ({ ...current, socialLinks: [...current.socialLinks, { id: Math.max(0, ...current.socialLinks.map((link) => link.id)) + 1, label: "منصة", href: "#", icon: "@" }] }))
  }

  function removeSocialLink(id: number) {
    setContent((current) => ({ ...current, socialLinks: current.socialLinks.filter((link) => link.id !== id) }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch("/api/admin/content/footer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(content) })
      setMessage(response.ok ? "تم حفظ بيانات الفوتر" : "تعذر حفظ بيانات الفوتر")
    })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2 text-right"><Label htmlFor="footer-organization-name">اسم الجهة</Label><Input id="footer-organization-name" value={content.organizationName} onChange={(event) => setContent((current) => ({ ...current, organizationName: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="footer-city">المدينة</Label><Input id="footer-city" value={content.city} onChange={(event) => setContent((current) => ({ ...current, city: event.target.value }))} /></div><div className="space-y-2 text-right md:col-span-2"><Label htmlFor="footer-about">الوصف</Label><Textarea id="footer-about" value={content.about} onChange={(event) => setContent((current) => ({ ...current, about: event.target.value }))} rows={4} /></div><div className="space-y-2 text-right"><Label htmlFor="footer-address">العنوان</Label><Input id="footer-address" value={content.address} onChange={(event) => setContent((current) => ({ ...current, address: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="footer-phone">الهاتف</Label><Input id="footer-phone" dir="ltr" value={content.phone} onChange={(event) => setContent((current) => ({ ...current, phone: event.target.value }))} /></div><div className="space-y-2 text-right md:col-span-2"><Label htmlFor="footer-email">البريد</Label><Input id="footer-email" dir="ltr" value={content.email} onChange={(event) => setContent((current) => ({ ...current, email: event.target.value }))} /></div></div></div>
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="mb-4 flex items-center justify-between"><Button type="button" variant="outline" className="rounded-xl" onClick={addQuickLink}><Plus className="h-4 w-4" />إضافة رابط</Button><h2 className="text-lg font-bold text-foreground">الروابط السريعة</h2></div><div className="space-y-4">{content.quickLinks.map((link, index) => (<div key={link.id} className="grid gap-4 md:grid-cols-2"><div className="space-y-2 text-right"><Label htmlFor={`footer-quick-link-label-${link.id}`}>النص</Label><Input id={`footer-quick-link-label-${link.id}`} value={link.label} onChange={(event) => updateQuickLink(index, "label", event.target.value)} /></div><div className="space-y-2 text-right"><Label htmlFor={`footer-quick-link-href-${link.id}`}>الرابط</Label><div className="flex gap-2"><Input id={`footer-quick-link-href-${link.id}`} dir="ltr" value={link.href} onChange={(event) => updateQuickLink(index, "href", event.target.value)} /><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeQuickLink(link.id)}><Trash2 className="h-4 w-4" /></Button></div></div></div>))}</div></div>
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="mb-4 flex items-center justify-between"><Button type="button" variant="outline" className="rounded-xl" onClick={addSocialLink}><Plus className="h-4 w-4" />إضافة منصة</Button><h2 className="text-lg font-bold text-foreground">روابط التواصل الاجتماعي</h2></div><div className="space-y-4">{content.socialLinks.map((link, index) => (<div key={link.id} className="grid gap-4 md:grid-cols-3"><div className="space-y-2 text-right"><Label htmlFor={`footer-social-label-${link.id}`}>الاسم</Label><Input id={`footer-social-label-${link.id}`} value={link.label} onChange={(event) => updateSocialLink(index, "label", event.target.value)} /></div><div className="space-y-2 text-right"><Label htmlFor={`footer-social-icon-${link.id}`}>الأيقونة المختصرة</Label><Input id={`footer-social-icon-${link.id}`} value={link.icon} onChange={(event) => updateSocialLink(index, "icon", event.target.value)} /></div><div className="space-y-2 text-right"><Label htmlFor={`footer-social-href-${link.id}`}>الرابط</Label><div className="flex gap-2"><Input id={`footer-social-href-${link.id}`} dir="ltr" value={link.href} onChange={(event) => updateSocialLink(index, "href", event.target.value)} /><Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeSocialLink(link.id)}><Trash2 className="h-4 w-4" /></Button></div></div></div>))}</div></div>
      <div className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2 text-right"><Label htmlFor="footer-donate-label">زر التبرع داخل الفوتر</Label><Input id="footer-donate-label" value={content.donateLabel} onChange={(event) => setContent((current) => ({ ...current, donateLabel: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="footer-fixed-donate-label">الزر الثابت</Label><Input id="footer-fixed-donate-label" value={content.fixedDonateLabel} onChange={(event) => setContent((current) => ({ ...current, fixedDonateLabel: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="footer-privacy-label">سياسة الخصوصية</Label><Input id="footer-privacy-label" value={content.privacyLabel} onChange={(event) => setContent((current) => ({ ...current, privacyLabel: event.target.value }))} /></div><div className="space-y-2 text-right"><Label htmlFor="footer-terms-label">الشروط والأحكام</Label><Input id="footer-terms-label" value={content.termsLabel} onChange={(event) => setContent((current) => ({ ...current, termsLabel: event.target.value }))} /></div><div className="space-y-2 text-right md:col-span-2"><Label htmlFor="footer-copyright">حقوق النشر</Label><Input id="footer-copyright" value={content.copyright} onChange={(event) => setContent((current) => ({ ...current, copyright: event.target.value }))} /></div></div></div>
      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"><div className="text-right"><p className="text-sm font-bold text-foreground">حفظ التعديلات</p><p className="text-sm text-muted-foreground">سيظهر أي تعديل في الفوتر مباشرة بعد الحفظ.</p></div><div className="flex items-center gap-3">{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}<Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">{isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button></div></div>
    </section>
  )
}
