// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { getCampaignNav, isCampaignNavActive } from '@/components/campaign/shell/nav'
import { CAMPAIGN_AGENDA_HOME } from '@/lib/campaignPaths'
import { ORGANIZATIONS_LIST_PATH } from '@/lib/campaignQuickActionPaths'

describe('organizations sidebar entry', () => {
  it('is offered to staff after Lideranças', () => {
    const hrefs = getCampaignNav('coordinator').map((item) => item.href)
    const leadershipIndex = hrefs.indexOf('/campanha/liderancas')
    const organizationsIndex = hrefs.indexOf(ORGANIZATIONS_LIST_PATH)

    expect(organizationsIndex).toBeGreaterThan(-1)
    expect(organizationsIndex).toBe(leadershipIndex + 1)
  })

  it('is visible to advisor and candidate', () => {
    expect(getCampaignNav('advisor').map((item) => item.href)).toContain(ORGANIZATIONS_LIST_PATH)
    expect(getCampaignNav('candidate').map((item) => item.href)).toContain(ORGANIZATIONS_LIST_PATH)
  })

  it('is hidden from leaders', () => {
    expect(getCampaignNav('leader').map((item) => item.href)).not.toContain(ORGANIZATIONS_LIST_PATH)
  })

  it('marks list, detail, and nova as active', () => {
    expect(isCampaignNavActive(ORGANIZATIONS_LIST_PATH, ORGANIZATIONS_LIST_PATH)).toBe(true)
    expect(isCampaignNavActive('/campanha/organizacoes/sindmed', ORGANIZATIONS_LIST_PATH)).toBe(
      true,
    )
    expect(isCampaignNavActive('/campanha/organizacoes/nova', ORGANIZATIONS_LIST_PATH)).toBe(true)
  })
})

describe('agenda sidebar entry', () => {
  it('replaces Atividades for staff and stays hidden from leaders', () => {
    for (const role of ['coordinator', 'candidate', 'advisor'] as const) {
      const agenda = getCampaignNav(role).find((item) => item.href === CAMPAIGN_AGENDA_HOME)
      expect(agenda?.title).toBe('Agenda')
    }
    expect(getCampaignNav('leader').map((item) => item.href)).not.toContain(CAMPAIGN_AGENDA_HOME)
  })

  it('stays active on the agenda and legacy activity routes', () => {
    expect(isCampaignNavActive(CAMPAIGN_AGENDA_HOME, CAMPAIGN_AGENDA_HOME)).toBe(true)
    expect(isCampaignNavActive('/campanha/atividades', CAMPAIGN_AGENDA_HOME)).toBe(true)
    expect(isCampaignNavActive('/campanha/atividades/comicio', CAMPAIGN_AGENDA_HOME)).toBe(true)
    expect(isCampaignNavActive('/campanha/atividades/comicio/editar', CAMPAIGN_AGENDA_HOME)).toBe(
      true,
    )
  })
})
