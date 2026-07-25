// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import type { CampaignUser } from '@/payload-types'
import {
  reloadCampaignActor,
  reloadUnrestrictedActor,
  requireCampaignUser,
} from '@/utilities/campaignActionContext'

describe('campaign action context', () => {
  it('preserves the generic authentication error', async () => {
    await expect(requireCampaignUser(async () => null)).rejects.toThrow('Autenticação necessária.')
  })

  it('reloads the actor role with the transaction req', async () => {
    const staleActor = { id: 9, role: 'coordinator' } as CampaignUser
    const currentActor = { ...staleActor, role: 'leader' } as CampaignUser
    const findByID = vi.fn().mockResolvedValue(currentActor)
    const req = { transactionID: 21 }

    await expect(reloadCampaignActor({ findByID }, staleActor, req)).resolves.toBe(currentActor)
    expect(findByID).toHaveBeenCalledWith({
      collection: 'campaignUser',
      id: staleActor.id,
      depth: 0,
      overrideAccess: true,
      req,
    })
  })

  it('accepts coordinator and candidate as unrestricted', async () => {
    const findByID = vi.fn()
    for (const role of ['coordinator', 'candidate'] as const) {
      const actor = { id: 1, role, collection: 'campaignUser' } as CampaignUser
      findByID.mockResolvedValueOnce(actor)
      await expect(reloadUnrestrictedActor({ findByID }, actor, 'denied')).resolves.toBe(actor)
    }
  })

  it('rejects advisor for unrestricted reload', async () => {
    const actor = { id: 2, role: 'advisor', collection: 'campaignUser' } as CampaignUser
    const findByID = vi.fn().mockResolvedValue(actor)
    await expect(reloadUnrestrictedActor({ findByID }, actor, 'denied')).rejects.toThrow('denied')
  })
})
