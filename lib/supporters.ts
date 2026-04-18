export type SupporterSource = "registered" | "manual"

export type SupporterRecord = {
  id: string
  name: string
  phone: string
  email: string | null
  createdAt: string
  source: SupporterSource
  linkedUserId: string | null
  notes: string | null
}

export type SupportersDashboardData = {
  supporters: SupporterRecord[]
  contactOnly: Array<Pick<SupporterRecord, "id" | "name" | "phone" | "source">>
  stats: {
    total: number
    registered: number
    manual: number
    withEmail: number
  }
}
