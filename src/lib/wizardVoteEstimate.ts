import { formatElectionNumber } from '@/lib/electionFormat'
import { MAX_VOTE_COUNT } from '@/lib/schemas/primitives'
import {
  getVoteEstimateOrderViolation,
  VOTE_ESTIMATE_ORDER_ERROR_MESSAGE,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'

export type VoteShortcut = 'double' | '+50' | '-50' | '+100' | '-100'

export const VOTE_SHORTCUTS: readonly VoteShortcut[] = [
  'double',
  '+50',
  '-50',
  '+100',
  '-100',
] as const

export const voteShortcutLabels: Record<VoteShortcut, string> = {
  double: '2×',
  '+50': '+50',
  '-50': '−50',
  '+100': '+100',
  '-100': '−100',
}

export const applyVoteShortcut = (value: number | null, shortcut: VoteShortcut): number => {
  const base = value ?? 0
  if (shortcut === 'double') {
    if (base < 1) return base
    return Math.min(base * 2, MAX_VOTE_COUNT)
  }

  const delta =
    shortcut === '+50' ? 50 : shortcut === '-50' ? -50 : shortcut === '+100' ? 100 : -100
  return Math.max(0, Math.min(base + delta, MAX_VOTE_COUNT))
}

export const parseWizardVoteDraft = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const digitsOnly = trimmed.replace(/\D/g, '')
  if (!digitsOnly) return null
  const parsed = Number(digitsOnly)
  if (!Number.isFinite(parsed)) return null
  return Math.min(Math.trunc(parsed), MAX_VOTE_COUNT)
}

export const wizardVoteFinalCtaLabel = 'Salvar estimativas →' as const

export type WizardVoteViolation = {
  violatingScenario: VoteEstimateScenario
  message: string
}

export const getWizardVoteViolation = (
  estimates: VoteEstimateScenarioViewModel,
): WizardVoteViolation | null => {
  const violatingScenario = getVoteEstimateOrderViolation(estimates)
  if (!violatingScenario) return null

  return {
    violatingScenario,
    message: buildWizardVoteViolationMessage(estimates, violatingScenario),
  }
}

export const getWizardVoteViolationHighlights = (
  estimates: VoteEstimateScenarioViewModel,
): VoteEstimateScenario[] => {
  const violation = getWizardVoteViolation(estimates)
  if (!violation) return []

  const { violatingScenario } = violation
  const { pessimistic, central, optimistic } = estimates

  if (
    violatingScenario === 'central' &&
    pessimistic != null &&
    central != null &&
    pessimistic > central
  ) {
    return ['pessimistic', 'central']
  }

  if (
    violatingScenario === 'optimistic' &&
    central != null &&
    optimistic != null &&
    optimistic < central
  ) {
    return ['optimistic', 'central']
  }

  return [violatingScenario]
}

const buildWizardVoteViolationMessage = (
  estimates: VoteEstimateScenarioViewModel,
  violatingScenario: VoteEstimateScenario,
): string => {
  const { pessimistic, central, optimistic } = estimates

  if (
    violatingScenario === 'central' &&
    pessimistic != null &&
    central != null &&
    pessimistic > central
  ) {
    return `${voteEstimateScenarioLabels.pessimistic} (${formatElectionNumber(pessimistic)}) não pode ser maior que ${voteEstimateScenarioLabels.central.toLowerCase()} (${formatElectionNumber(central)}).`
  }

  if (
    violatingScenario === 'optimistic' &&
    central != null &&
    optimistic != null &&
    optimistic < central
  ) {
    return `${voteEstimateScenarioLabels.optimistic} (${formatElectionNumber(optimistic)}) não pode ser menor que ${voteEstimateScenarioLabels.central.toLowerCase()} (${formatElectionNumber(central)}).`
  }

  return VOTE_ESTIMATE_ORDER_ERROR_MESSAGE
}
