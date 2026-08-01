import { describe, expect, it } from 'vitest'

import { CAMPAIGN_ACTIONS_HOME } from '@/lib/campaignActionRoutes'
import { resolveLeadershipQuickActions } from '@/lib/campaignQuickActionLeadership'

describe('resolveLeadershipQuickActions', () => {
  it('returns only update-leadership on the list without prefill', () => {
    const actions = resolveLeadershipQuickActions('/campanha/liderancas', 'coordinator', {})
    expect(actions).toHaveLength(1)
    expect(actions?.[0]?.id).toBe('update-leadership')
    expect(actions?.[0]?.href).toBe(`${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca`)
  })

  it('returns five wizard actions on detail with municipality prefill when N=1', () => {
    const actions = resolveLeadershipQuickActions('/campanha/liderancas/42', 'coordinator', {
      leadershipId: 42,
      municipalitySlug: 'cairu',
    })
    expect(actions?.map((action) => action.id)).toEqual([
      'update-votes',
      'register-signal',
      'change-trend',
      'update-leadership',
      'register-demand',
    ])
    expect(actions?.find((action) => action.id === 'update-votes')?.href).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/atualizar-votos?municipio=cairu`,
    )
    expect(actions?.find((action) => action.id === 'update-leadership')?.href).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/atualizar-lideranca?municipio=cairu&leadershipId=42`,
    )
  })

  it('degrades update-leadership to ficha when N>1 (no municipality slug)', () => {
    const actions = resolveLeadershipQuickActions('/campanha/liderancas/7', 'advisor', {
      leadershipId: 7,
    })
    expect(actions?.find((action) => action.id === 'update-leadership')?.href).toBe(
      '/campanha/liderancas/7',
    )
    expect(actions?.find((action) => action.id === 'update-votes')?.href).toBe(
      `${CAMPAIGN_ACTIONS_HOME}/atualizar-votos`,
    )
  })

  it('returns null outside leadership routes', () => {
    expect(
      resolveLeadershipQuickActions('/campanha/municipios', 'coordinator', {}),
    ).toBeNull()
    expect(resolveLeadershipQuickActions('/campanha/liderancas/nova', 'coordinator', {})).toBeNull()
    expect(resolveLeadershipQuickActions('/campanha/liderancas', 'leader', {})).toBeNull()
  })
})
