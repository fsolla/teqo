import type { CampaignWizardActionId } from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import {
  politicalTrendStatuses,
  type PoliticalTrendStatusValue,
} from '@/lib/schemas/municipality'
import {
  municipalitySignalTypeLabels,
  type MunicipalitySignalType,
} from '@/lib/schemas/municipalityUpdate'

const politicalTrendDisplayLabels: Record<PoliticalTrendStatusValue, string> = {
  favoravel: 'Favorável',
  neutra: 'Neutra',
  desfavoravel: 'Desfavorável',
}

export const WIZARD_TREND_SKIP_LABEL = 'Pular mudança de tendência →' as const

export const WIZARD_TREND_SAVE_LABEL = 'Salvar' as const

export const WIZARD_TREND_CLEAR_LABEL = 'Limpar' as const

export const WIZARD_TREND_SAVED_MESSAGE = 'Tendência política registrada.' as const

export const WIZARD_TREND_UNREGISTERED_TITLE = 'Tendência não registrada' as const

export type WizardTrendSkipAction = {
  label: string
  href: string
}

export const wizardTrendChoiceStepTitle = (
  currentStatus: PoliticalTrendStatusValue | null,
): string =>
  currentStatus
    ? `Tendência ${politicalTrendDisplayLabels[currentStatus]}`
    : WIZARD_TREND_UNREGISTERED_TITLE

export const selectablePoliticalTrendStatuses = (
  currentStatus: PoliticalTrendStatusValue | null,
): PoliticalTrendStatusValue[] =>
  currentStatus
    ? politicalTrendStatuses.filter((status) => status !== currentStatus)
    : [...politicalTrendStatuses]

export const resolveWizardTrendSkip = (): WizardTrendSkipAction => ({
  label: WIZARD_TREND_SKIP_LABEL,
  href: CAMPAIGN_HOME,
})

export type PoliticalTrendNotePrefillSource =
  | { kind: 'none' }
  | { kind: 'signal'; signalType: MunicipalitySignalType; description: string }
  | { kind: 'voteAdjustment'; previousValue: number; newValue: number }
  | { kind: 'custom'; text: string }

export const buildPoliticalTrendNotePrefill = (source: PoliticalTrendNotePrefillSource): string => {
  switch (source.kind) {
    case 'none':
      return ''
    case 'signal':
      return `Sinal de ${municipalitySignalTypeLabels[source.signalType].toLowerCase()}: ${source.description}`
    case 'voteAdjustment':
      return `Ajuste de votos: ${source.previousValue} → ${source.newValue}`
    case 'custom':
      return source.text
    default: {
      const exhaustive: never = source
      return exhaustive
    }
  }
}

const parseOptionalIntParam = (value: string | string[] | undefined): number | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  const trimmed = raw?.trim()
  if (!trimmed) return undefined
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const resolvePoliticalTrendNotePrefillSource = ({
  entryAction,
  notePrefill,
  signalType,
  signalBody,
  voteFrom,
  voteTo,
}: {
  entryAction?: CampaignWizardActionId
  notePrefill?: string | string[] | undefined
  signalType?: MunicipalitySignalType
  signalBody?: string | string[] | undefined
  voteFrom?: string | string[] | undefined
  voteTo?: string | string[] | undefined
}): PoliticalTrendNotePrefillSource => {
  const customText = Array.isArray(notePrefill) ? notePrefill[0] : notePrefill
  if (customText?.trim()) {
    return { kind: 'custom', text: customText.trim() }
  }

  if (entryAction === 'register-signal' && signalType) {
    const body = Array.isArray(signalBody) ? signalBody[0] : signalBody
    if (body?.trim()) {
      return { kind: 'signal', signalType, description: body.trim() }
    }
  }

  if (entryAction === 'update-votes') {
    const previousValue = parseOptionalIntParam(voteFrom)
    const newValue = parseOptionalIntParam(voteTo)
    if (previousValue !== undefined && newValue !== undefined) {
      return { kind: 'voteAdjustment', previousValue, newValue }
    }
  }

  return { kind: 'none' }
}
