import { describe, expect, it } from 'vitest'

import { toDetailHeaderView } from '@/lib/campaignOps/municipalityDetailHeaderView'
import {
  findOpsMunicipalityBySlug,
  toLocalStaffPledgeRows,
} from '@/lib/campaignOps/municipalityDetailLocalViews'
import type { OpsLeadership, OpsMunicipality, OpsVotePledge } from '@/lib/campaignOps/opsContract'

const municipality = (
  partial: Partial<OpsMunicipality> & Pick<OpsMunicipality, 'id' | 'slug'>,
): OpsMunicipality => ({
  name: 'Feira de Santana',
  kind: 'municipio',
  city: 'Feira de Santana',
  region: 'Portal do Sertão',
  ibgeCode: '2910800',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...partial,
})

describe('municipalityDetailHeaderView (OH9)', () => {
  it('maps OpsMunicipality fields into the presentational header slice', () => {
    const view = toDetailHeaderView(
      municipality({
        id: 1,
        slug: 'feira-de-santana',
        zoneNumber: null,
        lastUpdateAt: '2026-07-15T12:00:00.000Z',
        advisors: [10, 11],
      }),
    )

    expect(view).toEqual({
      name: 'Feira de Santana',
      kind: 'municipio',
      region: 'Portal do Sertão',
      zoneNumber: null,
      lastUpdateAt: '2026-07-15T12:00:00.000Z',
    })
  })
})

describe('municipalityDetailLocalViews (OH9)', () => {
  it('finds a municipality by slug and joins pledges to leadership contact names', () => {
    const rows = [
      municipality({ id: 1, slug: 'feira-de-santana' }),
      municipality({ id: 2, slug: 'salvador-ze-1', name: 'Salvador — ZE 1', kind: 'zona' }),
    ]
    expect(findOpsMunicipalityBySlug(rows, 'salvador-ze-1')?.id).toBe(2)
    expect(findOpsMunicipalityBySlug(rows, 'missing')).toBeNull()

    const leaderships: OpsLeadership[] = [
      {
        id: 5,
        contact: { id: 50, name: 'Ana Líder' },
        municipalities: [1],
        supportStatus: 'engajado',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]
    const pledges: OpsVotePledge[] = [
      {
        id: 9,
        leadership: 5,
        municipality: 1,
        declaredVotes: 120,
        declaredAt: '2026-07-20T00:00:00.000Z',
        estimatedVotes: { pessimistic: 80, central: 100, optimistic: 130 },
        estimateNote: 'Campo',
        estimatedAt: '2026-07-21T00:00:00.000Z',
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
      {
        id: 10,
        leadership: 5,
        municipality: 2,
        declaredVotes: 10,
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
    ]

    const localRows = toLocalStaffPledgeRows(1, pledges, leaderships)
    expect(localRows).toHaveLength(1)
    expect(localRows[0]).toMatchObject({
      id: 9,
      leadershipID: 5,
      contactName: 'Ana Líder',
      declaredVotes: 120,
      estimatedVotes: { pessimistic: 80, central: 100, optimistic: 130 },
      estimateNote: 'Campo',
    })
  })
})
