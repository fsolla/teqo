import { describe, expect, it } from 'vitest'

import {
  isCampaignActionsPath,
  isCampaignHomePath,
  isLeaderContactsPath,
  shouldMountQuickActionsDrawer,
} from '@/lib/campaignQuickActionMount'
import { resolveQuickActionsForPath } from '@/lib/campaignQuickActionRegistry'
import {
  QUICK_ACTIONS_SNAP_COLLAPSED,
  QUICK_ACTIONS_SNAP_EXPANDED,
  quickActionsSnapIsExpanded,
} from '@/lib/campaignQuickActionSnap'
import {
  UNCOVERED_MUNICIPALITIES_LIST_HREF,
  homeActionsForRole,
} from '@/lib/campaignHomeActions'

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
    expect(shouldMountQuickActionsDrawer('/campanha', 'coordinator')).toBe(false)
    expect(shouldMountQuickActionsDrawer('/campanha/acoes/registrar-sinal', 'advisor')).toBe(false)
  })

  it('mounts for leader only on contacts', () => {
    expect(shouldMountQuickActionsDrawer('/campanha/contatos', 'leader')).toBe(true)
    expect(shouldMountQuickActionsDrawer('/campanha/municipios', 'leader')).toBe(false)
  })
})

describe('campaignQuickActionRegistry', () => {
  const staffActionIds = homeActionsForRole('coordinator').map((action) => action.id)

  it('returns empty catalog for unregistered paths', () => {
    expect(
      resolveQuickActionsForPath('/campanha/municipios/foo', 'coordinator', {
        municipalitySlug: 'foo',
      }),
    ).toEqual([])
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
})

describe('campaignQuickActionSnap', () => {
  it('detects expanded snap', () => {
    expect(quickActionsSnapIsExpanded(QUICK_ACTIONS_SNAP_EXPANDED)).toBe(true)
    expect(quickActionsSnapIsExpanded(QUICK_ACTIONS_SNAP_COLLAPSED)).toBe(false)
    expect(quickActionsSnapIsExpanded(null)).toBe(false)
  })
})
