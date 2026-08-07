import { describe, expect, it } from 'vitest'

import { resolveActivityQuickActions } from '@/lib/activityQuickActions'
import { CAMPAIGN_WIZARD_ACTION_SLUGS } from '@/lib/campaignActionRoutes'
import { advisorQuickCreateHref } from '@/lib/campaignAdvisorQuickActions'
import { UNCOVERED_MUNICIPALITIES_LIST_HREF, homeActionsForRole } from '@/lib/campaignHomeActions'
import { CAMPAIGN_CONCEPTS_PATH } from '@/lib/campaignIntelligenceConcepts'
import { CAMPAIGN_PROFILE_HOME } from '@/lib/campaignPaths'
import {
  CAMPAIGN_DEMANDS_CREATE_HREF,
  demandCreateHref,
  isDemandDetailPath,
  isDemandsListPath,
  resolveDemandDetailQuickActions,
  resolveDemandsListQuickActions,
} from '@/lib/campaignQuickActionDemands'
import {
  matchesDobradinhasQuickActionSurface,
  parseStateDeputyDetailSlug,
  resolveDobradinhasQuickActions,
} from '@/lib/campaignQuickActionDobradinhas'
import {
  isCampaignActionsPath,
  isCampaignHomePath,
  isLeaderContactsPath,
  shouldMountQuickActionsFab,
} from '@/lib/campaignQuickActionMount'
import {
  ACTIVITY_LIST_PATH,
  ACTIVITY_NEW_PATH,
  ACTIVITY_TOUR_COMPOSER_PATH,
  ORGANIZATIONS_LIST_PATH,
  ORGANIZATION_NEW_PATH,
  isActivityTourComposerPath,
  isListPath,
  normalizePathname,
  parseActivityQuickActionSurface,
  parseOrganizationQuickActionSurface,
} from '@/lib/campaignQuickActionPaths'
import { resolveQuickActionsForPath } from '@/lib/campaignQuickActionRegistry'
import { resolveOrganizationQuickActions } from '@/lib/organizationQuickActions'
import { SUPPORTER_CREATE_HREF, SUPPORTER_IMPORT_HREF } from '@/lib/supporterQuickActions'

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
    expect(shouldMountQuickActionsFab('/campanha/municipios', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha/territorios', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha/demandas', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha/demandas/foo', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha/apoiadores', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha/apoiadores/42', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha', 'coordinator')).toBe(false)
    expect(shouldMountQuickActionsFab('/campanha/acoes/registrar-atualizacao', 'advisor')).toBe(
      false,
    )
  })

  it('mounts for leader only on contacts', () => {
    expect(shouldMountQuickActionsFab('/campanha/contatos', 'leader')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha/municipios', 'leader')).toBe(false)
    expect(shouldMountQuickActionsFab('/campanha/apoiadores', 'leader')).toBe(false)
  })

  it('skips the E13 tour composer (B84)', () => {
    expect(isActivityTourComposerPath(ACTIVITY_TOUR_COMPOSER_PATH)).toBe(true)
    expect(shouldMountQuickActionsFab(ACTIVITY_TOUR_COMPOSER_PATH, 'coordinator')).toBe(false)
  })

  it('mounts assessores only for unrestricted roles (B87)', () => {
    expect(shouldMountQuickActionsFab('/campanha/assessores', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha/assessores/12', 'candidate')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha/assessores', 'advisor')).toBe(false)
    expect(shouldMountQuickActionsFab('/campanha/assessores/12', 'advisor')).toBe(false)
  })

  it('mounts on dobradinhas for staff (B83)', () => {
    expect(shouldMountQuickActionsFab('/campanha/dobradinhas', 'coordinator')).toBe(true)
    expect(shouldMountQuickActionsFab('/campanha/dobradinhas/foo', 'advisor')).toBe(true)
  })

  it('omits FAB on perfil for leader (B90)', () => {
    expect(shouldMountQuickActionsFab(CAMPAIGN_PROFILE_HOME, 'leader')).toBe(false)
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

describe('campaignQuickActionPaths (shared list helpers, C86+)', () => {
  it('matches exactly with an optional trailing slash', () => {
    expect(isListPath('/campanha/demandas', '/campanha/demandas')).toBe(true)
    expect(isListPath('/campanha/demandas/', '/campanha/demandas')).toBe(true)
  })

  it('rejects siblings and descendants', () => {
    expect(isListPath('/campanha/demandas/nova', '/campanha/demandas')).toBe(false)
    expect(isListPath('/campanha/demandas/pedido-cairu', '/campanha/demandas')).toBe(false)
    expect(isListPath('/campanha/municipios', '/campanha/demandas')).toBe(false)
  })

  it('normalizes a single trailing slash while preserving /', () => {
    expect(normalizePathname('/campanha/')).toBe('/campanha')
    expect(normalizePathname('/campanha')).toBe('/campanha')
    expect(normalizePathname('/')).toBe('/')
    expect(normalizePathname('/campanha/apoiadores/')).toBe('/campanha/apoiadores')
    expect(normalizePathname('/campanha//')).toBe('/campanha/')
  })

  it('pins the degenerate inputs the inline matchers used to handle', () => {
    expect(isListPath('/campanha/demandas//', '/campanha/demandas')).toBe(false)
    expect(isListPath('', '/campanha/demandas')).toBe(false)
    expect(isListPath('/', '/')).toBe(true)
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

describe('campaignQuickActionDobradinhas (B83)', () => {
  const staffActionIds = homeActionsForRole('coordinator').map((action) => action.id)

  it('recognizes list, create and detail surfaces', () => {
    expect(matchesDobradinhasQuickActionSurface('/campanha/dobradinhas')).toBe(true)
    expect(matchesDobradinhasQuickActionSurface('/campanha/dobradinhas/nova')).toBe(true)
    expect(matchesDobradinhasQuickActionSurface('/campanha/dobradinhas/eduardo-alves')).toBe(true)
    expect(matchesDobradinhasQuickActionSurface('/campanha/municipios')).toBe(false)
  })

  it('parses detail slug and rejects nova', () => {
    expect(parseStateDeputyDetailSlug('/campanha/dobradinhas/eduardo-alves')).toBe('eduardo-alves')
    expect(parseStateDeputyDetailSlug('/campanha/dobradinhas/nova')).toBeUndefined()
  })

  it('returns list catalog with Nova dobradinha plus staff Início actions without prefill', () => {
    const actions = resolveDobradinhasQuickActions('/campanha/dobradinhas', 'coordinator')
    expect(actions.map((action) => action.id)).toEqual(['new-state-deputy', ...staffActionIds])
    expect(actions[0]?.href).toBe('/campanha/dobradinhas/nova')
    expect(actions.find((action) => action.id === 'update-votes')?.href).toBe(
      '/campanha/acoes/atualizar-votos?from=%2Fcampanha%2Fdobradinhas',
    )
    expect(actions.find((action) => action.id === 'uncovered-municipalities')?.href).toBe(
      UNCOVERED_MUNICIPALITIES_LIST_HREF,
    )
  })

  it('returns staff actions without Nova on detail and create', () => {
    for (const pathname of ['/campanha/dobradinhas/eduardo-alves', '/campanha/dobradinhas/nova']) {
      const actions = resolveDobradinhasQuickActions(pathname, 'advisor')
      expect(actions.map((action) => action.id)).toEqual(staffActionIds)
      expect(actions.some((action) => action.id === 'new-state-deputy')).toBe(false)
    }
  })

  it('returns empty for leader lockdown', () => {
    expect(resolveDobradinhasQuickActions('/campanha/dobradinhas', 'leader')).toEqual([])
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

  it('returns leadership list catalog on /liderancas (B82)', () => {
    const actions = resolveQuickActionsForPath('/campanha/liderancas', 'coordinator', {})
    expect(actions).toHaveLength(1)
    expect(actions[0]?.id).toBe('update-leadership')
  })

  it('returns empty catalog for unregistered paths', () => {
    expect(resolveQuickActionsForPath('/campanha/lugar-inexistente', 'coordinator', {})).toEqual([])
  })

  it('returns empty catalog on conceitos and perfil for staff (B90)', () => {
    expect(resolveQuickActionsForPath(CAMPAIGN_CONCEPTS_PATH, 'coordinator', {})).toEqual([])
    expect(resolveQuickActionsForPath(CAMPAIGN_PROFILE_HOME, 'candidate', {})).toEqual([])
  })

  it('delegates municipality list and detail catalogs (B80)', () => {
    const list = resolveQuickActionsForPath('/campanha/municipios', 'coordinator', {})
    expect(list).toHaveLength(6)

    const detail = resolveQuickActionsForPath('/campanha/municipios/foo', 'coordinator', {
      municipalitySlug: 'foo',
    })
    expect(detail).toHaveLength(5)
    expect(detail.find((action) => action.id === 'update-votes')?.href).toBe(
      '/campanha/acoes/atualizar-votos?municipio=foo&from=%2Fcampanha%2Fmunicipios%2Ffoo',
    )
  })

  it('delegates activity routes to the B84 catalog', () => {
    const actions = resolveQuickActionsForPath(ACTIVITY_LIST_PATH, 'coordinator', {})
    expect(actions.map((action) => action.id)).toEqual(['new-activity', 'plan-tour'])
  })

  it('delegates dobradinhas paths to the B83 catalog', () => {
    const actions = resolveQuickActionsForPath('/campanha/dobradinhas', 'coordinator', {})
    expect(actions.some((action) => action.id === 'new-state-deputy')).toBe(true)
  })

  it('builds wizard hrefs with municipality slug from context', () => {
    const actions = resolveQuickActionsForPath(
      '/campanha/atividades/evento-zona-1',
      'coordinator',
      {
        municipalitySlug: 'salvador-ze-01',
      },
    )
    const registerUpdate = actions.find((action) => action.id === 'register-update')
    expect(registerUpdate?.href).toBe(
      `/campanha/acoes/${CAMPAIGN_WIZARD_ACTION_SLUGS['register-update']}?municipio=salvador-ze-01&from=%2Fcampanha%2Fatividades%2Fevento-zona-1`,
    )
  })

  it('returns staff Início catalog on territorios without municipality prefill (B81)', () => {
    const actions = resolveQuickActionsForPath('/campanha/territorios', 'coordinator', {})
    expect(actions.map((action) => action.id)).toEqual(staffActionIds)
    expect(actions.find((action) => action.id === 'update-votes')?.href).toBe(
      '/campanha/acoes/atualizar-votos?from=%2Fcampanha%2Fterritorios',
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
      'register-update',
      'change-trend',
      'update-leadership',
      'register-demand',
    ])
    expect(actions.find((action) => action.id === 'update-votes')?.href).toBe(
      '/campanha/acoes/atualizar-votos?municipio=cairu&from=%2Fcampanha%2Fdemandas%2Fpedido-cairu',
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

  it('delegates assessores list and detail catalogs (B87)', () => {
    const list = resolveQuickActionsForPath('/campanha/assessores', 'coordinator', {})
    expect(list.map((action) => action.id)).toEqual(['new-advisor'])
    expect(list[0]?.href).toBe(advisorQuickCreateHref)

    const detail = resolveQuickActionsForPath('/campanha/assessores/9', 'candidate', {})
    expect(detail.map((action) => action.id)).toEqual(['new-advisor'])
    expect(detail[0]?.href).toBe(advisorQuickCreateHref)
  })

  it('returns empty catalog on assessores for advisor lockdown', () => {
    expect(resolveQuickActionsForPath('/campanha/assessores', 'advisor', {})).toEqual([])
  })

  it('delegates apoiadores list and detail catalogs (B86)', () => {
    const list = resolveQuickActionsForPath('/campanha/apoiadores', 'coordinator', {})
    expect(list.map((action) => action.id)).toEqual(['register-supporter', 'import-supporters'])
    expect(list[0]?.href).toBe(SUPPORTER_CREATE_HREF)
    expect(list[1]?.href).toBe(SUPPORTER_IMPORT_HREF)

    const advisorList = resolveQuickActionsForPath('/campanha/apoiadores', 'advisor', {})
    expect(advisorList.map((action) => action.id)).toEqual(['register-supporter'])

    const detail = resolveQuickActionsForPath('/campanha/apoiadores/9', 'candidate', {})
    expect(detail.map((action) => action.id)).toEqual(['register-supporter'])

    const listTrailingSlash = resolveQuickActionsForPath('/campanha/apoiadores/', 'advisor', {})
    expect(listTrailingSlash.map((action) => action.id)).toEqual(['register-supporter'])

    const detailTrailingSlash = resolveQuickActionsForPath(
      '/campanha/apoiadores/9/',
      'candidate',
      {},
    )
    expect(detailTrailingSlash.map((action) => action.id)).toEqual(['register-supporter'])

    expect(resolveQuickActionsForPath('/campanha/apoiadores', 'leader', {})).toEqual([])
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
      resolveDemandDetailQuickActions(
        'leader',
        { municipalitySlug: 'cairu', municipalityId: 1 },
        '/campanha/demandas/foo',
      ),
    ).toEqual([])
  })
})
