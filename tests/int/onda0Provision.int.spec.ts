// @vitest-environment node

import { getPayload, type Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { ONDA0_CONSENT_ENTRIES } from '@/lib/onda0ConsentTexts'
import config from '@/payload.config'
import { requireConsentByKey } from '@/utilities/campaignConsent'
import { provisionOnda0ConsentAndPrivacy } from '@/utilities/onda0Provision'

import { assertTestDatabase } from '../helpers/assertTestDatabase'
import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload

installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('Onda 0 provision (integration)', () => {
  beforeAll(async () => {
    assertTestDatabase(process.env.DATABASE_URL)
    payload = await getPayload({ config })
  })

  it('upserts consent keys and publishes privacy-policy idempotently', async () => {
    await provisionOnda0ConsentAndPrivacy(payload)
    await provisionOnda0ConsentAndPrivacy(payload)

    for (const { key } of ONDA0_CONSENT_ENTRIES) {
      const descriptor = await requireConsentByKey(payload, key)
      expect(descriptor.key).toBe(key)
      expect(descriptor.contentHash).toMatch(/^[a-f0-9]{64}$/)
    }

    const privacy = await payload.findGlobal({
      slug: 'privacy-policy',
      overrideAccess: true,
    })
    expect(privacy.published).toBe(true)
    expect(privacy.body).toBeTruthy()
  })
})
