import { BASELINE_TICKET_2022 } from '@/lib/electionResults'

export const NO_ELECTION_BASELINE_MESSAGE =
  'Sem baseline TSE (informe território/município)' as const

export type GapVs2022Status =
  | 'above'
  | 'below'
  | 'noBaseline'
  | 'noEstimate'
  | 'noCandidateVotes'

export type GapVs2022Result = {
  gap: number | null
  ratio: number | null
  status: GapVs2022Status
  message: string
}

/** Minimal baseline shape for Gap vs 2022 (full detail VM is assignable). */
export type GapVs2022Baseline = {
  candidate: { votes: number }
} | null

const numberFormatter = new Intl.NumberFormat('pt-BR')

export const formatElectionNumber = (value: number): string => numberFormatter.format(value)

/**
 * Compare a confirmed vote estimate against the campaign candidate's 2022
 * votes in the same geography.
 */
export const computeGapVs2022 = (
  baseline: GapVs2022Baseline,
  confirmedVoteEstimate: number | null,
): GapVs2022Result => {
  if (!baseline) {
    return {
      gap: null,
      ratio: null,
      status: 'noBaseline',
      message: NO_ELECTION_BASELINE_MESSAGE,
    }
  }

  if (confirmedVoteEstimate === null) {
    return {
      gap: null,
      ratio: null,
      status: 'noEstimate',
      message: 'Sem estimativa confirmada para comparar',
    }
  }

  const candidateVotes2022 = baseline.candidate.votes
  if (candidateVotes2022 <= 0) {
    return {
      gap: null,
      ratio: null,
      status: 'noCandidateVotes',
      message: `${BASELINE_TICKET_2022.candidate.name} não recebeu votos aqui em 2022 — território novo a abrir`,
    }
  }

  const gap = confirmedVoteEstimate - candidateVotes2022
  const ratio = confirmedVoteEstimate / candidateVotes2022

  if (gap < 0) {
    return {
      gap,
      ratio,
      status: 'below',
      message: `Faltam ${formatElectionNumber(Math.abs(gap))} votos para o patamar de 2022`,
    }
  }

  const percentAbove = Math.round((ratio - 1) * 100)
  return {
    gap,
    ratio,
    status: 'above',
    message: `Já superamos 2022 em ${percentAbove}%`,
  }
}
