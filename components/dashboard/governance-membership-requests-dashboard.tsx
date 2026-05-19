"use client"

import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type MembershipRequestRecord = {
  id: string
  fullName: string
  gender: string
  phone: string
  email: string
  nationalId: string
  educationLevel: string
  jobTitle: string
  employer: string
  createdAt: string
}

export function GovernanceMembershipRequestsDashboard() {
  const [rows, setRows] = useState<MembershipRequestRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    async function loadRows() {
      const response = await fetch("/api/admin/governance-membership-requests", { cache: "no-store" })
      const payload = (await response.json()) as { rows?: MembershipRequestRecord[] }

      if (!ignore) {
        setRows(payload.rows ?? [])
        setIsLoading(false)
      }
    }

    void loadRows()

    return () => {
      ignore = true
    }
  }, [])

  return (
    <Card className="rounded-[1.75rem] border-white/80 bg-white/95">
      <CardHeader className="text-right">
        <CardTitle>طلبات العضويات</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-10 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الجنس</TableHead>
                <TableHead className="text-right">الجوال</TableHead>
                <TableHead className="text-right">البريد</TableHead>
                <TableHead className="text-right">الهوية</TableHead>
                <TableHead className="text-right">المؤهل</TableHead>
                <TableHead className="text-right">المسمى</TableHead>
                <TableHead className="text-right">جهة العمل</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-right">{row.fullName}</TableCell>
                  <TableCell className="text-right">{row.gender === "female" ? "أنثى" : "ذكر"}</TableCell>
                  <TableCell className="text-right">{row.phone}</TableCell>
                  <TableCell className="text-right">{row.email || "-"}</TableCell>
                  <TableCell className="text-right">{row.nationalId}</TableCell>
                  <TableCell className="text-right">{row.educationLevel}</TableCell>
                  <TableCell className="text-right">{row.jobTitle}</TableCell>
                  <TableCell className="text-right">{row.employer}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}