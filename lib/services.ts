export type ServiceAssetKind = "stamp" | "signature"

export type ServiceAsset = {
  id: string
  name: string
  kind: ServiceAssetKind
  imageUrl: string
  createdAt: string
  updatedAt: string
}

export type ServiceDocumentTemplate = {
  id: string
  title: string
  description: string
  contentHtml: string
  createdAt: string
  updatedAt: string
}

export type ServicesDashboardData = {
  assets: ServiceAsset[]
  templates: ServiceDocumentTemplate[]
}
