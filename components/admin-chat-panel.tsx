"use client"

import { File, Image as ImageIcon, LoaderCircle, MessageCircleMore, Paperclip, SendHorizontal } from "lucide-react"
import { useEffect, useRef, useState, useTransition } from "react"

import type { AdminChatAttachment, AdminChatData, AdminChatMessage } from "@/lib/admin-chat"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

type AdminChatPanelProps = {
  iconOnly?: boolean
  triggerClassName?: string
  side?: "left" | "right"
}

function isImageAttachment(attachment: AdminChatAttachment) {
  return attachment.mimeType.startsWith("image/")
}

function MessageItem({ currentUserId, message }: { currentUserId: string; message: AdminChatMessage }) {
  const isOwn = message.senderUserId === currentUserId

  return (
    <div className={`flex ${isOwn ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[74%] rounded-[1.2rem] border px-3 py-2.5 text-right shadow-sm ${isOwn ? "border-primary/20 bg-primary/10" : "border-border/60 bg-white"}`}>
        <p className="text-[11px] font-bold text-primary">{message.senderName}</p>
        {message.messageText ? <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-6 text-foreground">{message.messageText}</p> : null}
        {message.attachments.length > 0 ? (
          <div className="mt-2.5 space-y-2.5">
            {message.attachments.map((attachment) => (
              <div key={`${message.id}-${attachment.url}`} className="overflow-hidden rounded-[1rem] border border-border/60 bg-white/80">
                {isImageAttachment(attachment) ? (
                  <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
                    <img src={attachment.url} alt={attachment.name} className="max-h-64 w-full object-contain bg-muted/10" />
                  </a>
                ) : (
                  <a href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-foreground hover:bg-muted/20">
                    <File className="h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1 text-right">
                      <p className="truncate font-medium">{attachment.name}</p>
                      <p className="text-xs text-muted-foreground">{attachment.mimeType}</p>
                    </div>
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function AdminChatPanel({ iconOnly = false, triggerClassName = "", side = "left" }: AdminChatPanelProps) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<AdminChatData | null>(null)
  const [messageText, setMessageText] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [attachments, setAttachments] = useState<AdminChatAttachment[]>([])
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sidePositionClass = side === "left" ? "left-0" : "right-0"
  const sideBorderClass = side === "left" ? "border-r" : "border-l"
  const closedTransformClass = side === "left" ? "-translate-x-[calc(100%+1.5rem)]" : "translate-x-[calc(100%+1.5rem)]"
  const panelWidthClass = "w-[min(380px,calc(100vw-1rem))] sm:w-[360px] lg:w-[400px]"

  async function loadChat() {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/chat", { cache: "no-store" })
      const payload = await response.json() as AdminChatData & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? "تعذر تحميل المحادثة")
      }

      setData(payload)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحميل المحادثة")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!open) {
      return
    }

    void loadChat()

    const interval = window.setInterval(() => {
      void loadChat()
    }, 8000)

    return () => window.clearInterval(interval)
  }, [open])

  useEffect(() => {
    if (!open || !data) {
      return
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [data, open])

  async function uploadSelectedFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return
    }

    setMessage(null)
    setIsUploading(true)

    try {
      const nextAttachments: AdminChatAttachment[] = []

      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        })

        const payload = await response.json() as { url?: string; error?: string }
        if (!response.ok || !payload.url) {
          throw new Error(payload.error ?? `تعذر رفع الملف ${file.name}`)
        }

        nextAttachments.push({
          name: file.name,
          url: payload.url,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        })
      }

      setAttachments((current) => [...current, ...nextAttachments])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر رفع الملفات")
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  function handleSend() {
    setMessage(null)
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageText,
            attachments,
          }),
        })

        const payload = await response.json() as AdminChatData & { error?: string }
        if (!response.ok) {
          throw new Error(payload.error ?? "تعذر إرسال الرسالة")
        }

        setData(payload)
        setMessageText("")
        setAttachments([])
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "تعذر إرسال الرسالة")
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? "icon" : "default"}
        className={`${iconOnly ? "rounded-full" : "rounded-2xl"} ${triggerClassName}`.trim()}
        aria-label={open ? "إغلاق المحادثة الإدارية" : "فتح المحادثة الإدارية"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MessageCircleMore className="h-4 w-4" />
        {iconOnly ? null : open ? "إغلاق المحادثة" : "المحادثة"}
      </Button>

      {open ? <div className="fixed inset-0 z-30 bg-transparent" onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <aside
        className={`pointer-events-none fixed bottom-4 top-4 z-40 ${sidePositionClass} ${panelWidthClass} max-w-[calc(100vw-1rem)] transition-transform duration-300 ease-out ${open ? "translate-x-0" : closedTransformClass}`}
        aria-hidden={!open}
      >
        <div className={`pointer-events-auto flex h-full flex-col overflow-hidden rounded-[2rem] border-white/80 bg-white/95 text-right shadow-[0_25px_80px_rgba(15,23,42,0.18)] backdrop-blur-sm ${side === "left" ? "ml-4" : "mr-4"}`} onClick={(event) => event.stopPropagation()}>
          <ScrollArea className="flex-1 bg-[linear-gradient(180deg,#f9fbfb,#f2f7f7)] px-4 py-4">
            <div className="space-y-4">
              {!data && isLoading ? (
                <div className="flex justify-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-primary" /></div>
              ) : data?.messages.length ? (
                data.messages.map((chatMessage) => <MessageItem key={chatMessage.id} currentUserId={data.currentUserId} message={chatMessage} />)
              ) : (
                <div className="rounded-[1.5rem] border border-dashed border-border/70 bg-white/80 px-6 py-12 text-center text-sm text-muted-foreground">
                  لا توجد رسائل بعد. ابدأ أول محادثة مع الإداريين من هنا.
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <div className="border-t border-border/60 bg-white px-5 py-5">
            {message ? <p className="mb-3 text-sm text-red-600">{message}</p> : null}

            {attachments.length > 0 ? (
              <div className="mb-4 flex flex-wrap justify-end gap-2">
                {attachments.map((attachment, index) => (
                  <div key={`${attachment.url}-${index}`} className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/10 px-3 py-1.5 text-xs text-foreground">
                    {isImageAttachment(attachment) ? <ImageIcon className="h-3.5 w-3.5" /> : <File className="h-3.5 w-3.5" />}
                    <span>{attachment.name}</span>
                    <button type="button" className="text-muted-foreground hover:text-red-600" onClick={() => setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))}>حذف</button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3">
              <Textarea rows={4} value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="اكتب رسالة للإداريين أو أرسل ملفًا وصورة..." className="min-h-[110px] rounded-[1.5rem] border-border/70 bg-muted/10 text-right" />

              <div className="flex items-center justify-between gap-3">
                <Button type="button" className="rounded-2xl" onClick={handleSend} disabled={isPending || isUploading || (!messageText.trim() && attachments.length === 0)}>
                  {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  إرسال
                </Button>

                <div className="flex items-center gap-2">
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => void uploadSelectedFiles(event.target.files)} />
                  <Button type="button" variant="outline" className="rounded-2xl" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isPending}>
                    {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    إرفاق
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
