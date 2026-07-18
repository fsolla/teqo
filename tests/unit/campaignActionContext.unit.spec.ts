// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import type { CampaignUser } from '@/payload-types'
import { reloadCampaignActor, requireCampaignUser } from '@/utilities/campaignActionContext'

describe('campaign action context', () => {
  it('preserves the generic authentication error', async () => {
    await expect(requireCampaignUser(async () => null)).rejects.toThrow('Autenticação necessária.')
  })

  it('reloads the actor role with the transaction req', async () => {
    const staleActor = { id: 9, role: 'geral' } as CampaignUser
    const currentActor = { ...staleActor, role: 'lideranca' } as CampaignUser
    const findByID = vi.fn().mockResolvedValue(currentActor)
    const req = { transactionID: 21 }

    await expect(reloadCampaignActor({ findByID } as never, staleActor, req)).resolves.toBe(
      currentActor,
    )
    expect(findByID).toHaveBeenCalledWith({
      collection: 'campaignUser',
      id: staleActor.id,
      depth: 0,
      overrideAccess: true,
      req,
    })
  })
})
