import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  appendWizardReturnPath,
  campaignActionEntryHref,
  wizardActionHref,
  type CampaignWizardActionId,
} from '@/lib/campaignActionRoutes'
import {
  homeActionsForRole,
  type CampaignHomeAction,
  type ResolvedCampaignHomeAction,
} from '@/lib/campaignHomeActions'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import type { CampaignRole } from '@/lib/campaignRoles'
import { isStaffCampaignRole } from '@/lib/campaignRoles'

const LEADERSHIP_LIST_PATH = '/campanha/liderancas' as const

const LEADERSHIP_DETAIL_WIZARD_IDS: readonly CampaignWizardActionId[] = [
  'update-votes',
  'register-signal',
  'change-trend',
  'update-leadership',
  'register-demand',
]

const isLeadershipListPath = (pathname: string): boolean =>
  pathname === LEADERSHIP_LIST_PATH || pathname === `${LEADERSHIP_LIST_PATH}/`

const parseLeadershipDetailId = (pathname: string): number | undefined => {
  const match = pathname.match(/^\/campanha\/liderancas\/(\d+)$/)
  if (!match?.[1]) return undefined
  return Number(match[1])
}

const resolveLeadershipListActions = (
  role: CampaignRole,
  returnPath: string,
): readonly ResolvedCampaignHomeAction[] => {
  const actions = homeActionsForRole(role).filter((action) => action.id === 'update-leadership')
  return actions.map((action) => ({
    ...action,
    href: appendWizardReturnPath(campaignActionEntryHref('update-leadership'), returnPath),
  }))
}

const hrefForLeadershipDetailAction = (
  action: CampaignHomeAction,
  context: CampaignQuickActionContext,
  returnPath: string,
): string => {
  const wizardSlug = CAMPAIGN_WIZARD_ACTION_SLUGS[action.id as CampaignWizardActionId]
  const { municipalitySlug, leadershipId } = context

  if (action.id === 'update-leadership') {
    if (municipalitySlug && leadershipId !== undefined) {
      return wizardActionHref(wizardSlug, municipalitySlug, { leadershipId, returnPath })
    }
    if (leadershipId !== undefined) {
      return `${LEADERSHIP_LIST_PATH}/${leadershipId}`
    }
    return appendWizardReturnPath(campaignActionEntryHref('update-leadership'), returnPath)
  }

  if (municipalitySlug) {
    return wizardActionHref(wizardSlug, municipalitySlug, { returnPath })
  }
  return appendWizardReturnPath(
    campaignActionEntryHref(action.id as CampaignWizardActionId),
    returnPath,
  )
}

const resolveLeadershipDetailActions = (
  role: CampaignRole,
  context: CampaignQuickActionContext,
  returnPath: string,
): readonly ResolvedCampaignHomeAction[] => {
  const actions = homeActionsForRole(role).filter((action) =>
    LEADERSHIP_DETAIL_WIZARD_IDS.includes(action.id as CampaignWizardActionId),
  )

  return actions.map((action) => ({
    ...action,
    href: hrefForLeadershipDetailAction(action, context, returnPath),
  }))
}

export const resolveLeadershipQuickActions = (
  pathname: string,
  role: CampaignRole,
  context: CampaignQuickActionContext,
): readonly ResolvedCampaignHomeAction[] | null => {
  if (!isStaffCampaignRole(role)) return null

  if (isLeadershipListPath(pathname)) {
    return resolveLeadershipListActions(role, pathname)
  }

  const leadershipId = parseLeadershipDetailId(pathname)
  if (leadershipId !== undefined) {
    return resolveLeadershipDetailActions(role, {
      ...context,
      leadershipId: context.leadershipId ?? leadershipId,
    }, pathname)
  }

  return null
}
