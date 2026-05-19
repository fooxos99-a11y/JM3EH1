export const driveScopeValues = ["my_files", "all_files"] as const

export type DriveScope = (typeof driveScopeValues)[number]

export type DriveItem = {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
  sizeBytes: number | null
  webViewLink: string | null
  thumbnailLink: string | null
  iconLink: string | null
  modifiedTime: string | null
  parentIds: string[]
}

export type DriveBrowserData = {
  scope: DriveScope
  rootFolderId: string
  rootFolderName: string
  currentFolderId: string
  currentFolderName: string
  parentFolderId: string | null
  items: DriveItem[]
  searchQuery: string
}

export type DriveFolderOption = {
  id: string
  name: string
  path: string
}