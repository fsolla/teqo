/**
 * B114 — shared wizard back contract (header Voltar = Android / browser back).
 * Pure resolution + history-state marks; no DOM.
 */

import {
  wizardActionHref,
  wizardSignalHref,
  wizardTrendHref,
  type CampaignWizardActionId,
} from '@/lib/campaignActionRoutes'

/** Synthetic history mark for URL-step / entry back interception. */
export const WIZARD_BACK_HISTORY_KEY = 'teqoWizardBack' as const

/** Synthetic history mark for client-only layers (leadership form). */
export const WIZARD_LAYER_HISTORY_KEY = 'teqoWizardLayer' as const

export const WIZARD_LEADERSHIP_FORM_LAYER = 'leadership-form' as const

export type WizardClientLayer = typeof WIZARD_LEADERSHIP_FORM_LAYER

export type WizardBackHistoryState = {
  [WIZARD_BACK_HISTORY_KEY]?: true
  [WIZARD_LAYER_HISTORY_KEY]?: WizardClientLayer
}

export type WizardBackTarget =
  | { kind: 'navigate'; href: string }
  | { kind: 'pop-layer'; layer: WizardClientLayer }

type WizardBackStepId =
  | 'municipality-search'
  | 'expected-votes'
  | 'signal-type'
  | 'signal-body'
  | 'trend-choice'
  | 'trend-note'
  | 'leadership-grid'
  | 'leadership-form'

export type ResolveWizardBackInput = {
  stepKind: 'entry' | 'continue'
  previousHref?: string
  dismissHref: string
  clientLayer?: WizardClientLayer | null
}

/** Single back action for header Voltar and Android / browser popstate. */
export const resolveWizardBack = (input: ResolveWizardBackInput): WizardBackTarget => {
  if (input.clientLayer) {
    return { kind: 'pop-layer', layer: input.clientLayer }
  }
  if (input.stepKind === 'entry') {
    return { kind: 'navigate', href: input.dismissHref }
  }
  if (input.previousHref) {
    return { kind: 'navigate', href: input.previousHref }
  }
  return { kind: 'navigate', href: input.dismissHref }
}

export type WizardStepPreviousHrefInput = {
  step: Exclude<WizardBackStepId, 'municipality-search' | 'leadership-form'>
  actionSlug: string
  municipalitySlug?: string
  entryAction?: CampaignWizardActionId
  returnPath?: string
}

/**
 * Canonical previousHref per URL step. Leadership form is a client layer
 * (pop-layer), not an href — callers set `clientLayer` instead.
 */
export const wizardStepPreviousHref = (input: WizardStepPreviousHrefInput): string => {
  const { step, actionSlug, municipalitySlug, entryAction, returnPath } = input

  switch (step) {
    case 'expected-votes':
    case 'signal-type':
    case 'trend-choice':
    case 'leadership-grid':
      return wizardActionHref(actionSlug, undefined, { returnPath })
    case 'signal-body':
      return wizardSignalHref(actionSlug, municipalitySlug, undefined, entryAction, returnPath)
    case 'trend-note':
      return wizardTrendHref(
        actionSlug,
        municipalitySlug,
        undefined,
        entryAction,
        undefined,
        returnPath,
      )
    default: {
      const _exhaustive: never = step
      return _exhaustive
    }
  }
}

export const isWizardBackHistoryState = (state: unknown): state is WizardBackHistoryState =>
  typeof state === 'object' &&
  state !== null &&
  (state as Record<string, unknown>)[WIZARD_BACK_HISTORY_KEY] === true

export const isWizardLayerHistoryState = (
  state: unknown,
): state is WizardBackHistoryState & { [WIZARD_LAYER_HISTORY_KEY]: WizardClientLayer } =>
  typeof state === 'object' &&
  state !== null &&
  (state as Record<string, unknown>)[WIZARD_LAYER_HISTORY_KEY] === WIZARD_LEADERSHIP_FORM_LAYER

/**
 * After popstate, handle when we had pushed a synthetic wizard entry and
 * are not closing that entry ourselves.
 */
export const shouldHandleWizardBackPopstate = (input: {
  wasHistoryPushed: boolean
  closingProgrammatically: boolean
}): boolean => input.wasHistoryPushed && !input.closingProgrammatically
