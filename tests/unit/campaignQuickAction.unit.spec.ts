import { describe, expect, it } from 'vitest'

import { resolveActivityQuickActions } from '@/lib/activityQuickActions'
import { CAMPAIGN_WIZARD_ACTION_SLUGS } from '@/lib/campaignActionRoutes'
import { UNCOVERED_MUNICIPALITIES_LIST_HREF, homeActionsForRole } from '@/lib/campaignHomeActions'
import {
  CAMPAIGN_DEMANDS_CREATE_HREF,
  demandCreateHref,
  isDemandDetailPath,
  isDemandsListPath,
  resolveDemandDetailQuickActions,
  resolveDemandsListQuickActions,
} from '@/lib/campaignQuickActionDemands'
import {
  isCampaignActionsPath,
  isCampaignHomePath,
  isLeaderContactsPath,
  shouldMountQuickActionsDrawer,
} from '@/lib/campaignQuickActionMount'
import {
  ACTIVITY_LIST_PATH,
  ACTIVITY_NEW_PATH,
  ACTIVITY_TOUR_COMPOSER_PATH,
  ORGANIZATIONS_LIST_PATH,
  ORGANIZATION_NEW_PATH,
  isActivityTourComposerPath,
  parseActivityQuickActionSurface,
  parseOrganizationQuickActionSurface,
} from '@/lib/campaignQuickActionPaths'
import { resolveQuickActionsForPath } from '@/lib/campaignQuickActionRegistry'
import {
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_EXPANDED,
  quickActionsSnapIsExpanded,
} from '@/lib/campaignQuickActionSnap'
import { resolveOrganizationQuickActions } from '@/lib/organizationQuickActions'

describe('campaignQuickActionMount', () => {
  it('treats Início as exact match only', () => {
    expect(isCampaignHomePath('/campanha')).toBe(true)
    expect(isCampaignHomePath('/campanha/')).toBe(true)
    expect(isCampaignHomePath('/campanha/municipios')).toBe(false)
  })

  it('matches action wizard subtree', () => {
    expect(isCampaignActionsPath('/campanha/acoes')).toBe(true)
    expect(isCampaignActionsPath('/campanha/acoes/atualizar-votos')).toBe(true)
    expect(isCampaignActionsPath('/campanha/municipios')).toBe(false)
  })

  it('matches leader contacts subtree', () => {
    expect(isLeaderContactsPath('/campanha/contatos')).toBe(true)
    expect(isLeaderContactsPath('/campanha/contatos/novo')).toBe(true)
    expect(isLeaderContactsPath('/campanha')).toBe(false)
  })

  it('mounts for staff outside Início and acoes', () => {
    expect(shouldMountQuickActionsDrawer('/campanha/municipios', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsDrawer('/campanha/territorios', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsDrawer('/campanha/demandas', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsDrawer('/campanha/demandas/foo', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsDrawer('/campanha', 'coordinator')).toBe(false)
    expect(shouldMountQuickActionsDrawer('/campanha/acoes/registrar-sinal', 'advisor')).toBe(false)
  })

  it('mounts for leader only on contacts', () => {
    expect(shouldMountQuickActionsDrawer('/campanha/contatos', 'leader')).toBe(true)
    expect(shouldMountQuickActionsDrawer('/campanha/municipios', 'leader')).toBe(false)
  })

  it('skips the E13 tour composer (B84)', () => {
    expect(isActivityTourComposerPath(ACTIVITY_TOUR_COMPOSER_PATH)).toBe(true)
    expect(shouldMountQuickActionsDrawer(ACTIVITY_TOUR_COMPOSER_PATH, 'coordinator')).toBe(false)
  })
})

describe('campaignQuickActionPaths (activities)', () => {
  it('parses list and detail surfaces', () => {
    expect(parseActivityQuickActionSurface(ACTIVITY_LIST_PATH)).toEqual({ kind: 'list' })
    expect(parseActivityQuickActionSurface(`${ACTIVITY_LIST_PATH}/`)).toEqual({ kind: 'list' })
    expect(parseActivityQuickActionSurface('/campanha/atividades/caminhada-centro')).toEqual({
      kind: 'detail',
      activitySlug: 'caminhada-centro',
    })
  })

  it('ignores nova, giros and nested edit routes', () => {
    expect(parseActivityQuickActionSurface(ACTIVITY_NEW_PATH)).toBeNull()
    expect(parseActivityQuickActionSurface(ACTIVITY_TOUR_COMPOSER_PATH)).toBeNull()
    expect(parseActivityQuickActionSurface('/campanha/atividades/foo/editar')).toBeNull()
  })
})

describe('organizationQuickActions (B88)', () => {
  it('parses list and detail surfaces', () => {
    expect(parseOrganizationQuickActionSurface(ORGANIZATIONS_LIST_PATH)).toEqual({ kind: 'list' })
    expect(parseOrganizationQuickActionSurface(`${ORGANIZATIONS_LIST_PATH}/`)).toEqual({
      kind: 'list',
    })
    expect(parseOrganizationQuickActionSurface('/campanha/organizacoes/sindmed')).toEqual({
      kind: 'detail',
      organizationSlug: 'sindmed',
    })
  })

  it('ignores nova and nested routes', () => {
    expect(parseOrganizationQuickActionSurface(ORGANIZATION_NEW_PATH)).toBeNull()
    expect(parseOrganizationQuickActionSurface('/campanha/organizacoes/foo/editar')).toBeNull()
  })

  it('lists new-organization on the catalog page', () => {
    const actions = resolveOrganizationQuickActions({ kind: 'list' }, 'coordinator', {})
    expect(actions.map((action) => action.id)).toEqual(['new-organization'])
    expect(actions[0]?.href).toBe(ORGANIZATION_NEW_PATH)
  })

  it('returns empty detail catalog without leadership filter URL', () => {
    expect(
      resolveOrganizationQuickActions(
        { kind: 'detail', organizationSlug: 'sindmed' },
        'coordinator',
        { organizationSlug: 'sindmed' },
      ),
    ).toEqual([])
  })

  it('returns empty catalog for leader lockdown', () => {
    expect(resolveOrganizationQuickActions({ kind: 'list' }, 'leader', {})).toEqual([])
  })
})

describe('activityQuickActions (B84)', () => {
  it('lists vertical verbs on the activity list', () => {
    const actions = resolveActivityQuickActions({ kind: 'list' }, 'coordinator', {})
    expect(actions.map((action) => action.id)).toEqual(['new-activity', 'plan-tour'])
    expect(actions[0]?.href).toBe(ACTIVITY_NEW_PATH)
    expect(actions[1]?.href).toBe(ACTIVITY_TOUR_COMPOSER_PATH)
  })

  it('prefills wizards and detail shortcuts on activity detail', () => {
    const actions = resolveActivityQuickActions(
      { kind: 'detail', activitySlug: 'comicio-feira' },
      'coordinator',
      { activitySlug: 'comicio-feira', municipalitySlug: 'feira-de-santana' },
    )

    expect(actions.some((action) => action.id === 'update-votes')).toBe(true)
    expect(
      actions
        .find((action) => action.id === 'update-votes')
        ?.href?.includes('municipio=feira-de-santana'),
    ).toBe(true)
    expect(actions.find((action) => action.id === 'edit-activity')?.href).toBe(
      '/campanha/atividades/comicio-feira/editar',
    )
    expect(actions.find((action) => action.id === 'activity-tasks')?.href).toBe(
      '/campanha/atividades/comicio-feira?tab=tasks',
    )
  })

  it('omits wizard prefills without municipality context', () => {
    const actions = resolveActivityQuickActions(
      { kind: 'detail', activitySlug: 'panfletagem' },
      'advisor',
      { activitySlug: 'panfletagem' },
    )

    expect(actions.some((action) => action.id === 'register-demand')).toBe(false)
    expect(actions.map((action) => action.id)).toEqual([
      'edit-activity',
      'activity-tasks',
      'activity-updates',
    ])
  })
})

describe('campaignQuickActionRegistry', () => {
  const staffActionIds = homeActionsForRole('coordinator').map((action) => action.id)

  it('delegates organization routes to the B88 catalog', () => {
    const actions = resolveQuickActionsForPath(ORGANIZATIONS_LIST_PATH, 'coordinator', {})
    expect(actions.map((action) => action.id)).toEqual(['new-organization'])
    expect(actions[0]?.href).toBe(ORGANIZATION_NEW_PATH)
  })

  it('returns empty organization detail catalog in the registry', () => {
    expect(
      resolveQuickActionsForPath('/campanha/organizacoes/sindmed', 'advisor', {
        organizationSlug: 'sindmed',
      }),
    ).toEqual([])
  })

  it('returns empty catalog for unregistered paths', () => {
    expect(resolveQuickActionsForPath('/campanha/apoiadores', 'coordinator', {})).toEqual([])
  })

  it('delegates municipality list and detail catalogs (B80)', () => {
    const list = resolveQuickActionsForPath('/campanha/municipios', 'coordinator', {})
    expect(list).toHaveLength(6)

    const detail = resolveQuickActionsForPath('/campanha/municipios/foo', 'coordinator', {
      municipalitySlug: 'foo',
    })
    expect(detail).toHaveLength(5)
    expect(detail.find((action) => action.id === 'update-votes')?.href).toBe(
      '/campanha/acoes/atualizar-votos?municipio=foo',
    )
  })

  it('delegates activity routes to the B84 catalog', () => {
    const actions = resolveQuickActionsForPath(ACTIVITY_LIST_PATH, 'coordinator', {})
    expect(actions.map((action) => action.id)).toEqual(['new-activity', 'plan-tour'])
  })

  it('builds wizard hrefs with municipality slug from context', () => {
    const actions = resolveQuickActionsForPath(
      '/campanha/atividades/evento-zona-1',
      'coordinator',
      {
        municipalitySlug: 'salvador-ze-01',
      },
    )
    const registerSignal = actions.find((action) => action.id === 'register-signal')
    expect(registerSignal?.href).toBe(
      `/campanha/acoes/${CAMPAIGN_WIZARD_ACTION_SLUGS['register-signal']}?municipio=salvador-ze-01`,
    )
  })

  it('returns staff Início catalog on territorios without municipality prefill (B81)', () => {
    const actions = resolveQuickActionsForPath('/campanha/territorios', 'coordinator', {})
    expect(actions.map((action) => action.id)).toEqual(staffActionIds)
    expect(actions.find((action) => action.id === 'update-votes')?.href).toBe(
      '/campanha/acoes/atualizar-votos',
    )
    expect(actions.find((action) => action.id === 'uncovered-municipalities')?.href).toBe(
      UNCOVERED_MUNICIPALITIES_LIST_HREF,
    )
    for (const action of actions) {
      expect(action.href).not.toContain('municipio=')
    }
  })

  it('returns empty catalog on territorios for leader lockdown', () => {
    expect(resolveQuickActionsForPath('/campanha/territorios', 'leader', {})).toEqual([])
  })

  it('returns single register-demand launcher on demandas list (B85)', () => {
    const actions = resolveQuickActionsForPath('/campanha/demandas', 'coordinator', {})
    expect(actions.map((action) => action.id)).toEqual(['register-demand'])
    expect(actions[0]?.href).toBe(CAMPAIGN_DEMANDS_CREATE_HREF)
    expect(actions[0]?.href).not.toContain('municipio=')
  })

  it('returns A1–A5 prefilled on demand detail when municipality context is set (B85)', () => {
    const actions = resolveQuickActionsForPath('/campanha/demandas/pedido-cairu', 'coordinator', {
      municipalitySlug: 'cairu',
      municipalityId: 42,
      demandSlug: 'pedido-cairu',
    })
    expect(actions.map((action) => action.id)).toEqual([
      'update-votes',
      'register-signal',
      'change-trend',
      'update-leadership',
      'register-demand',
    ])
    expect(actions.find((action) => action.id === 'update-votes')?.href).toBe(
      '/campanha/acoes/atualizar-votos?municipio=cairu',
    )
    expect(actions.find((action) => action.id === 'register-demand')?.href).toBe(
      demandCreateHref(42),
    )
    expect(actions.some((action) => action.id === 'uncovered-municipalities')).toBe(false)
  })

  it('returns empty catalog on demand detail without municipality context', () => {
    expect(
      resolveQuickActionsForPath('/campanha/demandas/pedido-cairu', 'coordinator', {}),
    ).toEqual([])
  })
})

describe('campaignQuickActionDemands paths', () => {
  it('matches list and detail paths but not nova', () => {
    expect(isDemandsListPath('/campanha/demandas')).toBe(true)
    expect(isDemandsListPath('/campanha/demandas/')).toBe(true)
    expect(isDemandDetailPath('/campanha/demandas/pedido-cairu')).toBe(true)
    expect(isDemandDetailPath('/campanha/demandas/nova')).toBe(false)
    expect(isDemandDetailPath('/campanha/demandas')).toBe(false)
  })
})

describe('campaignQuickActionDemands resolvers', () => {
  it('returns empty catalog for leader lockdown', () => {
    expect(resolveDemandsListQuickActions('leader')).toEqual([])
    expect(
      resolveDemandDetailQuickActions('leader', { municipalitySlug: 'cairu', municipalityId: 1 }),
    ).toEqual([])
  })
})

describe('campaignQuickActionSnap', () => {
  it('detects expanded snap', () => {
    expect(quickActionsSnapIsExpanded(QUICK_ACTIONS_SNAP_EXPANDED)).toBe(true)
    expect(quickActionsSnapIsExpanded(QUICK_ACTIONS_SNAP_COLLAPSED)).toBe(false)
    expect(quickActionsSnapIsExpanded(null)).toBe(false)
  })
})
