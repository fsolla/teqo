import { describe, expect, it } from 'vitest'

import {
  isMunicipalityV2Path,
  parseMunicipalityV2Slug,
  resolveMunicipalityV2QuickActions,
  resolveMunicipalityV2QuickActionsForPath,
} from '@/lib/campaignMunicipalityV2QuickActions'
import { resolveQuickActionsForPath } from '@/lib/campaignQuickActionRegistry'

describe('campaignMunicipalityV2QuickActions paths', () => {
  it('detects the municipality v2 path', () => {
    expect(isMunicipalityV2Path('/campanha/municipio/cairu/v2')).toBe(true)
    expect(isMunicipalityV2Path('/campanha/municipios/cairu')).toBe(false)
    expect(isMunicipalityV2Path('/campanha/municipio/cairu')).toBe(false)
  })

  it('parses municipality v2 slugs', () => {
    expect(parseMunicipalityV2Slug('/campanha/municipio/cairu/v2')).toBe('cairu')
    expect(parseMunicipalityV2Slug('/campanha/municipio/feira-de-santana/v2')).toBe(
      'feira-de-santana',
    )
    expect(parseMunicipalityV2Slug('/campanha/municipios/cairu')).toBeUndefined()
  })
})

describe('resolveMunicipalityV2QuickActions', () => {
  it('lists secondary navigation for staff with municipality prefill', () => {
    const actions = resolveMunicipalityV2QuickActions('coordinator', 'cairu', 42)
    expect(actions.map((action) => action.id)).toEqual([
      'municipality-dossier',
      'municipality-elections',
      'new-leadership',
      'plan-tour',
    ])
    expect(actions.find((action) => action.id === 'municipality-dossier')?.href).toBe(
      '/campanha/municipios/cairu?tab=dossie',
    )
    expect(actions.find((action) => action.id === 'municipality-elections')?.href).toBe(
      '/campanha/municipios/cairu?tab=elections',
    )
    expect(actions.find((action) => action.id === 'new-leadership')?.href).toBe(
      '/campanha/liderancas/nova?municipality=42',
    )
    expect(actions.find((action) => action.id === 'plan-tour')?.href).toContain(
      '/campanha/atividades/giros?region=',
    )
  })

  it('omits register-signal and wizard operational actions', () => {
    const actions = resolveMunicipalityV2QuickActions('advisor', 'cairu', 1)
    expect(actions.some((action) => action.id === 'register-signal')).toBe(false)
    expect(actions.some((action) => action.id === 'update-votes')).toBe(false)
  })

  it('returns nothing for leader', () => {
    expect(resolveMunicipalityV2QuickActions('leader', 'cairu', 1)).toEqual([])
  })

  it('omits new-leadership without municipality id', () => {
    const actions = resolveMunicipalityV2QuickActions('coordinator', 'cairu')
    expect(actions.map((action) => action.id)).toEqual([
      'municipality-dossier',
      'municipality-elections',
      'plan-tour',
    ])
  })
})

describe('resolveMunicipalityV2QuickActionsForPath', () => {
  it('returns null outside v2', () => {
    expect(
      resolveMunicipalityV2QuickActionsForPath('/campanha/municipios/cairu', 'coordinator', {}),
    ).toBeNull()
  })

  it('prefers context slug over pathname', () => {
    const actions = resolveMunicipalityV2QuickActionsForPath(
      '/campanha/municipio/feira-de-santana/v2',
      'coordinator',
      { municipalitySlug: 'cairu', municipalityId: 7 },
    )
    expect(actions?.find((action) => action.id === 'municipality-dossier')?.href).toContain(
      '/campanha/municipios/cairu',
    )
    expect(actions?.find((action) => action.id === 'new-leadership')?.href).toContain(
      'municipality=7',
    )
  })
})

describe('campaignQuickActionRegistry municipality v2', () => {
  it('returns v2 secondary actions instead of wizard catalog', () => {
    const actions = resolveQuickActionsForPath('/campanha/municipio/cairu/v2', 'coordinator', {
      municipalitySlug: 'cairu',
      municipalityId: 99,
    })
    expect(actions.map((action) => action.id)).toEqual([
      'municipality-dossier',
      'municipality-elections',
      'new-leadership',
      'plan-tour',
    ])
  })
})
