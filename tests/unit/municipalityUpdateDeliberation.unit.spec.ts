// @vitest-environment node

import { describe, expect, it } from 'vitest'

import type { CampaignUser } from '@/payload-types'
import {
  MUNICIPALITY_UPDATE_DELIBERATION_MUTATIONS,
  resolveMunicipalityUpdateCapabilities,
} from '@/utilities/access/municipalityUpdates'

import { stub } from '../helpers/stub'

const campaignUser = (role: CampaignUser['role'], extra: Partial<CampaignUser> = {}) =>
  stub<CampaignUser>({ collection: 'campaignUser', id: 1, role, ...extra })

/**
 * C88 — the capability resolver is the pure mirror of the access predicates
 * (assign/resolve = unrestricted, comment = create rule); the int spec pins
 * the end-to-end gate. These pin the profile matrix the client card renders.
 */
describe('municipality update deliberation capabilities (C88)', () => {
  it('grants everything to coordinator and candidate', () => {
    expect(resolveMunicipalityUpdateCapabilities(campaignUser('coordinator'))).toEqual({
      canAssign: true,
      canComment: true,
      canResolve: true,
    })
    expect(resolveMunicipalityUpdateCapabilities(campaignUser('candidate'))).toEqual({
      canAssign: true,
      canComment: true,
      canResolve: true,
    })
  })

  it('advisor may comment unless the Edição axis is somente_leitura, never assign or resolve', () => {
    expect(
      resolveMunicipalityUpdateCapabilities(campaignUser('advisor', { editing: 'carteira' })),
    ).toEqual({ canAssign: false, canComment: true, canResolve: false })
    expect(
      resolveMunicipalityUpdateCapabilities(
        campaignUser('advisor', { visibility: 'tudo', editing: 'tudo' }),
      ),
    ).toEqual({ canAssign: false, canComment: true, canResolve: false })
    // C141 coherence rule: Edição "Tudo" sem Visão "Tudo" resolve "none".
    expect(
      resolveMunicipalityUpdateCapabilities(campaignUser('advisor', { editing: 'tudo' })),
    ).toEqual({ canAssign: false, canComment: false, canResolve: false })
    expect(
      resolveMunicipalityUpdateCapabilities(
        campaignUser('advisor', { editing: 'somente_leitura' }),
      ),
    ).toEqual({ canAssign: false, canComment: false, canResolve: false })
  })

  it('leader, unknown actors and anonymous get nothing', () => {
    expect(resolveMunicipalityUpdateCapabilities(campaignUser('leader'))).toEqual({
      canAssign: false,
      canComment: false,
      canResolve: false,
    })
    expect(resolveMunicipalityUpdateCapabilities(null)).toEqual({
      canAssign: false,
      canComment: false,
      canResolve: false,
    })
    expect(resolveMunicipalityUpdateCapabilities(undefined)).toEqual({
      canAssign: false,
      canComment: false,
      canResolve: false,
    })
  })

  it('exposes exactly the four deliberative mutation kinds the hook allowlists', () => {
    expect([...MUNICIPALITY_UPDATE_DELIBERATION_MUTATIONS]).toEqual([
      'assignResponsible',
      'appendComment',
      'resolve',
      'reopen',
    ])
  })
})
