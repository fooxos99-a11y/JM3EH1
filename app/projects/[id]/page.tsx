import { FundraisingDetailPage } from "@/components/fundraising-detail-page"

export default async function ProjectDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return <FundraisingDetailPage contentType="projects" itemId={Number(id)} />
}