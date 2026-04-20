import { FundraisingDetailPage } from "@/components/fundraising-detail-page"

export default async function DonationDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return <FundraisingDetailPage contentType="donations" itemId={Number(id)} />
}