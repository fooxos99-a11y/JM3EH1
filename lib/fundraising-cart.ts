import type { DonationItem } from "@/lib/site-content"

export const CART_STORAGE_KEY = "nm_cart_items"

export type FundraisingContentType = "donations" | "projects"

export type CartEntry = {
  key: string
  type: FundraisingContentType
  itemId: number
  title: string
  image: string
  amount: number
  addedAt: string
}

export function getDetailHref(contentType: FundraisingContentType, itemId: number) {
  return `/${contentType}/${itemId}`
}

export function readCartEntries() {
  if (typeof window === "undefined") {
    return [] as CartEntry[]
  }

  try {
    const rawValue = window.localStorage.getItem(CART_STORAGE_KEY)
    if (!rawValue) {
      return [] as CartEntry[]
    }

    const parsedValue = JSON.parse(rawValue)
    return Array.isArray(parsedValue) ? (parsedValue as CartEntry[]) : []
  } catch {
    return [] as CartEntry[]
  }
}

export function saveCartEntry(contentType: FundraisingContentType, item: DonationItem) {
  if (typeof window === "undefined") {
    return false
  }

  try {
    const key = `${contentType}-${item.id}`
    const nextEntry: CartEntry = {
      key,
      type: contentType,
      itemId: item.id,
      title: item.title,
      image: item.image,
      amount: item.defaultAmount || item.amount || item.shareUnitAmount || 0,
      addedAt: new Date().toISOString(),
    }

    const currentEntries = readCartEntries().filter((entry) => entry.key !== key)
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([nextEntry, ...currentEntries]))
    return true
  } catch {
    return false
  }
}

export function removeCartEntry(key: string) {
  if (typeof window === "undefined") {
    return [] as CartEntry[]
  }

  const nextEntries = readCartEntries().filter((entry) => entry.key !== key)
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextEntries))
  return nextEntries
}

export function clearCartEntries() {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.removeItem(CART_STORAGE_KEY)
}