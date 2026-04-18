"use client"

import { File, Image as ImageIcon, LoaderCircle, MessageCircleMore, Paperclip, RefreshCcw, SendHorizontal } from "lucide-react"
import { useEffect, useRef, useState, useTransition } from "react"

import type { AdminChatAttachment, AdminChatData, AdminChatMessage } from "@/lib/admin-chat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"

type AdminChatPanelProps = {
  iconOnly?: boolean
  triggerClassName?: string
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function isImageAttachment(attachment: AdminChatAttachment) {
  return attachment.mimeType.startsWith("image/")
}

function MessageItem({ currentUserId, message }: { currentUserId: string; message: AdminChatMessage }) {
  const isOwn = message.senderUserId === currentUserId

  return (
    <div className={`flex ${isOwn ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[82%] rounded-[1.5rem] border px-4 py-3 text-right shadow-sm ${isOwn ? "border-primary/20 bg-primary/10" : "border-border/60 bg-white"}`}>
        <p className="text-xs font-bold text-primary">{message.senderName}</p>
        {message.messageText ? <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-foreground">{message.messageText}</p> : null}
        {message.attachments.length > 0 ? (
          <div className="mt-3 space-y-3">
            {message.attachments.map((attachment) => (
              <div key={`${message.id}-${attachment.url}`} className="overflow-hidden rounded-[1rem] border border-border/60 bg-white/80">
                {isImageAttachment(attachment) ? (
                  <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
                    <img src={attachment.url} alt={attachment.name} className="max-h-64 w-full object-contain bg-muted/10" />
                  </a>
                ) : (
                  <a href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-foreground hover:bg-muted/20">
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
        <p className="mt-2 text-[11px] text-muted-foreground">{formatTime(message.createdAt)}</p>
      </div>
    </div>
  )
}

export function AdminChatPanel({ iconOnly = false, triggerClassName = "" }: AdminChatPanelProps) {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size={iconOnly ? "icon" : "default"}
          className={`${iconOnly ? "rounded-full" : "rounded-2xl"} ${triggerClassName}`.trim()}
          aria-label="المحادثة الإدارية"
        >
          <MessageCircleMore className="h-4 w-4" />
          {iconOnly ? null : "المحادثة"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl rounded-[2rem] border-white/80 bg-white/95 p-0 text-right shadow-[0_25px_80px_rgba(15,23,42,0.18)] sm:max-w-4xl" showCloseButton={false}>
        <div className="flex h-[80vh] min-h-[620px] flex-col overflow-hidden">
          <DialogHeader className="border-b border-border/60 px-6 py-5 text-right">
            <div className="flex items-center justify-between gap-3">
              <Button type="button" variant="outline" size="icon" className="rounded-2xl" onClick={() => void loadChat()} disabled={isLoading || isPending}>
                {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              </Button>
              <div>
                <DialogTitle className="text-right text-xl">المحادثة الإدارية العامة</DialogTitle>
                <DialogDescription className="mt-1 text-right">محادثة مشتركة بين جميع الإداريين، مع إرسال نصوص وصور وملفات وظهور اسم الموظف فوق رسالته.</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 bg-[linear-gradient(180deg,#f9fbfb,#f2f7f7)] px-6 py-5">
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

          <div className="border-t border-border/60 bg-white px-6 py-5">
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

            <div className="grid gap-3 md:grid-cols-[auto,1fr,auto]">
              <div className="flex items-end gap-2">
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => void uploadSelectedFiles(event.target.files)} />
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isPending}>
                  {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                  إرفاق
                </Button>
              </div>
              <Textarea rows={4} value={messageText} onChange={(event) => setMessageText(event.target.value)} placeholder="اكتب رسالة للإداريين أو أرسل ملفًا وصورة..." className="min-h-[110px] rounded-[1.5rem] border-border/70 bg-muted/10 text-right" />
              <div className="flex items-end justify-end">
                <Button type="button" className="rounded-2xl" onClick={handleSend} disabled={isPending || isUploading || (!messageText.trim() && attachments.length === 0)}>
                  {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  إرسال
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
