import type { Payload } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { stub } from '../helpers/stub'

/**
 * OPS83 — the notification fan-out must skip recipients whose `campaignUser`
 * no longer resolves, instead of inserting and crashing the host transaction
 * with an FK violation. Observed aborting `notifyMunicipalityUpdateCreated`
 * under the parallel e2e suite (run #16) — a deleted advisor left the insert
 * referencing a vanished row; the same hazard exists in production when a
 * staff member is removed mid-fan-out.
 */

const { sendMock, createMock, findMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  createMock: vi.fn(async (args: { data?: Record<string, unknown> }) => ({
    id: 0,
    doc: args.data,
  })),
  findMock: vi.fn(),
}))

vi.mock('@/utilities/notification/sendCampaignPush', () => ({
  sendCampaignPushForNotification: sendMock,
}))

vi.mock('@/utilities/payloadTransaction', () => ({
  onPayloadTransactionCommit: vi.fn(),
}))

import { createCampaignNotifications } from '@/utilities/notification/createCampaignNotification'

describe('createCampaignNotifications (stale-recipient guard, OPS83)', () => {
  const payload = stub<Payload>({
    find: findMock as unknown as Payload['find'],
    create: createMock as unknown as Payload['create'],
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('skips recipients that no longer resolve to a campaignUser', async () => {
    findMock.mockResolvedValue({ docs: [{ id: 7 }, { id: 9 }] })

    await createCampaignNotifications(payload, [7, 9, 999], {
      type: 'municipality_update',
      payload: { title: 't', detail: 'd', href: '/x' },
    })

    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'campaignUser',
        where: { id: { in: [7, 9, 999] } },
      }),
    )
    // 999 did not resolve — never inserted.
    expect(createMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipient: 999 }),
      }),
    )
    expect(createMock).toHaveBeenCalledTimes(2)
  })

  it('drops non-finite recipient ids from the candidate set', async () => {
    findMock.mockResolvedValue({ docs: [{ id: 5 }] })

    await createCampaignNotifications(payload, [5, Number.NaN], {
      type: 'new_supporter',
      payload: { title: 't', detail: 'd', href: '/x' },
    })

    expect(findMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: [5] } } }))
    expect(createMock).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when no recipient resolves', async () => {
    findMock.mockResolvedValue({ docs: [] })

    await createCampaignNotifications(payload, [404], {
      type: 'activity_attention',
      payload: { title: 't', detail: 'd', href: '/x' },
    })

    expect(createMock).not.toHaveBeenCalled()
  })

  it('is a no-op for an empty candidate set without querying', async () => {
    await createCampaignNotifications(payload, [], {
      type: 'municipality_update',
      payload: { title: 't', detail: 'd', href: '/x' },
    })

    expect(findMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })
})
