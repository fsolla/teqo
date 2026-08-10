/** Payload `req.context` flag — domain hooks skip creating notifications when true. */
export const SKIP_CAMPAIGN_NOTIFICATION_CONTEXT_KEY = 'skipCampaignNotification'

/** Opt back into hook-fired notifications inside Vitest (default: skipped). */
export const ENABLE_CAMPAIGN_NOTIFICATION_CONTEXT_KEY = 'enableCampaignNotification'

export const notificationTypes = [
  'municipality_update',
  'new_supporter',
  'activity_attention',
  'invite_accepted',
] as const

export type NotificationType = (typeof notificationTypes)[number]

export type NotificationPayload = {
  title: string
  detail: string
  href: string
}

export type NotificationListItem = {
  id: number
  type: NotificationType
  payload: NotificationPayload
  createdAt: string
}

export const notificationTypeLabels: Record<NotificationType, string> = {
  municipality_update: 'Reporte de campo',
  new_supporter: 'Novo apoiador',
  activity_attention: 'Atividade',
  invite_accepted: 'Convite aceito',
}
