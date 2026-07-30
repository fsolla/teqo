import { describe, expect, it } from 'vitest'

import {
  CAMPAIGN_ACTIONS_HOME,
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  campaignActionEntryHref,
  isCampaignWizardActionId,
  isCampaignWizardActionSlug,
} from '@/lib/campaignActionRoutes'

describe('campaignActionRoutes', () => {
  it.each(
    Object.entries(CAMPAIGN_WIZARD_ACTION_SLUGS) as Array<
      [keyof typeof CAMPAIGN_WIZARD_ACTION_SLUGS, string]
    >,
  )('maps %s to /campanha/acoes/%s', (id, slug) => {
    expect(campaignActionEntryHref(id)).toBe(`${CAMPAIGN_ACTIONS_HOME}/${slug}`)
    expect(isCampaignWizardActionSlug(slug)).toBe(true)
  })

  it('recognizes wizard ids and rejects list shortcuts', () => {
    expect(isCampaignWizardActionId('update-votes')).toBe(true)
    expect(isCampaignWizardActionId('uncovered-municipalities')).toBe(false)
  })

  it('rejects unknown wizard slugs', () => {
    expect(isCampaignWizardActionSlug('inventado')).toBe(false)
  })
})
