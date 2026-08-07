import { describe, expect, it } from 'vitest'

import {
  homeActionsForRole,
  toHomeActionButtonProps,
  UNCOVERED_MUNICIPALITIES_LIST_HREF,
} from '@/lib/campaignHomeActions'
import { LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import { buildMunicipalityListHref } from '@/utilities/municipality/municipalityListUrl'

const staffActionIds = [
  'update-votes',
  'register-update',
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
    const props = toHomeActionButtonProps(
      homeActionsForRole('coordinator'),
      UNCOVERED_MUNICIPALITIES_LIST_HREF,
    )
    const uncovered = props.find((action) => action.id === 'uncovered-municipalities')
    expect(uncovered?.href).toBe(UNCOVERED_MUNICIPALITIES_LIST_HREF)
    const updateVotes = props.find((action) => action.id === 'update-votes')
    expect(updateVotes?.href).toBe('/campanha/acoes/atualizar-votos')
    const registerUpdate = props.find((action) => action.id === 'register-update')
    expect(registerUpdate?.href).toBe('/campanha/acoes/registrar-atualizacao')
  })

  it('omits uncovered href when not provided', () => {
    const props = toHomeActionButtonProps(homeActionsForRole('coordinator'))
    expect(props.find((action) => action.id === 'uncovered-municipalities')?.href).toBeUndefined()
  })

  it('prefills wizard hrefs when municipalitySlug is provided', () => {
    const props = toHomeActionButtonProps(homeActionsForRole('coordinator'), {
      municipalitySlug: 'cairu',
    })
    expect(props.find((action) => action.id === 'update-votes')?.href).toBe(
      '/campanha/acoes/atualizar-votos?municipio=cairu',
    )
    expect(props.find((action) => action.id === 'uncovered-municipalities')?.href).toBeUndefined()
  })
})

describe('UNCOVERED_MUNICIPALITIES_LIST_HREF', () => {
  it('matches canonical municipality list builder (client/server parity)', () => {
    expect(buildMunicipalityListHref({ page: 1, coverage: 'sem_assessor', sort: 'votos' }, 1)).toBe(
      UNCOVERED_MUNICIPALITIES_LIST_HREF,
    )
  })
})
