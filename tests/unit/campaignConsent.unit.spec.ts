// @vitest-environment node

import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  getConsentByKey,
  getLeadershipConsent,
  requireConsentByKey,
  requireLeadershipConsent,
  SUPPORTER_REGISTRATION_CONSENT_KEY,
} from '@/utilities/campaignConsent'
import { CAMPAIGN_INVITE_CONSENT_KEY } from '@/utilities/campaignInvite'

import { stub } from '../helpers/stub'

describe('campaign consent descriptor', () => {
  it('returns the stable descriptor and propagates the transaction request', async () => {
    const req = { transactionID: 17 }
    const find = vi.fn().mockResolvedValue({
      docs: [{ id: 9, text: { root: { children: [] } } }],
    })
    const payload = stub<Payload>({ find })

    const consent = await getLeadershipConsent(payload, req)

    // Since P3-D the leadership wrapper returns the full `ConsentDescriptor`
    // (the deprecated key-less `LeadershipConsentDescriptor` alias is gone).
    expect(consent).toEqual({
      id: 9,
      text: { root: { children: [] } },
      contentHash: 'd800986181e1730e945e028853848395d8c34ccb95b54abbbaa50cb9539a845b',
      key: CAMPAIGN_INVITE_CONSENT_KEY,
    })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        where: { key: { equals: CAMPAIGN_INVITE_CONSENT_KEY } },
      }),
    )
  })

  it('resolves arbitrary consent keys and fails closed when missing', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({
        docs: [
          { id: 3, text: { root: { children: [] } }, key: SUPPORTER_REGISTRATION_CONSENT_KEY },
        ],
      })
      .mockResolvedValue({ docs: [] })
    const payload = stub<Payload>({ find })

    await expect(getConsentByKey(payload, SUPPORTER_REGISTRATION_CONSENT_KEY)).resolves.toEqual({
      id: 3,
      text: { root: { children: [] } },
      contentHash: 'd800986181e1730e945e028853848395d8c34ccb95b54abbbaa50cb9539a845b',
      key: SUPPORTER_REGISTRATION_CONSENT_KEY,
    })
    await expect(getConsentByKey(payload, 'missing-key')).resolves.toBeNull()
    await expect(
      requireConsentByKey(payload, 'missing-key', undefined, 'Consentimento ausente.'),
    ).rejects.toThrow('Consentimento ausente.')
  })

  it('keeps nullable and required missing-consent semantics distinct', async () => {
    const payload = stub<Payload>({
      find: vi.fn().mockResolvedValue({ docs: [] }),
    })

    await expect(getLeadershipConsent(payload)).resolves.toBeNull()
    await expect(
      requireLeadershipConsent(payload, undefined, 'Consentimento ausente.'),
    ).rejects.toThrow('Consentimento ausente.')
  })
})
