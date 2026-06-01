import "server-only"

export const WHATSAPP_QUEUE_TABLE = process.env.WHATSAPP_QUEUE_TABLE || "whatsapp_queue"
export const WHATSAPP_HISTORY_TABLE = process.env.WHATSAPP_HISTORY_TABLE || "whatsapp_messages"
export const WHATSAPP_WORKER_STATE_SETTING_ID = process.env.WHATSAPP_WORKER_STATE_SETTING_ID || "whatsapp_worker_state"
export const WHATSAPP_WORKER_COMMAND_SETTING_ID = process.env.WHATSAPP_WORKER_COMMAND_SETTING_ID || "whatsapp_worker_command"
export const WHATSAPP_DELIVERY_MODE_SETTING_ID = process.env.WHATSAPP_DELIVERY_MODE_SETTING_ID || "whatsapp_delivery_mode"
export const WHATSAPP_RECIPIENT_LISTS_SETTING_ID = process.env.WHATSAPP_RECIPIENT_LISTS_SETTING_ID || "whatsapp_recipient_lists"