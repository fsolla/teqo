import { describe, expect, it } from 'vitest'

import {
  advisorQuickCreateHref,
  isAdvisorsListPath,
  isAdvisorsPath,
  parseAdvisorDetailId,
  resolveAdvisorDetailQuickActions,
  resolveAdvisorListQuickActions,
  resolveAdvisorQuickActionsForPath,
} from '@/lib/campaignAdvisorQuickActions'

describe('campaignAdvisorQuickActions paths', () => {
  it('matches assessores list exactly', () => {
    expect(isAdvisorsListPath('/campanha/assessores')).toBe(true)
    expect(isAdvisorsListPath('/campanha/assessores/')).toBe(true)
    expect(isAdvisorsListPath('/campanha/assessores/novo')).toBe(false)
  })

  it('matches assessores detail ids', () => {
    expect(parseAdvisorDetailId('/campanha/assessores/42')).toBe(42)
    expect(parseAdvisorDetailId('/campanha/assessores/42/')).toBe(42)
    expect(parseAdvisorDetailId('/campanha/assessores/novo')).toBeUndefined()
    expect(isAdvisorsPath('/campanha/assessores/42')).toBe(true)
  })
})

describe('resolveAdvisorListQuickActions', () => {
  it('returns new-advisor for unrestricted roles', () => {
    const actions = resolveAdvisorListQuickActions('coordinator')
    expect(actions).toHaveLength(1)
    expect(actions[0]?.id).toBe('new-advisor')
    expect(actions[0]?.href).toBe(advisorQuickCreateHref)
  })

  it('returns empty catalog for advisor lockdown', () => {
    expect(resolveAdvisorListQuickActions('advisor')).toEqual([])
  })
})

describe('resolveAdvisorDetailQuickActions', () => {
  it('returns new-advisor for unrestricted roles', () => {
    const actions = resolveAdvisorDetailQuickActions('candidate')
    expect(actions.map((action) => action.id)).toEqual(['new-advisor'])
    expect(actions[0]?.href).toBe(advisorQuickCreateHref)
  })
})

describe('resolveAdvisorQuickActionsForPath', () => {
  it('delegates list and detail catalogs (B87)', () => {
    const list = resolveAdvisorQuickActionsForPath('/campanha/assessores', 'coordinator', {})
    expect(list.map((action) => action.id)).toEqual(['new-advisor'])

    const detail = resolveAdvisorQuickActionsForPath('/campanha/assessores/7', 'coordinator', {})
    expect(detail.map((action) => action.id)).toEqual(['new-advisor'])
  })

  it('returns empty catalog for advisor role even on assessores paths', () => {
    expect(resolveAdvisorQuickActionsForPath('/campanha/assessores', 'advisor', {})).toEqual([])
  })
})
