import { describe, expect, it } from 'vitest'

import { toVoteEstimateScenarioViewModel } from '@/lib/voteEstimate'
import {
  buildMunicipalityV2NetworkRows,
  MUNICIPALITY_V2_NETWORK_LIMIT,
} from '@/utilities/municipality/municipalityV2NetworkView'

describe('municipalityV2NetworkView', () => {
  it('merges leaderships with pledges and sorts by effective central estimate', () => {
    const { rows, totalCount } = buildMunicipalityV2NetworkRows(
      [
        { id: 1, name: 'Ana', supportStatus: 'engajado' },
        { id: 2, name: 'Bruno', supportStatus: 'a_abordar' },
        { id: 3, name: 'Carla', supportStatus: null },
      ],
      [
        {
          id: 10,
          leadershipID: 1,
          declaredVotes: 100,
          estimatedVotes: toVoteEstimateScenarioViewModel({ central: 200 }),
        },
        {
          id: 11,
          leadershipID: 2,
          declaredVotes: 500,
          estimatedVotes: toVoteEstimateScenarioViewModel({ central: 50 }),
        },
      ],
      2,
    )

    expect(totalCount).toBe(3)
    expect(rows.length).toBe(2)
    expect(rows[0]?.leadershipID).toBe(1)
    expect(rows[0]?.pledgeID).toBe(10)
    expect(rows[0]?.declaredVotes).toBe(100)
    expect(rows[1]?.leadershipID).toBe(2)
  })

  it('includes leaderships without pledges with null declared and empty estimates', () => {
    const { rows } = buildMunicipalityV2NetworkRows(
      [{ id: 5, name: 'Sem pledge', supportStatus: null }],
      [],
    )

    expect(rows[0]).toMatchObject({
      leadershipID: 5,
      pledgeID: null,
      declaredVotes: null,
      estimatedVotes: toVoteEstimateScenarioViewModel(null),
    })
  })

  it('defaults limit to dossier cap', () => {
    const leaderships = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      name: `L${index + 1}`,
      supportStatus: null,
    }))

    const { rows, totalCount } = buildMunicipalityV2NetworkRows(leaderships, [])
    expect(totalCount).toBe(12)
    expect(rows.length).toBe(MUNICIPALITY_V2_NETWORK_LIMIT)
  })
})
