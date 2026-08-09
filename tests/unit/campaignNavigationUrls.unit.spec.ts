// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { campaignConceptHref } from '@/lib/campaignIntelligenceConcepts'
import {
  CAMPAIGN_AGENDA_HOME,
  CAMPAIGN_HOME,
  CAMPAIGN_PROFILE_HOME,
  LEADER_CONTACTS_HOME,
} from '@/lib/campaignPaths'
import type { CampaignUser } from '@/payload-types'
import {
  buildCampaignNavigationLink,
  buildCampaignNavigationLinks,
} from '@/utilities/ai/campaignNavigationUrls'
import { buildMunicipalityListHref } from '@/utilities/municipality/municipalityListUrl'

const coordinator = { role: 'coordinator' } as CampaignUser
const advisor = { role: 'advisor' } as CampaignUser
const leader = { role: 'leader' } as CampaignUser

describe('campaignNavigationUrls', () => {
  it('builds home and detail paths for staff', () => {
    const home = buildCampaignNavigationLink(coordinator.role, { destination: 'home' })
    expect(home).toEqual({ ok: true, path: CAMPAIGN_HOME, label: 'Início' })

    const municipality = buildCampaignNavigationLink(coordinator.role, {
      destination: 'municipality',
      slug: 'ilheus',
      label: 'Ilhéus',
    })
    expect(municipality).toEqual({
      ok: true,
      path: '/campanha/municipios/ilheus',
      label: 'Ilhéus',
    })
  })

  it('rejects invalid municipality slugs', () => {
    const outcome = buildCampaignNavigationLink(coordinator.role, {
      destination: 'municipality',
      slug: 'slug-inventado',
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error).toMatch(/Slug de município inválido/)
    }
  })

  it('accepts the virtual Salvador city slug (B178)', () => {
    const outcome = buildCampaignNavigationLink(coordinator.role, {
      destination: 'municipality',
      slug: 'salvador',
    })
    expect(outcome).toEqual({ ok: true, path: '/campanha/municipios/salvador', label: 'Município' })
  })

  it('delegates municipality list filters to buildMunicipalityListHref', () => {
    const outcome = buildCampaignNavigationLink(coordinator.role, {
      destination: 'municipalityList',
      coverage: 'sem_assessor',
      priority: 'alta',
      advisors: [42],
    })
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.path).toBe(
        buildMunicipalityListHref(
          { page: 1, coverage: 'sem_assessor', priority: 'alta', advisors: [42] },
          1,
        ),
      )
    }
  })

  it('blocks staff destinations for leaders', () => {
    const outcome = buildCampaignNavigationLink(leader.role, {
      destination: 'municipality',
      slug: 'ilheus',
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.alternatives).toEqual([
        CAMPAIGN_HOME,
        LEADER_CONTACTS_HOME,
        CAMPAIGN_PROFILE_HOME,
      ])
    }
  })

  it('allows leader-safe destinations', () => {
    const contacts = buildCampaignNavigationLink(leader.role, { destination: 'leaderContacts' })
    expect(contacts).toEqual({
      ok: true,
      path: LEADER_CONTACTS_HOME,
      label: 'Meus contatos',
    })

    const profile = buildCampaignNavigationLink(leader.role, { destination: 'perfil' })
    expect(profile).toEqual({ ok: true, path: CAMPAIGN_PROFILE_HOME, label: 'Perfil' })
  })

  it('blocks assessor area for advisors', () => {
    const outcome = buildCampaignNavigationLink(advisor.role, {
      destination: 'advisor',
      id: 1,
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) {
      expect(outcome.error).toMatch(/assessores/)
    }
  })

  it('builds concept glossary links with anchors', () => {
    const outcome = buildCampaignNavigationLink(coordinator.role, {
      destination: 'conceitos',
      conceptId: 'captura',
      label: 'Captura',
    })
    expect(outcome).toEqual({
      ok: true,
      path: campaignConceptHref('captura'),
      label: 'Captura',
    })
  })

  it('uses agenda URLs for calendar filters and keeps advanced legacy list links', () => {
    const agenda = buildCampaignNavigationLink(coordinator.role, {
      destination: 'activityList',
      municipality: 12,
      tag: 'Comício',
      deputyPresent: true,
    })
    expect(agenda).toEqual({
      ok: true,
      path: `${CAMPAIGN_AGENDA_HOME}?municipality=12&deputyPresent=1&tag=Com%C3%ADcio`,
      label: 'Agenda',
    })

    const legacy = buildCampaignNavigationLink(coordinator.role, {
      destination: 'activityList',
      q: 'centro',
      tab: 'todos',
    })
    expect(legacy.ok && legacy.path).toBe('/campanha/atividades?q=centro&tab=todos')

    const mixed = buildCampaignNavigationLink(coordinator.role, {
      destination: 'activityList',
      q: 'centro',
      deputyPresent: true,
    })
    expect(mixed.ok).toBe(false)
  })

  it('returns partial success in batch mode', () => {
    const result = buildCampaignNavigationLinks(coordinator.role, [
      { destination: 'home', label: 'Início' },
      { destination: 'municipality', slug: 'slug-invalido' },
    ])
    expect(result.links).toEqual([{ path: CAMPAIGN_HOME, label: 'Início' }])
    expect(result.errors).toHaveLength(1)
    expect(result.errors?.[0]?.index).toBe(1)
  })
})
