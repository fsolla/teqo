import { describe, expect, it } from 'vitest'

import { BASELINE_TICKET_2022, ELECTION_YEAR_2022 } from '@/lib/electionResults'
import {
  campoFederalVotesByCityZoneFromFederalSlice,
  candidateVotesByCityZoneFromFederalSlice,
  type FederalNominalVoteCell,
} from '@/utilities/municipality/municipalityElectoralBaseline'

describe('federal nominal slice folds (B13+ F3)', () => {
  it('derives candidate votes and campo totals from one in-memory slice', () => {
    const candidateNumber = BASELINE_TICKET_2022.candidate.candidateNumber
    const slice = new Map<string, Map<number, FederalNominalVoteCell>>([
      [
        '2927408:1',
        new Map([
          [candidateNumber, { votes: 40, party: 'PT' }],
          [9999, { votes: 10, party: 'PL' }],
        ]),
      ],
    ])

    const byCandidate = candidateVotesByCityZoneFromFederalSlice(slice, candidateNumber)
    expect(byCandidate.get('2927408:1')).toBe(40)

    const campo = campoFederalVotesByCityZoneFromFederalSlice(slice, ELECTION_YEAR_2022)
    expect(campo.get('2927408:1')).toBe(40)
  })
})
