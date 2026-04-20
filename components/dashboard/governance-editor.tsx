"use client"

import { Plus, Save, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import { FileUploadField } from "@/components/dashboard/file-upload-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { GovernanceContent } from "@/lib/site-content"
import { getGovernanceEditorConfig, type GovernanceSectionKey } from "@/lib/governance"

type GovernanceEditorProps = {
  section: GovernanceSectionKey
  pageTitle: string
  initialContent: GovernanceContent
}

export function GovernanceEditor({ section, pageTitle, initialContent }: GovernanceEditorProps) {
  const [content, setContent] = useState(initialContent)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const config = getGovernanceEditorConfig(section)

  function updateItem(index: number, field: keyof GovernanceContent["items"][number], value: string) {
    setContent((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)),
    }))
  }

  function addItem() {
    setContent((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          id: Math.max(0, ...current.items.map((item) => item.id)) + 1,
          title: config.defaultItem.title,
          description: config.defaultItem.description,
          date: config.defaultItem.date,
          fileUrl: "",
        },
      ],
    }))
  }

  function removeItem(id: number) {
    setContent((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }))
  }

  function handleSave() {
    setMessage(null)
    startTransition(async () => {
      const response = await fetch(`/api/admin/content/${section}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      })

      setMessage(response.ok ? `تم حفظ ${pageTitle}` : `تعذر حفظ ${pageTitle}`)
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex justify-end">
        <Button type="button" variant="outline" className="rounded-xl" onClick={addItem}>
          <Plus className="h-4 w-4" />
          {config.addLabel}
        </Button>
      </div>

      <div className="space-y-4">
        {content.items.map((item, index) => (
          <div key={item.id} className="rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{`${config.itemLabel} ${index + 1}`}</h2>
              <Button type="button" variant="ghost" className="rounded-xl text-red-600 hover:text-red-700" onClick={() => removeItem(item.id)}>
                <Trash2 className="h-4 w-4" />
                {`حذف ${config.itemLabel}`}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 text-right">
                <Label htmlFor={`${section}-item-title-${item.id}`}>{config.itemTitleLabel}</Label>
                <Input id={`${section}-item-title-${item.id}`} value={item.title} onChange={(event) => updateItem(index, "title", event.target.value)} placeholder={config.itemTitlePlaceholder} />
              </div>
              {config.showItemDate !== false ? (
                <div className="space-y-2 text-right">
                  <Label htmlFor={`${section}-item-date-${item.id}`}>{config.itemDateLabel}</Label>
                  <Input id={`${section}-item-date-${item.id}`} value={item.date} onChange={(event) => updateItem(index, "date", event.target.value)} placeholder={config.itemDatePlaceholder} />
                </div>
              ) : null}
              {config.showItemDescription !== false ? (
                <div className={`space-y-2 text-right ${config.showItemDate !== false ? "md:col-span-2" : "md:col-span-1"}`}>
                  <Label htmlFor={`${section}-item-description-${item.id}`}>{config.itemDescriptionLabel}</Label>
                  <Textarea id={`${section}-item-description-${item.id}`} rows={3} value={item.description} onChange={(event) => updateItem(index, "description", event.target.value)} placeholder={config.itemDescriptionPlaceholder} />
                </div>
              ) : null}
              {config.showItemFile !== false ? (
                <>
                  <div className="md:col-span-2">
                    <FileUploadField
                      label={config.fileLabel}
                      value={item.fileUrl}
                      onChange={(value) => updateItem(index, "fileUrl", value)}
                      accept="*/*"
                      previewType="file"
                      emptyLabel={config.fileEmptyLabel}
                      removeLabel={config.fileRemoveLabel}
                      uploadLabel={config.fileUploadLabel}
                      uploadingLabel={config.fileUploadingLabel}
                    />
                  </div>
                  <div className="space-y-2 text-right md:col-span-2">
                    <Label htmlFor={`${section}-item-file-${item.id}`}>{config.linkLabel}</Label>
                    <Input id={`${section}-item-file-${item.id}`} dir="ltr" value={item.fileUrl} onChange={(event) => updateItem(index, "fileUrl", event.target.value)} placeholder={config.linkPlaceholder} />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-white/80 bg-white/95 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">حفظ التعديلات</p>
          <p className="text-sm text-muted-foreground">سيتم تحديث صفحة الحوكمة المرتبطة بهذا القسم بعد الحفظ.</p>
        </div>
        <div className="flex items-center gap-3">
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button onClick={handleSave} disabled={isPending} className="min-w-32 rounded-xl">
            <Save className="h-4 w-4" />
            {isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
          </Button>
        </div>
      </div>
    </section>
  )
}