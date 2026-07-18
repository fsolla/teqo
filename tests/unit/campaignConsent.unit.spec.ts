// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import {
  getLeadershipConsent,
  requireLeadershipConsent,
} from '@/utilities/campaignConsent'

describe('campaign consent descriptor', () => {
  it('returns the stable descriptor and propagates the transaction request', async () => {
    const req = { transactionID: 17 }
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 9, text: { root: { children: [] } } }],
    })
    const payload = { find } as unknown as Payload

    const consent = await getLeadershipConsent(payload, req)

    expect(consent).toEqual({
      id: 9,
      text: { root: { children: [] } },
      contentHash: 'd800986181e1730e945e028853848395d8c34ccb95b54abbbaa50cb9539a845b',
    })
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ req }))
  })

  it('keeps nullable and required missing-consent semantics distinct', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({ docs: [] }),
    } as unknown as Payload

    await expect(getLeadershipConsent(payload)).resolves.toBeNull()
    await expect(requireLeadershipConsent(payload, undefined, 'Consentimento ausente.')).rejects.toThrow(
      'Consentimento ausente.',
    )
  })
})
