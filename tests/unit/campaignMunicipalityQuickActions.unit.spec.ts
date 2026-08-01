import { describe, expect, it } from 'vitest'

import { CAMPAIGN_WIZARD_ACTION_SLUGS } from '@/lib/campaignActionRoutes'
import { UNCOVERED_MUNICIPALITIES_LIST_HREF } from '@/lib/campaignHomeActions'
import {
  isMunicipalitiesListPath,
  parseMunicipalityDetailSlug,
  resolveMunicipalityDetailQuickActions,
  resolveMunicipalityListQuickActions,
  resolveMunicipalityQuickActionsForPath,
} from '@/lib/campaignMunicipalityQuickActions'

const wizardActionIds = [
  'update-votes',
  'register-signal',
  'change-trend',
  'update-leadership',
  'register-demand',
] as const

describe('campaignMunicipalityQuickActions paths', () => {
  it('detects the municipality list path', () => {
    expect(isMunicipalitiesListPath('/campanha/municipios')).toBe(true)
    expect(isMunicipalitiesListPath('/campanha/municipios/')).toBe(true)
    expect(isMunicipalitiesListPath('/campanha/municipios/cairu')).toBe(false)
  })

  it('parses municipality detail slugs', () => {
    expect(parseMunicipalityDetailSlug('/campanha/municipios/cairu')).toBe('cairu')
    expect(parseMunicipalityDetailSlug('/campanha/municipios/cairu/editar')).toBe('cairu')
    expect(parseMunicipalityDetailSlug('/campanha/municipios')).toBeUndefined()
  })
})

describe('resolveMunicipalityListQuickActions', () => {
  it('mirrors the Início staff catalog without municipality prefill', () => {
    const actions = resolveMunicipalityListQuickActions('coordinator')
    expect(actions.map((action) => action.id)).toEqual([
      ...wizardActionIds,
      'uncovered-municipalities',
    ])
    expect(actions.find((action) => action.id === 'update-votes')?.href).toBe(
      '/campanha/acoes/atualizar-votos',
    )
    expect(actions.find((action) => action.id === 'uncovered-municipalities')?.href).toBe(
      UNCOVERED_MUNICIPALITIES_LIST_HREF,
    )
  })

  it('returns nothing for leader', () => {
    expect(resolveMunicipalityListQuickActions('leader')).toEqual([])
  })
})

describe('resolveMunicipalityDetailQuickActions', () => {
  it('prefills wizard hrefs and omits uncovered municipalities', () => {
    const actions = resolveMunicipalityDetailQuickActions('coordinator', 'cairu')
    expect(actions.map((action) => action.id)).toEqual([...wizardActionIds])
    expect(actions.find((action) => action.id === 'update-votes')?.href).toBe(
      `/campanha/acoes/${CAMPAIGN_WIZARD_ACTION_SLUGS['update-votes']}?municipio=cairu`,
    )
    expect(actions.some((action) => action.id === 'uncovered-municipalities')).toBe(false)
  })
})

describe('resolveMunicipalityQuickActionsForPath', () => {
  it('routes list and detail paths', () => {
    const list = resolveMunicipalityQuickActionsForPath('/campanha/municipios', 'advisor', {})
    expect(list).toHaveLength(6)

    const detail = resolveMunicipalityQuickActionsForPath(
      '/campanha/municipios/feira-de-santana',
      'candidate',
      {},
    )
    expect(detail).toHaveLength(5)
    expect(detail[0]?.href).toContain('municipio=feira-de-santana')
  })

  it('prefers context slug over pathname', () => {
    const actions = resolveMunicipalityQuickActionsForPath(
      '/campanha/municipios/feira-de-santana',
      'coordinator',
      { municipalitySlug: 'cairu' },
    )
    expect(actions.find((action) => action.id === 'update-votes')?.href).toContain(
      'municipio=cairu',
    )
  })
})
