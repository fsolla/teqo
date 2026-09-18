// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  activeCampaignSubItemHref,
  getCampaignBottomNav,
  getCampaignNav,
  getCampaignOverflowNav,
  isCampaignNavActive,
} from '@/components/campaign/shell/nav'
import {
  CAMPAIGN_AGENDA_HOME,
  CAMPAIGN_COMMUNICATION_ACERVO,
  CAMPAIGN_COMMUNICATION_CORTES,
  CAMPAIGN_COMMUNICATION_HOME,
  CAMPAIGN_COMMUNICATION_REELS,
  CAMPAIGN_UPDATES_HREF,
} from '@/lib/campaignPaths'
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

describe('communicator sidebar', () => {
  it('offers only the communication vertical, with no staff destinations', () => {
    const items = getCampaignNav('communicator')
    expect(items.map((item) => item.href)).toEqual([CAMPAIGN_COMMUNICATION_HOME])
    expect(items[0]?.title).toBe('Comunicação')
    expect(getCampaignBottomNav('communicator')).toHaveLength(0)
    expect(getCampaignOverflowNav('communicator')).toHaveLength(0)
  })

  it('is offered to coordinator/candidate and hidden from advisor/leader', () => {
    for (const role of ['coordinator', 'candidate'] as const) {
      expect(getCampaignNav(role).map((item) => item.href)).toContain(CAMPAIGN_COMMUNICATION_HOME)
    }
    expect(getCampaignNav('advisor').map((item) => item.href)).not.toContain(
      CAMPAIGN_COMMUNICATION_HOME,
    )
    expect(getCampaignNav('leader').map((item) => item.href)).not.toContain(
      CAMPAIGN_COMMUNICATION_HOME,
    )
  })

  it('marks the acervo and detail as active on the vertical item', () => {
    expect(isCampaignNavActive(CAMPAIGN_COMMUNICATION_HOME, CAMPAIGN_COMMUNICATION_HOME)).toBe(true)
    expect(isCampaignNavActive('/campanha/comunicacao/acervo', CAMPAIGN_COMMUNICATION_HOME)).toBe(
      true,
    )
    expect(
      isCampaignNavActive('/campanha/comunicacao/acervo/42', CAMPAIGN_COMMUNICATION_HOME),
    ).toBe(true)
  })
})

describe('communication vertical sub-items (C174, C194)', () => {
  const expectedSubHrefs = [
    CAMPAIGN_COMMUNICATION_ACERVO,
    CAMPAIGN_COMMUNICATION_CORTES,
    CAMPAIGN_COMMUNICATION_REELS,
  ]

  it('hangs the acervo, the cut library and the reels under Comunicação for the communicator', () => {
    const [item] = getCampaignNav('communicator')
    expect(item?.subItems?.map((sub) => sub.href)).toEqual(expectedSubHrefs)
    expect(item?.subItems?.map((sub) => sub.title)).toEqual([
      'Acervo de falas',
      'Biblioteca de cortes',
      'Reels',
    ])
  })

  it('carries the same sub-items for staff with the vertical, and none for advisor', () => {
    const forRole = (role: 'coordinator' | 'candidate' | 'advisor') =>
      getCampaignNav(role).find((item) => item.href === CAMPAIGN_COMMUNICATION_HOME)

    for (const role of ['coordinator', 'candidate'] as const) {
      expect(forRole(role)?.subItems?.map((sub) => sub.href)).toEqual(expectedSubHrefs)
    }
    expect(forRole('advisor')).toBeUndefined()
  })

  it('keeps the sub-items in the mobile overflow drawer (staff)', () => {
    const overflow = getCampaignOverflowNav('coordinator')
    expect(overflow.find((item) => item.href === CAMPAIGN_COMMUNICATION_HOME)?.subItems).toEqual(
      expect.arrayContaining(expectedSubHrefs.map((href) => expect.objectContaining({ href }))),
    )
  })

  it('activates only the most specific sibling (the acervo is a prefix of the cortes path)', () => {
    const subItems = getCampaignNav('communicator')[0]!.subItems!

    expect(activeCampaignSubItemHref(CAMPAIGN_COMMUNICATION_CORTES, subItems)).toBe(
      CAMPAIGN_COMMUNICATION_CORTES,
    )
    expect(activeCampaignSubItemHref(`${CAMPAIGN_COMMUNICATION_CORTES}/42`, subItems)).toBe(
      CAMPAIGN_COMMUNICATION_CORTES,
    )
    expect(activeCampaignSubItemHref(`${CAMPAIGN_COMMUNICATION_ACERVO}/42`, subItems)).toBe(
      CAMPAIGN_COMMUNICATION_ACERVO,
    )
    expect(activeCampaignSubItemHref(CAMPAIGN_COMMUNICATION_ACERVO, subItems)).toBe(
      CAMPAIGN_COMMUNICATION_ACERVO,
    )
    expect(activeCampaignSubItemHref('/campanha/quadro', subItems)).toBeNull()
  })

  it('keeps the parent item active on any path of the vertical', () => {
    expect(isCampaignNavActive(CAMPAIGN_COMMUNICATION_CORTES, CAMPAIGN_COMMUNICATION_HOME)).toBe(
      true,
    )
    expect(
      isCampaignNavActive(`${CAMPAIGN_COMMUNICATION_ACERVO}/42`, CAMPAIGN_COMMUNICATION_HOME),
    ).toBe(true)
  })
})

describe('mobile bottom nav', () => {
  it('offers exactly five primary items to staff, zero to leaders', () => {
    for (const role of ['coordinator', 'advisor', 'candidate'] as const) {
      const items = getCampaignBottomNav(role)
      expect(items).toHaveLength(5)
      expect(items.map((i) => i.title)).toEqual([
        'Início',
        'Municípios',
        'Atualizações',
        'Agenda',
        'Mais',
      ])
      expect(items.map((i) => i.href)).toContain(CAMPAIGN_UPDATES_HREF)
    }
    expect(getCampaignBottomNav('leader')).toHaveLength(0)
  })

  it('keeps Atualizações and Mais out of the overflow drawer', () => {
    const overflow = getCampaignOverflowNav('coordinator').map((i) => i.href)
    expect(overflow).not.toContain(CAMPAIGN_UPDATES_HREF)
    expect(overflow).not.toContain('')
    // The four primaries (minus Mais) must not appear in overflow.
    expect(overflow).not.toContain('/campanha')
    expect(overflow).not.toContain('/campanha/municipios')
    expect(overflow).not.toContain(CAMPAIGN_AGENDA_HOME)
  })

  it('overflow includes secondary nav (Conceitos)', () => {
    const overflow = getCampaignOverflowNav('coordinator').map((i) => i.href)
    expect(overflow).toContain('/campanha/conceitos')
  })

  it('overflow is zero for leaders', () => {
    expect(getCampaignOverflowNav('leader')).toHaveLength(0)
  })

  it('matches Atualizações by prefix', () => {
    expect(isCampaignNavActive(CAMPAIGN_UPDATES_HREF, CAMPAIGN_UPDATES_HREF)).toBe(true)
    expect(isCampaignNavActive(`${CAMPAIGN_UPDATES_HREF}/algum-fio`, CAMPAIGN_UPDATES_HREF)).toBe(
      true,
    )
    expect(isCampaignNavActive('/campanha/mais', CAMPAIGN_UPDATES_HREF)).toBe(false)
  })
})
