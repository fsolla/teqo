import { describe, expect, it } from 'vitest'

import { isGooglePushNotificationValid } from '@/lib/googleCalendarPushNotification'

const SECRET = '0123456789abcdef0123456789abcdef'
const CHANNEL_ID = 'channel-1'
const RESOURCE_ID = 'resource-1'

const config = {
  pushChannelSecret: SECRET,
  pushChannelId: CHANNEL_ID,
  pushChannelResourceId: RESOURCE_ID,
}

describe('isGooglePushNotificationValid (C115 webhook fail-closed)', () => {
  it('accepts a delivery that matches every credential', () => {
    expect(
      isGooglePushNotificationValid({
        secret: SECRET,
        channelId: CHANNEL_ID,
        resourceId: RESOURCE_ID,
        channelToken: SECRET,
        config,
      }),
    ).toBe(true)
  })

  it('rejects a wrong URL secret', () => {
    expect(
      isGooglePushNotificationValid({
        secret: 'x'.repeat(32),
        channelId: CHANNEL_ID,
        resourceId: RESOURCE_ID,
        channelToken: SECRET,
        config,
      }),
    ).toBe(false)
  })

  it('rejects a short URL secret', () => {
    expect(
      isGooglePushNotificationValid({
        secret: 'short',
        channelId: CHANNEL_ID,
        resourceId: RESOURCE_ID,
        channelToken: SECRET,
        config,
      }),
    ).toBe(false)
  })

  it('rejects missing channel headers', () => {
    expect(
      isGooglePushNotificationValid({
        secret: SECRET,
        channelId: null,
        resourceId: RESOURCE_ID,
        channelToken: SECRET,
        config,
      }),
    ).toBe(false)
    expect(
      isGooglePushNotificationValid({
        secret: SECRET,
        channelId: CHANNEL_ID,
        resourceId: null,
        channelToken: SECRET,
        config,
      }),
    ).toBe(false)
    expect(
      isGooglePushNotificationValid({
        secret: SECRET,
        channelId: CHANNEL_ID,
        resourceId: RESOURCE_ID,
        channelToken: null,
        config,
      }),
    ).toBe(false)
  })

  it('rejects a spoofed channel id / resource id / token', () => {
    expect(
      isGooglePushNotificationValid({
        secret: SECRET,
        channelId: 'attacker-channel',
        resourceId: RESOURCE_ID,
        channelToken: SECRET,
        config,
      }),
    ).toBe(false)
    expect(
      isGooglePushNotificationValid({
        secret: SECRET,
        channelId: CHANNEL_ID,
        resourceId: 'attacker-resource',
        channelToken: SECRET,
        config,
      }),
    ).toBe(false)
    expect(
      isGooglePushNotificationValid({
        secret: SECRET,
        channelId: CHANNEL_ID,
        resourceId: RESOURCE_ID,
        channelToken: 'attacker-token',
        config,
      }),
    ).toBe(false)
  })

  it('rejects when no channel was ever configured', () => {
    expect(
      isGooglePushNotificationValid({
        secret: SECRET,
        channelId: CHANNEL_ID,
        resourceId: RESOURCE_ID,
        channelToken: SECRET,
        config: { pushChannelSecret: null, pushChannelId: null, pushChannelResourceId: null },
      }),
    ).toBe(false)
  })

  it('rejects a token that is a different valid length (constant-time does not leak)', () => {
    expect(
      isGooglePushNotificationValid({
        secret: SECRET,
        channelId: CHANNEL_ID,
        resourceId: RESOURCE_ID,
        channelToken: 'y'.repeat(32),
        config,
      }),
    ).toBe(false)
  })
})
