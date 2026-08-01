import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  wizardActionHref,
  type CampaignWizardActionId,
} from '@/lib/campaignActionRoutes'
import { homeActionsForRole } from '@/lib/campaignHomeActions'
import { CAMPAIGN_DEMANDS_HOME } from '@/lib/campaignPaths'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

export const CAMPAIGN_DEMANDS_CREATE_HREF = `${CAMPAIGN_DEMANDS_HOME}/nova` as const

const DETAIL_WIZARD_ACTION_IDS: readonly CampaignWizardActionId[] = [
  'update-votes',
  'register-signal',
  'change-trend',
  'update-leadership',
  'register-demand',
]

export const demandCreateHref = (municipalityId?: number): string => {
  if (municipalityId === undefined) {
    return CAMPAIGN_DEMANDS_CREATE_HREF
  }
  return `${CAMPAIGN_DEMANDS_CREATE_HREF}?municipality=${municipalityId}`
}

export const isDemandsListPath = (pathname: string): boolean =>
  pathname === CAMPAIGN_DEMANDS_HOME || pathname === `${CAMPAIGN_DEMANDS_HOME}/`

export const isDemandDetailPath = (pathname: string): boolean => {
  if (!pathname.startsWith(`${CAMPAIGN_DEMANDS_HOME}/`)) {
    return false
  }
  const rest = pathname.slice(`${CAMPAIGN_DEMANDS_HOME}/`.length)
  if (!rest || rest.includes('/')) {
    return false
  }
  return rest !== 'nova'
}

const registerDemandListAction = (role: CampaignRole): CampaignQuickAction | null => {
  const source = homeActionsForRole(role).find((action) => action.id === 'register-demand')
  if (!source) {
    return null
  }
  return {
    ...source,
    href: CAMPAIGN_DEMANDS_CREATE_HREF,
  }
}

/** B85 list: single "Registrar pedido" launcher (form route — wizard A5 is still a stub). */
export const resolveDemandsListQuickActions = (
  role: CampaignRole,
): readonly CampaignQuickAction[] => {
  if (!isStaffCampaignRole(role)) {
    return []
  }
  const action = registerDemandListAction(role)
  return action ? [action] : []
}

/** B85 detail: staff Início A1–A5 with municipality prefill when linked. */
export const resolveDemandDetailQuickActions = (
  role: CampaignRole,
  context: CampaignQuickActionContext,
): readonly CampaignQuickAction[] => {
  if (!isStaffCampaignRole(role)) {
    return []
  }
  const { municipalitySlug, municipalityId } = context
  if (!municipalitySlug) {
    return []
  }

  const byId = new Map(homeActionsForRole(role).map((action) => [action.id, action]))

  return DETAIL_WIZARD_ACTION_IDS.flatMap((id) => {
    const action = byId.get(id)
    if (!action) {
      return []
    }
    if (id === 'register-demand') {
      return [
        {
          ...action,
          href: demandCreateHref(municipalityId),
        },
      ]
    }
    return [
      {
        ...action,
        href: wizardActionHref(CAMPAIGN_WIZARD_ACTION_SLUGS[id], municipalitySlug),
      },
    ]
  })
}
