"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { DonationItem } from "@/lib/site-content"

function clampOpenAmount(item: DonationItem, amount: number) {
  if (item.donationMethod === "open_unrestricted") {
    return Math.max(0, amount)
  }

  const minAmount = Math.max(0, item.minAmount)
  const maxAmount = item.maxAmount ?? amount
  return Math.min(Math.max(amount, minAmount), Math.max(minAmount, maxAmount))
}

function getInitialAmount(item: DonationItem) {
  const firstLabel = item.labels[0]

  if (item.donationMethod === "shares") {
    return String(firstLabel?.amount ?? item.amount ?? item.shareUnitAmount)
  }

  return String(item.defaultAmount || firstLabel?.amount || item.minAmount || item.amount || "")
}

type FundraisingPaymentDialogProps = {
  item: DonationItem
  dialogDescription: string
  triggerLabel?: string
  triggerClassName?: string
  fullWidthTrigger?: boolean
}

export function FundraisingPaymentDialog({
  item,
  dialogDescription,
  triggerLabel,
  triggerClassName = "",
  fullWidthTrigger = false,
}: FundraisingPaymentDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(item.labels[0]?.id ?? null)
  const [donationAmount, setDonationAmount] = useState(getInitialAmount(item))

  const selectedLabel = useMemo(
    () => item.labels.find((label) => label.id === selectedLabelId) ?? item.labels[0] ?? null,
    [item.labels, selectedLabelId],
  )

  const numericAmount = item.donationMethod === "shares"
    ? ((selectedLabel?.amount ?? Number(donationAmount)) || 0)
    : clampOpenAmount(item, Number(donationAmount) || 0)

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (nextOpen) {
      const defaultLabel = item.labels[0] ?? null
      setSelectedLabelId(defaultLabel?.id ?? null)
      setDonationAmount(getInitialAmount(item))
    }
  }

  function handleLabelChange(labelId: number) {
    const label = item.labels.find((entry) => entry.id === labelId)
    setSelectedLabelId(labelId)

    if (!label) {
      return
    }

    if (item.donationMethod === "shares") {
      setDonationAmount(String(label.amount))
      return
    }

    setDonationAmount(String(label.amount || item.defaultAmount || item.minAmount || 0))
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button className={`${fullWidthTrigger ? "w-full" : ""} ${triggerClassName}`.trim()} onClick={() => setOpen(true)}>
        {triggerLabel ?? item.buttonLabel}
      </Button>

      <DialogContent className="overflow-hidden rounded-[2rem] border-border/60 p-0 sm:max-w-2xl" showCloseButton={false}>
        <div className="bg-[linear-gradient(135deg,#ecfbfa,#ffffff_55%,#f4fbfb)] p-6">
          <DialogHeader className="items-start text-right">
            <DialogTitle className="text-2xl text-foreground">{item.title}</DialogTitle>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{dialogDescription}</p>
          </DialogHeader>
        </div>

        <div className="space-y-5 bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfb_100%)] p-6 pt-4">
          {item.labels.length > 0 ? (
            <div className="space-y-3 text-right">
              <p className="text-sm font-semibold text-foreground">خيارات المساهمة</p>
              <div className="flex flex-wrap justify-end gap-2">
                {item.labels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    onClick={() => handleLabelChange(label.id)}
                    className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-all ${selectedLabelId === label.id ? "border-primary bg-primary text-white" : "border-border/60 bg-white hover:border-primary/50 hover:text-primary"}`}
                  >
                    {label.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {item.donationMethod !== "shares" ? (
            <div className="space-y-2 text-right">
              <p className="text-sm font-semibold text-foreground">قيمة التبرع</p>
              <Input
                type="number"
                min={item.donationMethod === "open_unrestricted" ? 0 : item.minAmount}
                max={item.maxAmount ?? undefined}
                value={donationAmount}
                onChange={(event) => setDonationAmount(event.target.value)}
                className="text-right"
              />
            </div>
          ) : null}

          <div className="mx-auto max-w-xl rounded-[1.75rem] border border-primary/10 bg-[linear-gradient(180deg,#0f766e_0%,#0b4f4c_100%)] p-6 text-right shadow-sm">
            <p className="text-sm text-white/75">{item.title}</p>
            <p className="mt-4 text-4xl font-bold text-white">{numericAmount} ريال</p>
            <Button className="mt-6 h-12 w-full rounded-2xl border-0 bg-white text-primary hover:bg-[#f4fffe]" onClick={() => setOpen(false)}>
              ادفع الآن
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}