/**
 * B98 — ordered sub-flow queue after the principal wizard action succeeds.
 * Pure navigation helpers; each link still writes via its existing action.
 */

import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  type CampaignWizardActionId,
  isWizardReturnPath,
  wizardActionHref,
  wizardSignalHref,
  wizardTrendHref,
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

/** Principal plus remaining queue — the ordered session (B98). */
export const wizardChainSessionSteps = (
  entryAction: WizardChainActionId,
): readonly WizardChainActionId[] => [entryAction, ...wizardChainAfter(entryAction)]

export type WizardChainPreviousTarget = WizardChainActionId | 'municipality-search'

/** Step immediately before `currentAction` in a B98 session, or municipality search at the principal. */
export const previousWizardChainStep = (
  entryAction: WizardChainActionId,
  currentAction: WizardChainActionId,
): WizardChainPreviousTarget => {
  const steps = wizardChainSessionSteps(entryAction)
  const index = steps.indexOf(currentAction)
  if (index <= 0) {
    return 'municipality-search'
  }
  return steps[index - 1]
}

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

/**
 * Href for the wizard header Voltar on a root step of a chainable flow (B135).
 * Sub-steps (trend note, signal body) keep intra-flow previous links.
 */
export const wizardChainPreviousHref = (
  entryAction: CampaignWizardActionId | undefined,
  currentAction: WizardChainActionId,
  municipalitySlug: string,
  returnPath?: string,
): string => {
  const sessionEntry = resolveWizardChainEntry(entryAction, currentAction)
  const previous = previousWizardChainStep(sessionEntry, currentAction)

  if (previous === 'municipality-search') {
    const entrySlug = CAMPAIGN_WIZARD_ACTION_SLUGS[sessionEntry]
    return wizardActionHref(entrySlug, undefined, { entryAction: sessionEntry, returnPath })
  }

  return wizardHrefForChainStep(previous, municipalitySlug, sessionEntry, returnPath)
}
