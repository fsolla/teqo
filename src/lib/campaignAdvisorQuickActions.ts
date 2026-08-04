import { UserPlus } from 'lucide-react'

import { CAMPAIGN_ADVISORS_HOME } from '@/lib/campaignPaths'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import { isListPath } from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { isUnrestrictedCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

export const ADVISOR_QUICK_CREATE_PARAM = 'criar' as const

export const advisorQuickCreateHref =
  `${CAMPAIGN_ADVISORS_HOME}?${ADVISOR_QUICK_CREATE_PARAM}=1` as const

const advisorDetailPathPattern = /^\/campanha\/assessores\/(\d+)(?:\/|$)/

export const isAdvisorsListPath = (pathname: string): boolean =>
  isListPath(pathname, CAMPAIGN_ADVISORS_HOME)

export const isAdvisorsPath = (pathname: string): boolean =>
  isAdvisorsListPath(pathname) || parseAdvisorDetailId(pathname) !== undefined

export const parseAdvisorDetailId = (pathname: string): number | undefined => {
  const match = pathname.match(advisorDetailPathPattern)
  if (!match) return undefined
  const id = Number(match[1])
  return Number.isInteger(id) && id > 0 ? id : undefined
}

const newAdvisorAction: CampaignQuickAction = {
  id: 'new-advisor',
  label: 'Novo assessor',
  icon: UserPlus,
  description: 'Criar conta de assessor na tabela',
  href: advisorQuickCreateHref,
}

const advisorQuickActionsByRole = new Map<CampaignRole, readonly CampaignQuickAction[]>()

const advisorQuickActionsForRole = (role: CampaignRole): readonly CampaignQuickAction[] => {
  if (!isUnrestrictedCampaignRole(role)) return []
  const cached = advisorQuickActionsByRole.get(role)
  if (cached) return cached
  const actions = [newAdvisorAction] as const
  advisorQuickActionsByRole.set(role, actions)
  return actions
}

export const resolveAdvisorListQuickActions = (
  role: CampaignRole,
): readonly CampaignQuickAction[] => advisorQuickActionsForRole(role)

export const resolveAdvisorDetailQuickActions = (
  role: CampaignRole,
): readonly CampaignQuickAction[] => advisorQuickActionsForRole(role)

export const resolveAdvisorQuickActionsForPath = (
  pathname: string,
  role: CampaignRole,
  _context: CampaignQuickActionContext,
): readonly CampaignQuickAction[] => {
  if (!isUnrestrictedCampaignRole(role)) return []

  if (isAdvisorsListPath(pathname) || parseAdvisorDetailId(pathname) !== undefined) {
    return advisorQuickActionsForRole(role)
  }

  return []
}
