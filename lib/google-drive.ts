import "server-only"

import { Readable } from "node:stream"

import type { drive_v3 } from "googleapis"
import { google } from "googleapis"

import type { AuthUser } from "@/lib/auth"
import type { DriveBrowserData, DriveFolderOption, DriveItem, DriveScope } from "@/lib/drive"
import { getServerEnv, hasGoogleDriveEnv } from "@/lib/env"
import { createGoogleOAuthClient, getGoogleDriveConnection, GOOGLE_DRIVE_CONNECT_REQUIRED, upsertGoogleDriveConnection } from "@/lib/google-oauth"
import { createSupabaseAdminClient } from "@/lib/supabase/server"

const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder"
const VIRTUAL_ALL_FILES_ROOT_ID = "__all_files__"
const SYSTEM_FOLDER_NAMES = {
  allFiles: "All Files",
  users: "Users",
  tasks: "Tasks",
} as const

type UserDriveRootRow = {
  user_id: string
  folder_id: string
  folder_name: string
}

type UserDrivePreferenceRow = {
  user_id: string
  default_folder_id: string | null
  default_folder_name: string | null
}

type SystemFolders = {
  rootFolderId: string
  allFilesFolderId: string
  usersFolderId: string
  tasksFolderId: string
}

type DriveAuthMode = "oauth" | "service_account"

type DriveAccess = {
  drive: drive_v3.Drive
  mode: DriveAuthMode
}

type ScopeRoot = {
  rootFolderId: string
  rootFolderName: string
  virtualAllFiles?: boolean
}

let cachedSystemFolders: Promise<SystemFolders> | null = null

function ensureGoogleDriveConfigured() {
  if (!hasGoogleDriveEnv()) {
    throw new Error("لم يتم تفعيل Google Drive في متغيرات البيئة")
  }
}

function sanitizeDriveName(value: string) {
  return value.trim().replace(/[\\/]/g, "-").replace(/\s+/g, " ").slice(0, 120) || "Untitled"
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")
}

function mapDriveFile(file: drive_v3.Schema$File): DriveItem {
  return {
    id: file.id ?? "",
    name: file.name ?? "بدون اسم",
    mimeType: file.mimeType ?? "application/octet-stream",
    isFolder: file.mimeType === DRIVE_FOLDER_MIME,
    sizeBytes: file.size ? Number(file.size) : null,
    webViewLink: file.webViewLink ?? null,
    thumbnailLink: file.thumbnailLink ?? null,
    iconLink: file.iconLink ?? null,
    modifiedTime: file.modifiedTime ?? null,
    parentIds: file.parents ?? [],
  }
}

function getServiceAccountDrive() {
  ensureGoogleDriveConfigured()

  const env = getServerEnv()
  const auth = new google.auth.JWT({
    email: env.GOOGLE_DRIVE_CLIENT_EMAIL,
    key: env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  })

  return google.drive({ version: "v3", auth })
}

async function getDriveAccess(user: AuthUser): Promise<DriveAccess> {
  const connection = await getGoogleDriveConnection(user.id)

  if (connection) {
    const auth = createGoogleOAuthClient()
    auth.setCredentials({
      access_token: connection.access_token ?? undefined,
      refresh_token: connection.refresh_token,
      expiry_date: connection.expires_at ? new Date(connection.expires_at).getTime() : undefined,
    })

    auth.on("tokens", (tokens) => {
      void upsertGoogleDriveConnection({
        user_id: user.id,
        google_email: connection.google_email,
        access_token: tokens.access_token ?? connection.access_token,
        refresh_token: tokens.refresh_token ?? connection.refresh_token,
        scope: tokens.scope ?? connection.scope,
        expires_at:
          typeof tokens.expiry_date === "number"
            ? new Date(tokens.expiry_date).toISOString()
            : connection.expires_at,
      })
    })

    return {
      drive: google.drive({ version: "v3", auth }),
      mode: "oauth",
    }
  }

  if (getServerEnv().GOOGLE_OAUTH_CLIENT_ID) {
    throw new Error(GOOGLE_DRIVE_CONNECT_REQUIRED)
  }

  if (hasGoogleDriveEnv()) {
    return {
      drive: getServiceAccountDrive(),
      mode: "service_account",
    }
  }

  throw new Error(GOOGLE_DRIVE_CONNECT_REQUIRED)
}

function withAllDriveSupport<T extends Record<string, unknown>>(payload: T): T & { supportsAllDrives: true; includeItemsFromAllDrives: true } {
  return {
    ...payload,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  }
}

async function findFolderByName(drive: drive_v3.Drive, parentId: string, name: string) {
  const response = await drive.files.list(
    withAllDriveSupport({
      q: `'${escapeDriveQueryValue(parentId)}' in parents and mimeType = '${DRIVE_FOLDER_MIME}' and trashed = false and name = '${escapeDriveQueryValue(name)}'`,
      fields: "files(id,name)",
      pageSize: 1,
      orderBy: "createdTime desc",
    }),
  )

  return response.data.files?.[0] ?? null
}

async function ensureFolderByName(drive: drive_v3.Drive, parentId: string, name: string) {
  const existing = await findFolderByName(drive, parentId, name)
  if (existing?.id && existing.name) {
    return { id: existing.id, name: existing.name }
  }

  const response = await drive.files.create(
    withAllDriveSupport({
      requestBody: {
        name,
        mimeType: DRIVE_FOLDER_MIME,
        parents: [parentId],
      },
      fields: "id,name",
    }),
  )

  return {
    id: response.data.id ?? "",
    name: response.data.name ?? name,
  }
}

async function getDriveFile(drive: drive_v3.Drive, fileId: string) {
  const response = await drive.files.get(
    withAllDriveSupport({
      fileId,
      fields: "id,name,parents,webViewLink,thumbnailLink,iconLink,mimeType,size,modifiedTime",
    }),
  )

  return response.data
}

async function resolveSystemFolders() {
  if (cachedSystemFolders) {
    return cachedSystemFolders
  }

  cachedSystemFolders = (async () => {
    const drive = getServiceAccountDrive()
    const env = getServerEnv()
    const rootFolderId = env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "root"

    const allFilesFolderId = env.GOOGLE_DRIVE_ALL_FILES_FOLDER_ID || (await ensureFolderByName(drive, rootFolderId, SYSTEM_FOLDER_NAMES.allFiles)).id
    const usersFolderId = env.GOOGLE_DRIVE_USERS_FOLDER_ID || (await ensureFolderByName(drive, rootFolderId, SYSTEM_FOLDER_NAMES.users)).id
    const tasksFolderId = env.GOOGLE_DRIVE_TASKS_FOLDER_ID || (await ensureFolderByName(drive, rootFolderId, SYSTEM_FOLDER_NAMES.tasks)).id

    return {
      rootFolderId,
      allFilesFolderId,
      usersFolderId,
      tasksFolderId,
    }
  })()

  return cachedSystemFolders
}

async function listDirectChildren(drive: drive_v3.Drive, parentId: string, foldersOnly = false) {
  const queryParts = [`'${escapeDriveQueryValue(parentId)}' in parents`, "trashed = false"]

  if (foldersOnly) {
    queryParts.push(`mimeType = '${DRIVE_FOLDER_MIME}'`)
  }

  const response = await drive.files.list(
    withAllDriveSupport({
      q: queryParts.join(" and "),
      fields: "files(id,name,mimeType,size,webViewLink,thumbnailLink,iconLink,modifiedTime,parents)",
      orderBy: "folder,name",
      pageSize: 200,
    }),
  )

  return (response.data.files ?? []).map(mapDriveFile)
}

async function listAllAccessibleItems(drive: drive_v3.Drive, ownedOnly = false) {
  const queryParts = ["trashed = false"]

  if (ownedOnly) {
    queryParts.push("'me' in owners")
  }

  const response = await drive.files.list(
    withAllDriveSupport({
      q: queryParts.join(" and "),
      fields: "files(id,name,mimeType,size,webViewLink,thumbnailLink,iconLink,modifiedTime,parents)",
      orderBy: "folder,name",
      pageSize: 200,
    }),
  )

  return (response.data.files ?? []).map(mapDriveFile)
}

async function getUserDriveRoot(user: AuthUser) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("user_drive_roots")
    .select("user_id,folder_id,folder_name")
    .eq("user_id", user.id)
    .maybeSingle<UserDriveRootRow>()

  if (error) {
    throw new Error(error.message)
  }

  if (data?.folder_id) {
    return {
      folderId: data.folder_id,
      folderName: data.folder_name,
    }
  }

  const drive = getDrive()
  const systemFolders = await resolveSystemFolders()
  const nextFolder = await ensureFolderByName(drive, systemFolders.usersFolderId, `${sanitizeDriveName(user.name)} - ${user.id.slice(0, 8)}`)

  const { error: upsertError } = await supabase.from("user_drive_roots").upsert(
    {
      user_id: user.id,
      folder_id: nextFolder.id,
      folder_name: nextFolder.name,
    },
    { onConflict: "user_id" },
  )

  if (upsertError) {
    throw new Error(upsertError.message)
  }

  return {
    folderId: nextFolder.id,
    folderName: nextFolder.name,
  }
}

export async function getUserDrivePreference(user: AuthUser) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from("user_drive_preferences")
    .select("user_id,default_folder_id,default_folder_name")
    .eq("user_id", user.id)
    .maybeSingle<UserDrivePreferenceRow>()

  if (error) {
    throw new Error(error.message)
  }

  return {
    defaultFolderId: data?.default_folder_id ?? null,
    defaultFolderName: data?.default_folder_name ?? null,
  }
}

export async function setUserDrivePreference(user: AuthUser, folderId: string, folderName: string) {
  const supabase = createSupabaseAdminClient()
  const { error } = await supabase.from("user_drive_preferences").upsert({
    user_id: user.id,
    default_folder_id: folderId,
    default_folder_name: folderName,
  }, { onConflict: "user_id" })

  if (error) {
    throw new Error(error.message)
  }

  return {
    defaultFolderId: folderId,
    defaultFolderName: folderName,
  }
}

async function resolveScopeRoot(user: AuthUser, scope: DriveScope, mode: DriveAuthMode): Promise<ScopeRoot> {
  if (mode === "oauth") {
    if (scope === "all_files") {
      return {
        rootFolderId: VIRTUAL_ALL_FILES_ROOT_ID,
        rootFolderName: "جميع الملفات",
        virtualAllFiles: true,
      }
    }

    return {
      rootFolderId: "root",
      rootFolderName: "ملفاتي",
    }
  }

  const systemFolders = await resolveSystemFolders()

  if (scope === "all_files") {
    return {
      rootFolderId: systemFolders.allFilesFolderId,
      rootFolderName: "جميع الملفات",
    }
  }

  const userRoot = await getUserDriveRoot(user)

  return {
    rootFolderId: userRoot.folderId,
    rootFolderName: "ملفاتي",
  }
}

export async function getDriveBrowserData(user: AuthUser, scope: DriveScope, folderId?: string | null, query?: string | null): Promise<DriveBrowserData> {
  const access = await getDriveAccess(user)
  const { drive, mode } = access
  const root = await resolveScopeRoot(user, scope, mode)
  const preference = scope === "my_files" ? await getUserDrivePreference(user) : null

  if (query?.trim()) {
    const queryParts = [`name contains '${escapeDriveQueryValue(query.trim())}'`, "trashed = false"]

    if (mode === "oauth" && scope === "my_files") {
      queryParts.push("'me' in owners")
    }

    const response = await drive.files.list(
      withAllDriveSupport({
        q: queryParts.join(" and "),
        fields: "files(id,name,mimeType,size,webViewLink,thumbnailLink,iconLink,modifiedTime,parents)",
        orderBy: "folder,name",
        pageSize: 100,
      }),
    )

    return {
      scope,
      rootFolderId: root.rootFolderId,
      rootFolderName: root.rootFolderName,
      currentFolderId: root.rootFolderId,
      currentFolderName: `نتائج البحث عن: ${query.trim()}`,
      parentFolderId: null,
      items: (response.data.files ?? []).map(mapDriveFile),
      searchQuery: query.trim(),
    }
  }

  if (mode === "oauth" && root.virtualAllFiles && !folderId) {
    return {
      scope,
      rootFolderId: root.rootFolderId,
      rootFolderName: root.rootFolderName,
      currentFolderId: root.rootFolderId,
      currentFolderName: root.rootFolderName,
      parentFolderId: null,
      items: await listAllAccessibleItems(drive),
      searchQuery: "",
    }
  }

  const currentFolderId = folderId || (scope === "my_files" ? (preference?.defaultFolderId ?? root.rootFolderId) : root.rootFolderId)
  const currentFolder = currentFolderId === root.rootFolderId
    ? { id: root.rootFolderId, name: root.rootFolderName, parents: [] as string[] }
    : await getDriveFile(drive, currentFolderId)

  const items = await listDirectChildren(drive, currentFolderId)

  return {
    scope,
    rootFolderId: root.rootFolderId,
    rootFolderName: root.rootFolderName,
    currentFolderId,
    currentFolderName: currentFolder.name ?? root.rootFolderName,
    parentFolderId: currentFolderId === root.rootFolderId ? null : (currentFolder.parents?.[0] ?? root.rootFolderId),
    items,
    searchQuery: "",
  }
}

export async function createDriveFolder(user: AuthUser, parentId: string, name: string) {
  if (parentId === VIRTUAL_ALL_FILES_ROOT_ID) {
    throw new Error("اختر مجلدًا فعليًا قبل إنشاء مجلد جديد")
  }

  const { drive } = await getDriveAccess(user)
  const folder = await ensureFolderByName(drive, parentId, sanitizeDriveName(name))
  const fullFolder = await getDriveFile(drive, folder.id)
  return mapDriveFile(fullFolder)
}

export async function uploadDriveFile(user: AuthUser, parentId: string, file: File, nameOverride?: string | null) {
  if (parentId === VIRTUAL_ALL_FILES_ROOT_ID) {
    throw new Error("اختر مجلدًا فعليًا قبل رفع ملف جديد")
  }

  const { drive } = await getDriveAccess(user)
  const buffer = Buffer.from(await file.arrayBuffer())
  const response = await drive.files.create(
    withAllDriveSupport({
      requestBody: {
        name: sanitizeDriveName(nameOverride?.trim() || file.name),
        parents: [parentId],
      },
      media: {
        mimeType: file.type || "application/octet-stream",
        body: Readable.from(buffer),
      },
      fields: "id,name,mimeType,size,webViewLink,thumbnailLink,iconLink,modifiedTime,parents",
    }),
  )

  return mapDriveFile(response.data)
}

export async function resolveTaskAttachmentFolder(user: AuthUser) {
  const preference = await getUserDrivePreference(user)

  if (preference.defaultFolderId) {
    return {
      folderId: preference.defaultFolderId,
      folderName: preference.defaultFolderName ?? "مكان ملفاتي",
    }
  }

  const access = await getDriveAccess(user)
  const root = await resolveScopeRoot(user, "my_files", access.mode)
  return {
    folderId: root.rootFolderId,
    folderName: root.rootFolderName,
  }
}

export async function renameDriveItem(user: AuthUser, itemId: string, name: string) {
  const { drive } = await getDriveAccess(user)
  const response = await drive.files.update(
    withAllDriveSupport({
      fileId: itemId,
      requestBody: { name: sanitizeDriveName(name) },
      fields: "id,name,mimeType,size,webViewLink,thumbnailLink,iconLink,modifiedTime,parents",
    }),
  )

  return mapDriveFile(response.data)
}

export async function moveDriveItem(user: AuthUser, itemId: string, targetParentId: string) {
  const { drive } = await getDriveAccess(user)
  const current = await getDriveFile(drive, itemId)
  const previousParents = (current.parents ?? []).join(",")

  const response = await drive.files.update(
    withAllDriveSupport({
      fileId: itemId,
      addParents: targetParentId,
      removeParents: previousParents,
      fields: "id,name,mimeType,size,webViewLink,thumbnailLink,iconLink,modifiedTime,parents",
    }),
  )

  return mapDriveFile(response.data)
}

export async function deleteDriveItem(user: AuthUser, itemId: string) {
  const { drive } = await getDriveAccess(user)
  await drive.files.delete(withAllDriveSupport({ fileId: itemId }))
}

export async function listDriveFolderOptions(user: AuthUser): Promise<DriveFolderOption[]> {
  const access = await getDriveAccess(user)
  const drive = access.drive

  if (access.mode === "oauth") {
    const queue: Array<{ id: string; path: string }> = [{ id: "root", path: "ملفاتي" }]
    const seen = new Set<string>()
    const options: DriveFolderOption[] = []

    while (queue.length > 0 && options.length < 250) {
      const current = queue.shift()
      if (!current || seen.has(current.id)) {
        continue
      }

      seen.add(current.id)
      const info = current.id === "root"
        ? { name: "ملفاتي" }
        : await getDriveFile(drive, current.id)

      options.push({
        id: current.id,
        name: info.name ?? current.path,
        path: current.path,
      })

      const childFolders = await listDirectChildren(drive, current.id, true)
      for (const folder of childFolders) {
        if (seen.has(folder.id)) {
          continue
        }

        queue.push({
          id: folder.id,
          path: `${current.path} / ${folder.name}`,
        })
      }
    }

    return options
  }

  const systemFolders = await resolveSystemFolders()
  const userRoot = await getUserDriveRoot(user)

  const queue: Array<{ id: string; path: string }> = [
    { id: userRoot.folderId, path: "ملفاتي" },
    { id: systemFolders.allFilesFolderId, path: "جميع الملفات" },
    { id: systemFolders.tasksFolderId, path: "مجلدات المهمات" },
  ]
  const seen = new Set<string>()
  const options: DriveFolderOption[] = []

  while (queue.length > 0 && options.length < 250) {
    const current = queue.shift()
    if (!current || seen.has(current.id)) {
      continue
    }

    seen.add(current.id)
    const info = await getDriveFile(drive, current.id)
    options.push({
      id: current.id,
      name: info.name ?? current.path,
      path: current.path,
    })

    const childFolders = await listDirectChildren(drive, current.id, true)
    for (const folder of childFolders) {
      if (seen.has(folder.id)) {
        continue
      }

      queue.push({
        id: folder.id,
        path: `${current.path} / ${folder.name}`,
      })
    }
  }

  return options
}