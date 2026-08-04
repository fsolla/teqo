import { describe, expect, it } from 'vitest'

import {
  SUPPORTER_CREATE_HREF,
  SUPPORTER_IMPORT_HREF,
  isSupportersListPath,
  isSupportersPath,
  parseSupporterDetailId,
  resolveSupporterDetailQuickActions,
  resolveSupporterListQuickActions,
  resolveSupporterQuickActionsForPath,
} from '@/lib/supporterQuickActions'

describe('supporterQuickActions paths', () => {
  it('matches apoiadores list exactly', () => {
    expect(isSupportersListPath('/campanha/apoiadores')).toBe(true)
    expect(isSupportersListPath('/campanha/apoiadores/')).toBe(true)
    expect(isSupportersListPath('/campanha/apoiadores/novo')).toBe(false)
    expect(isSupportersListPath('/campanha/apoiadores/importar')).toBe(false)
  })

  it('matches apoiadores detail ids', () => {
    expect(parseSupporterDetailId('/campanha/apoiadores/42')).toBe(42)
    expect(parseSupporterDetailId('/campanha/apoiadores/42/')).toBe(42)
    expect(parseSupporterDetailId('/campanha/apoiadores/novo')).toBeUndefined()
    expect(parseSupporterDetailId('/campanha/apoiadores/importar')).toBeUndefined()
    expect(parseSupporterDetailId('/campanha/apoiadores/abc')).toBeUndefined()
    expect(isSupportersPath('/campanha/apoiadores/42')).toBe(true)
    expect(isSupportersPath('/campanha/apoiadores/novo')).toBe(false)
  })
})

describe('resolveSupporterListQuickActions', () => {
  it('returns register-supporter + import-supporters for coordinator', () => {
    const actions = resolveSupporterListQuickActions('coordinator')
    expect(actions.map((action) => action.id)).toEqual(['register-supporter', 'import-supporters'])
    expect(actions[0]?.href).toBe(SUPPORTER_CREATE_HREF)
    expect(actions[1]?.href).toBe(SUPPORTER_IMPORT_HREF)
  })

  it('returns register-supporter only for advisor and candidate', () => {
    for (const role of ['advisor', 'candidate'] as const) {
      const actions = resolveSupporterListQuickActions(role)
      expect(actions.map((action) => action.id)).toEqual(['register-supporter'])
      expect(actions[0]?.href).toBe(SUPPORTER_CREATE_HREF)
    }
  })

  it('returns empty catalog for leader lockdown', () => {
    expect(resolveSupporterListQuickActions('leader')).toEqual([])
  })
})

describe('resolveSupporterDetailQuickActions', () => {
  it('mirrors the list catalog on detail (B86)', () => {
    expect(resolveSupporterDetailQuickActions('coordinator').map((action) => action.id)).toEqual([
      'register-supporter',
      'import-supporters',
    ])
    expect(resolveSupporterDetailQuickActions('advisor').map((action) => action.id)).toEqual([
      'register-supporter',
    ])
    expect(resolveSupporterDetailQuickActions('leader')).toEqual([])
  })
})

describe('resolveSupporterQuickActionsForPath', () => {
  it('delegates list and detail catalogs (B86)', () => {
    const list = resolveSupporterQuickActionsForPath('/campanha/apoiadores', 'coordinator', {})
    expect(list.map((action) => action.id)).toEqual(['register-supporter', 'import-supporters'])

    const detail = resolveSupporterQuickActionsForPath('/campanha/apoiadores/7', 'coordinator', {})
    expect(detail.map((action) => action.id)).toEqual(['register-supporter', 'import-supporters'])
  })

  it('returns empty catalog on form and wizard pages (search-only FAB)', () => {
    expect(
      resolveSupporterQuickActionsForPath('/campanha/apoiadores/novo', 'coordinator', {}),
    ).toEqual([])
    expect(
      resolveSupporterQuickActionsForPath('/campanha/apoiadores/importar', 'coordinator', {}),
    ).toEqual([])
  })

  it('returns empty catalog on non-numeric detail (route 404s)', () => {
    expect(
      resolveSupporterQuickActionsForPath('/campanha/apoiadores/abc', 'coordinator', {}),
    ).toEqual([])
  })

  it('returns empty catalog for leader lockdown', () => {
    expect(resolveSupporterQuickActionsForPath('/campanha/apoiadores', 'leader', {})).toEqual([])
  })
})
