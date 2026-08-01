import { describe, expect, it } from 'vitest'

import type { HomeSearchSuccessResponse } from '@/lib/campaignHomeSearchHits'
import {
  filterHomeSearchResponseForContext,
  resolveHomeSearchExcludeContext,
} from '@/lib/homeSearchExcludeCurrentEntity'

const sampleResponse = (): HomeSearchSuccessResponse => ({
  status: 'success',
  resultKind: 'suggest',
  municipalities: [
    {
      kind: 'municipality',
      slug: 'cairu',
      name: 'Cairu',
      region: 'Baixo Sul',
      priority: null,
      votePosition2022: null,
    },
    {
      kind: 'municipality',
      slug: 'feira-de-santana',
      name: 'Feira de Santana',
      region: 'Centro-Norte',
      priority: null,
      votePosition2022: null,
    },
  ],
  territories: [],
  advisors: [{ id: 9, name: 'Assessor', phone: null, municipalityCount: 2 }],
  leaderships: [{ kind: 'leadership', id: 42, name: 'Líder', phone: null, municipalitiesSummary: '' }],
  stateDeputies: [],
  activities: [{ id: 1, slug: 'comicio', title: 'Comício', secondary: '' }],
  demands: [{ id: 2, slug: 'pedido', title: 'Pedido', secondary: '' }],
})

describe('homeSearchExcludeCurrentEntity (B109)', () => {
  it('merges municipality slug from pathname when context is empty', () => {
    expect(
      resolveHomeSearchExcludeContext('/campanha/municipios/cairu', {}).municipalitySlug,
    ).toBe('cairu')
  })

  it('filters the current municipality from suggest and search hits', () => {
    const filtered = filterHomeSearchResponseForContext(sampleResponse(), {
      municipalitySlug: 'cairu',
    })
    expect(filtered.municipalities.map((hit) => hit.slug)).toEqual(['feira-de-santana'])
  })

  it('filters leadership, advisor, activity and demand entities', () => {
    const filtered = filterHomeSearchResponseForContext(sampleResponse(), {
      leadershipId: 42,
      advisorId: 9,
      activitySlug: 'comicio',
      demandSlug: 'pedido',
    })
    expect(filtered.leaderships).toHaveLength(0)
    expect(filtered.advisors).toHaveLength(0)
    expect(filtered.activities).toHaveLength(0)
    expect(filtered.demands).toHaveLength(0)
  })
})
