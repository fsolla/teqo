// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import {
  countUnreadNotifications,
  loadNotificationList,
  markAllNotificationsRead,
} from '@/utilities/notification/notificationList'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('notification access', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('denies anonymous reads', async () => {
    await expect(
      payload.find({ collection: 'notification', overrideAccess: false }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })

  it('shows a recipient only their own notifications', async () => {
    const fixtures = campaignFixtures()
    const [owner, other] = await Promise.all([
      fixtures.createCampaignUser('advisor'),
      fixtures.createCampaignUser('advisor'),
    ])

    const own = await payload.create({
      collection: 'notification',
      data: {
        recipient: owner.id,
        type: 'municipality_update',
        payload: {
          title: 'Teste — Município',
          detail: 'Detalhe',
          href: '/campanha/municipios/teste',
        },
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'notification',
      data: {
        recipient: other.id,
        type: 'new_supporter',
        payload: {
          title: 'Outro',
          detail: 'Detalhe',
          href: '/campanha/apoiadores',
        },
      },
      overrideAccess: true,
    })

    const visible = await payload.find({
      collection: 'notification',
      depth: 0,
      user: owner,
      overrideAccess: false,
    })

    expect(visible.docs.map((doc) => doc.id)).toEqual([own.id])
  })

  it('reads the bell loaders through owner-scoped access (no bypass)', async () => {
    const fixtures = campaignFixtures()
    const [owner, other] = await Promise.all([
      fixtures.createCampaignUser('advisor'),
      fixtures.createCampaignUser('advisor'),
    ])

    const own = await payload.create({
      collection: 'notification',
      data: {
        recipient: owner.id,
        type: 'municipality_update',
        payload: { title: 'Sino — própria', detail: 'Detalhe', href: '/campanha' },
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'notification',
      data: {
        recipient: other.id,
        type: 'new_supporter',
        payload: { title: 'Sino — alheia', detail: 'Detalhe', href: '/campanha' },
      },
      overrideAccess: true,
    })

    // The loaders take the actor, not a recipientID — a caller cannot ask for
    // someone else's inbox (Pass 4: the previous recipientID+bypass shape
    // trusted every call site).
    await expect(loadNotificationList(payload, owner)).resolves.toEqual([
      expect.objectContaining({ id: own.id }),
    ])
    await expect(countUnreadNotifications(payload, owner)).resolves.toBe(1)
    await expect(countUnreadNotifications(payload, other)).resolves.toBe(1)
  })

  it("marks only the actor's own unread notifications as read (C108)", async () => {
    const fixtures = campaignFixtures()
    const [owner, other] = await Promise.all([
      fixtures.createCampaignUser('advisor'),
      fixtures.createCampaignUser('advisor'),
    ])

    const ownUnread = await payload.create({
      collection: 'notification',
      data: {
        recipient: owner.id,
        type: 'municipality_update',
        payload: { title: 'Própria — não lida', detail: 'Detalhe', href: '/campanha' },
      },
      overrideAccess: true,
    })
    const ownAlreadyRead = await payload.create({
      collection: 'notification',
      data: {
        recipient: owner.id,
        type: 'new_supporter',
        payload: { title: 'Própria — já lida', detail: 'Detalhe', href: '/campanha' },
        readAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })
    const otherUnread = await payload.create({
      collection: 'notification',
      data: {
        recipient: other.id,
        type: 'invite_accepted',
        payload: { title: 'Alheia — não lida', detail: 'Detalhe', href: '/campanha' },
      },
      overrideAccess: true,
    })

    const markedCount = await markAllNotificationsRead(payload, owner)

    expect(markedCount).toBe(1)
    const ownAfter = await payload.findByID({
      collection: 'notification',
      id: ownUnread.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(ownAfter.readAt).not.toBeNull()
    const readOwn = await payload.findByID({
      collection: 'notification',
      id: ownAlreadyRead.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(readOwn.readAt).not.toBeNull()
    const untouched = await payload.findByID({
      collection: 'notification',
      id: otherUnread.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(untouched.readAt).toBeNull()

    // Idempotent: a second pass touches nothing.
    await expect(markAllNotificationsRead(payload, owner)).resolves.toBe(0)
    await expect(countUnreadNotifications(payload, owner)).resolves.toBe(0)
  })
})

describe('pushSubscription access', () => {
  it('denies client-shaped subscription writes', async () => {
    const fixtures = campaignFixtures()
    const owner = await fixtures.createCampaignUser('advisor')

    await expect(
      payload.create({
        collection: 'pushSubscription',
        data: {
          user: owner.id,
          endpoint: 'https://push.example/1',
          p256dh: 'key',
          auth: 'auth',
          consent: 1,
          consentContentHash: 'hash',
          consentedAt: new Date().toISOString(),
        },
        user: owner,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/permissão|not allowed/i)
  })
})
