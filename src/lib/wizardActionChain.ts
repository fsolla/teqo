/**
 * B98 — ordered sub-flow queue after the principal wizard action succeeds.
 * Pure navigation helpers; each link still writes via its existing action.
 */

import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  campaignWizardActionIdForSlug,
  isWizardReturnPath,
  wizardActionHref,
  wizardSignalHref,
  wizardTrendHref,
  type CampaignWizardActionId,
} from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'

/** Actions that participate in the v1 adjustment chain (excludes demand). */
export type WizardChainActionId = Exclude<CampaignWizardActionId, 'register-demand'>

const WIZARD_CHAIN_AFTER = {
  'update-votes': ['change-trend', 'register-signal', 'update-leadership'],
  'register-signal': ['change-trend', 'update-votes', 'update-leadership'],
  'change-trend': ['register-signal', 'update-votes', 'update-leadership'],
  'update-leadership': ['register-signal', 'update-votes', 'change-trend'],
} as const satisfies Record<WizardChainActionId, readonly WizardChainActionId[]>

export const isWizardChainActionId = (
  id: CampaignWizardActionId | undefined,
): id is WizardChainActionId => id != null && id in WIZARD_CHAIN_AFTER

/**
 * Remaining chained steps after `completedAction` in a session owned by `entryAction`.
 * When `completedAction` is the principal (or omitted), returns the full queue.
 */
export const wizardChainAfter = (
  entryAction: WizardChainActionId,
  completedAction?: WizardChainActionId,
): WizardChainActionId[] => {
  const queue: WizardChainActionId[] = [...WIZARD_CHAIN_AFTER[entryAction]]
  if (!completedAction || completedAction === entryAction) {
    return queue
  }
  const index = queue.indexOf(completedAction)
  if (index === -1) {
    return []
  }
  return queue.slice(index + 1)
}

export const nextWizardChainStep = (
  entryAction: WizardChainActionId,
  completedAction: WizardChainActionId,
): WizardChainActionId | undefined => wizardChainAfter(entryAction, completedAction)[0]

const wizardHrefForChainStep = (
  action: WizardChainActionId,
  municipalitySlug: string,
  entryAction: WizardChainActionId,
  returnPath?: string,
): string => {
  const actionSlug = CAMPAIGN_WIZARD_ACTION_SLUGS[action]
  switch (action) {
    case 'update-votes':
    case 'update-leadership':
      return wizardActionHref(actionSlug, municipalitySlug, { entryAction, returnPath })
    case 'register-signal':
      return wizardSignalHref(actionSlug, municipalitySlug, undefined, entryAction, returnPath)
    case 'change-trend':
      return wizardTrendHref(
        actionSlug,
        municipalitySlug,
        undefined,
        entryAction,
        undefined,
        returnPath,
      )
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

/** Chain end or dismiss target: allowlisted `from`, else Início (B110). */
export const wizardChainEndHref = (returnPath?: string): string =>
  returnPath && isWizardReturnPath(returnPath) ? returnPath : CAMPAIGN_HOME

/**
 * Href for the next chained wizard after completing/skipping `completedAction`,
 * or the return path (default Início) when the queue is empty / entry is not chainable.
 */
export const wizardChainContinueHref = (
  entryAction: CampaignWizardActionId,
  completedAction: WizardChainActionId,
  municipalitySlug: string,
  returnPath?: string,
): string => {
  if (!isWizardChainActionId(entryAction)) {
    return wizardChainEndHref(returnPath)
  }
  const next = nextWizardChainStep(entryAction, completedAction)
  if (!next) {
    return wizardChainEndHref(returnPath)
  }
  return wizardHrefForChainStep(next, municipalitySlug, entryAction, returnPath)
}

/** Session owner for navigation: explicit `entry` query, else the current principal. */
export const resolveWizardChainEntry = (
  entryAction: CampaignWizardActionId | undefined,
  currentAction: WizardChainActionId,
): WizardChainActionId => (isWizardChainActionId(entryAction) ? entryAction : currentAction)

/** Discriminates wizard chrome steps for `wizardPreviousHref` (B135). */
export type WizardStepKind =
  | 'municipality-search'
  | 'votes'
  | 'trend-choice'
  | 'trend-note'
  | 'signal-type'
  | 'signal-body'
  | 'leadership-grid'
  | 'leadership-form'

const wizardPrincipalStepHref = (
  action: WizardChainActionId,
  municipalitySlug: string,
  sessionEntry: WizardChainActionId,
  returnPath?: string,
): string => {
  const actionSlug = CAMPAIGN_WIZARD_ACTION_SLUGS[action]
  switch (action) {
    case 'update-votes':
    case 'update-leadership':
      return wizardActionHref(actionSlug, municipalitySlug, {
        entryAction: sessionEntry,
        returnPath,
      })
    case 'register-signal':
      return wizardSignalHref(actionSlug, municipalitySlug, undefined, sessionEntry, returnPath)
    case 'change-trend':
      return wizardTrendHref(
        actionSlug,
        municipalitySlug,
        undefined,
        sessionEntry,
        undefined,
        returnPath,
      )
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}

/**
 * Principal step of the chain link immediately before `current` in a session owned by
 * `sessionEntry`. Undefined when `current` is the session principal (standalone entry).
 */
const wizardChainPreviousPrincipalHref = (
  current: WizardChainActionId,
  sessionEntry: WizardChainActionId,
  municipalitySlug: string,
  returnPath?: string,
): string | undefined => {
  if (current === sessionEntry) {
    return undefined
  }
  const queue = wizardChainAfter(sessionEntry)
  const index = queue.indexOf(current)
  if (index === -1) {
    return undefined
  }
  if (index === 0) {
    return wizardPrincipalStepHref(sessionEntry, municipalitySlug, sessionEntry, returnPath)
  }
  return wizardPrincipalStepHref(queue[index - 1], municipalitySlug, sessionEntry, returnPath)
}

type WizardPreviousHrefInput = {
  actionSlug: string
  stepKind: WizardStepKind
  municipalitySlug?: string
  entryAction?: CampaignWizardActionId
  returnPath?: string
}

/**
 * Href for the logically previous wizard step — internal sub-steps, principal search,
 * or the preceding B98 chain link's principal step (same município).
 */
export const wizardPreviousHref = (input: WizardPreviousHrefInput): string => {
  const { actionSlug, stepKind, municipalitySlug, entryAction, returnPath } = input

  if (stepKind === 'municipality-search') {
    return wizardChainEndHref(returnPath)
  }

  if (stepKind === 'trend-note') {
    return wizardTrendHref(
      actionSlug,
      municipalitySlug,
      undefined,
      entryAction,
      undefined,
      returnPath,
    )
  }

  if (stepKind === 'signal-body') {
    return wizardSignalHref(actionSlug, municipalitySlug, undefined, entryAction, returnPath)
  }

  if (stepKind === 'leadership-form') {
    return wizardActionHref(actionSlug, municipalitySlug, { entryAction, returnPath })
  }

  const currentActionId = campaignWizardActionIdForSlug(actionSlug)
  const searchHref = wizardActionHref(actionSlug, undefined, { returnPath })

  if (!municipalitySlug || !currentActionId || !isWizardChainActionId(currentActionId)) {
    return searchHref
  }

  const sessionEntry = resolveWizardChainEntry(entryAction, currentActionId)

  if (
    (stepKind === 'votes' || stepKind === 'leadership-grid') &&
    currentActionId === sessionEntry
  ) {
    return searchHref
  }

  const chainPrev = wizardChainPreviousPrincipalHref(
    currentActionId,
    sessionEntry,
    municipalitySlug,
    returnPath,
  )
  if (chainPrev) {
    return chainPrev
  }

  return searchHref
}
