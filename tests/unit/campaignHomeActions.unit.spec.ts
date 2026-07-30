import { describe, expect, it } from 'vitest'

import { homeActionsForRole, toHomeActionButtonProps } from '@/lib/campaignHomeActions'
import { LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'

const staffActionIds = [
  'update-votes',
  'register-signal',
  'change-trend',
  'update-leadership',
  'register-demand',
  'uncovered-municipalities',
] as const

const leaderActionIds = ['register-supporter', 'my-contacts'] as const

describe('homeActionsForRole', () => {
  it.each(['coordinator', 'candidate'] as const)('returns six staff actions for %s', (role) => {
    const ids = homeActionsForRole(role).map((action) => action.id)
    expect(ids).toEqual([...staffActionIds])
  })

  it('returns six staff actions for advisor with portfolio-scoped descriptions', () => {
    const actions = homeActionsForRole('advisor')
    expect(actions.map((action) => action.id)).toEqual([...staffActionIds])
    expect(
      actions.some((action) => action.description.includes('nos municípios da sua carteira')),
    ).toBe(true)
    const uncovered = actions.find((action) => action.id === 'uncovered-municipalities')
    expect(uncovered?.description).toContain('sua carteira')
    expect(uncovered?.description).not.toContain('nos municípios da sua carteira nos municípios')
  })

  it('returns two leader actions without municipality staff ids', () => {
    const actions = homeActionsForRole('leader')
    expect(actions.map((action) => action.id)).toEqual([...leaderActionIds])
    for (const staffId of staffActionIds) {
      expect(actions.some((action) => action.id === staffId)).toBe(false)
    }
  })
})

describe('toHomeActionButtonProps', () => {
  it('wires my-contacts to the leader contacts route', () => {
    const [supporter, contacts] = toHomeActionButtonProps(homeActionsForRole('leader'))
    expect(supporter.href).toBeUndefined()
    expect(contacts.href).toBe(LEADER_CONTACTS_HOME)
  })

  it('wires uncovered-municipalities when href is provided', () => {
    const href = '/campanha/municipios?coverage=sem_assessor&sort=votos'
    const props = toHomeActionButtonProps(homeActionsForRole('coordinator'), href)
    const uncovered = props.find((action) => action.id === 'uncovered-municipalities')
    expect(uncovered?.href).toBe(href)
    const updateVotes = props.find((action) => action.id === 'update-votes')
    expect(updateVotes?.href).toBe('/campanha/acoes/atualizar-votos')
    const registerSignal = props.find((action) => action.id === 'register-signal')
    expect(registerSignal?.href).toBe('/campanha/acoes/registrar-sinal')
  })

  it('omits uncovered href when not provided', () => {
    const props = toHomeActionButtonProps(homeActionsForRole('coordinator'))
    expect(props.find((action) => action.id === 'uncovered-municipalities')?.href).toBeUndefined()
  })
})
