export type AdminChatAttachment = {
  name: string
  url: string
  mimeType: string
  size: number
}

export type AdminChatMessage = {
  id: string
  senderUserId: string
  senderName: string
  messageText: string
  attachments: AdminChatAttachment[]
  createdAt: string
}

export type AdminChatData = {
  currentUserId: string
  messages: AdminChatMessage[]
}
