/**
 * C115 — fail-closed validation of Google Calendar push deliveries (the
 * webhook route's security contract). Google echoes the channel identity on
 * every notification: the URL secret, the channel id, the resource id and
 * the channel token must ALL match the stored channel — compared in constant
 * time, because the endpoint is a public surface. Any mismatch rejects.
 */
import { timingSafeEqual } from 'node:crypto'

type GooglePushChannelConfig = {
  pushChannelSecret: string | null
  pushChannelId: string | null
  pushChannelResourceId: string | null
}

export type GooglePushNotificationInput = {
  secret: string
  channelId: string | null
  resourceId: string | null
  channelToken: string | null
  config: GooglePushChannelConfig
}

const safeEqual = (a: string, b: string): boolean => {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer)
}

export const isGooglePushNotificationValid = (input: GooglePushNotificationInput): boolean => {
  const { secret, channelId, resourceId, channelToken, config } = input
  if (secret.length < 32) return false
  if (!config.pushChannelSecret || !config.pushChannelId || !config.pushChannelResourceId) {
    return false
  }
  if (!safeEqual(secret, config.pushChannelSecret)) return false
  if (!channelId || !resourceId || !channelToken) return false
  if (!safeEqual(channelId, config.pushChannelId)) return false
  if (!safeEqual(resourceId, config.pushChannelResourceId)) return false
  if (!safeEqual(channelToken, config.pushChannelSecret)) return false
  return true
}
