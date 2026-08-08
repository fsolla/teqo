import { politicalTrendStatuses, type PoliticalTrendStatusValue } from '@/lib/schemas/municipality'

const politicalTrendDisplayLabels: Record<PoliticalTrendStatusValue, string> = {
  favoravel: 'Favorável',
  neutra: 'Neutra',
  desfavoravel: 'Desfavorável',
}

export const WIZARD_TREND_SAVE_LABEL = 'Salvar' as const

export const WIZARD_TREND_CLEAR_LABEL = 'Limpar' as const

export const WIZARD_TREND_SAVED_MESSAGE = 'Tendência política registrada.' as const

export const WIZARD_TREND_UNREGISTERED_TITLE = 'Tendência não registrada' as const

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

/** Where the change-trend wizard should land when `tendencia=` is present. */
export type WizardTrendNoteDestination = 'note' | 'choice' | 'home'

/**
 * `home` when the query trend already matches the persisted status — covers
 * post-save RSC refresh (B97) and stale deep-links; never loops back to choice.
 */
export const resolveWizardTrendNoteDestination = (
  trendStatus: PoliticalTrendStatusValue,
  currentStatus: PoliticalTrendStatusValue | null,
): WizardTrendNoteDestination => {
  if (trendStatus === currentStatus) {
    return 'home'
  }

  if (!selectablePoliticalTrendStatuses(currentStatus).includes(trendStatus)) {
    return 'choice'
  }

  return 'note'
}
