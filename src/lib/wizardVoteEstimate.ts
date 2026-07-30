import { formatElectionNumber } from '@/lib/electionFormat'
import { MAX_VOTE_COUNT } from '@/lib/schemas/primitives'
import {
  getVoteEstimateOrderViolation,
  VOTE_ESTIMATE_ORDER_ERROR_MESSAGE,
  voteEstimateScenarioLabels,
  type VoteEstimateScenario,
  type VoteEstimateScenarioViewModel,
} from '@/lib/voteEstimate'

/** Mesa ritual order: média → pessimista → otimista (≠ storage order pessimistic ≤ central ≤ optimistic). */
export const WIZARD_VOTE_SCENARIO_EDIT_ORDER = [
  'central',
  'pessimistic',
  'optimistic',
] as const satisfies readonly VoteEstimateScenario[]

export type WizardVoteEditScenario = VoteEstimateScenario

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

export const isWizardVoteEditScenario = (value: string): value is WizardVoteEditScenario =>
  (WIZARD_VOTE_SCENARIO_EDIT_ORDER as readonly string[]).includes(value)

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

export const draftTextForVoteValue = (value: number | null | undefined): string =>
  value == null ? '' : String(value)

export const getNextWizardVoteScenario = (
  current: WizardVoteEditScenario,
): WizardVoteEditScenario | null => {
  const index = WIZARD_VOTE_SCENARIO_EDIT_ORDER.indexOf(current)
  if (index < 0 || index >= WIZARD_VOTE_SCENARIO_EDIT_ORDER.length - 1) return null
  return WIZARD_VOTE_SCENARIO_EDIT_ORDER[index + 1]!
}

export const getPreviousWizardVoteScenario = (
  current: WizardVoteEditScenario,
): WizardVoteEditScenario | null => {
  const index = WIZARD_VOTE_SCENARIO_EDIT_ORDER.indexOf(current)
  if (index <= 0) return null
  return WIZARD_VOTE_SCENARIO_EDIT_ORDER[index - 1]!
}

export const wizardVoteStepTitle = (scenario: WizardVoteEditScenario): string => {
  const label = voteEstimateScenarioLabels[scenario]
  return `Qual a nova estimativa ${label.toLowerCase()}?`
}

export const wizardVoteStepCtaLabel = (scenario: WizardVoteEditScenario): string => {
  const label = voteEstimateScenarioLabels[scenario]
  return `Ajustar estimativa ${label.toLowerCase()} →`
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

export const mergeWizardVoteEstimate = (
  base: VoteEstimateScenarioViewModel,
  scenario: WizardVoteEditScenario,
  value: number | null,
): VoteEstimateScenarioViewModel => ({
  ...base,
  [scenario]: value,
})
