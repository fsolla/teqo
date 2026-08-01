// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { loadWizardMunicipalitySuggestions } from '@/utilities/homeSearch/loadWizardMunicipalitySuggestions'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('loadWizardMunicipalitySuggestions (B92)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('returns up to eight scoped municipalities for coordinator', async () => {
    const fixtures = campaignFixtures()
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const result = await loadWizardMunicipalitySuggestions(payload, coordinator)
    expect(result.resultKind).toBe('wizard-suggest')
    expect(result.municipalities.length).toBeGreaterThan(0)
    expect(result.municipalities.length).toBeLessThanOrEqual(8)
    expect(result.scopeMunicipalities?.length).toBeGreaterThan(0)
  })

  it('scopes advisor suggestions to administered municipalities', async () => {
    const fixtures = campaignFixtures()
    const advisor = await fixtures.createCampaignUser('advisor')
    const administered = await fixtures.getMunicipality()
    await fixtures.assignMunicipalityAdvisors(administered.id, [advisor.id])

    const result = await loadWizardMunicipalitySuggestions(payload, advisor)
    expect(result.municipalities.every((hit) => hit.slug === administered.slug)).toBe(true)
  })

  it('rejects leaders from wizard municipality suggestions', async () => {
    const fixtures = campaignFixtures()
    const leader = await fixtures.createCampaignUser('leader')

    await expect(loadWizardMunicipalitySuggestions(payload, leader)).rejects.toThrow(
      /equipe de campanha/i,
    )
  })
})
