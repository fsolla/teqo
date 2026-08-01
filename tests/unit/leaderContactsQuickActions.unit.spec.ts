import { describe, expect, it } from 'vitest'

import { homeActionsForRole } from '@/lib/campaignHomeActions'
import { LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import {
  LEADER_CONTACT_FORM_HASH,
  LEADER_CONTACTS_LIST_HASH,
  resolveLeaderContactsQuickActions,
} from '@/lib/leaderContactsQuickActions'

describe('leaderContactsQuickActions (B89)', () => {
  const leaderActionIds = homeActionsForRole('leader').map((action) => action.id)

  it('returns the B45 leader catalog with in-page hash hrefs', () => {
    const actions = resolveLeaderContactsQuickActions('leader', {})
    expect(actions.map((action) => action.id)).toEqual(leaderActionIds)
    expect(actions.find((action) => action.id === 'register-supporter')?.href).toBe(
      LEADER_CONTACT_FORM_HASH,
    )
    expect(actions.find((action) => action.id === 'my-contacts')?.href).toBe(
      LEADER_CONTACTS_LIST_HASH,
    )
  })

  it('returns empty catalog for staff lockdown', () => {
    expect(resolveLeaderContactsQuickActions('coordinator', {})).toEqual([])
    expect(resolveLeaderContactsQuickActions('advisor', {})).toEqual([])
  })
})

describe('campaignQuickActionRegistry leader contacts (B89)', () => {
  it('delegates contatos routes to the leader catalog', async () => {
    const { resolveQuickActionsForPath } = await import('@/lib/campaignQuickActionRegistry')

    const actions = resolveQuickActionsForPath(LEADER_CONTACTS_HOME, 'leader', {})
    expect(actions.map((action) => action.id)).toEqual(['register-supporter', 'my-contacts'])
    expect(actions.find((action) => action.id === 'register-supporter')?.href).toBe(
      LEADER_CONTACT_FORM_HASH,
    )
  })

  it('returns empty catalog on contatos for staff', async () => {
    const { resolveQuickActionsForPath } = await import('@/lib/campaignQuickActionRegistry')
    expect(resolveQuickActionsForPath(LEADER_CONTACTS_HOME, 'coordinator', {})).toEqual([])
  })
})
