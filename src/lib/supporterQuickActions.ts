import { FileUp, UserPlus } from 'lucide-react'

import { CAMPAIGN_SUPPORTERS_HOME } from '@/lib/campaignPaths'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import { isListPath } from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

export const SUPPORTER_CREATE_HREF = `${CAMPAIGN_SUPPORTERS_HOME}/novo` as const

export const SUPPORTER_IMPORT_HREF = `${CAMPAIGN_SUPPORTERS_HOME}/importar` as const

const supporterDetailPathPattern = /^\/campanha\/apoiadores\/(\d+)(?:\/|$)/

export const isSupportersListPath = (pathname: string): boolean =>
  isListPath(pathname, CAMPAIGN_SUPPORTERS_HOME)

export const parseSupporterDetailId = (pathname: string): number | undefined => {
  const match = pathname.match(supporterDetailPathPattern)
  if (!match) return undefined
  const id = Number(match[1])
  return Number.isInteger(id) && id > 0 ? id : undefined
}

export const isSupportersPath = (pathname: string): boolean =>
  isSupportersListPath(pathname) || parseSupporterDetailId(pathname) !== undefined

const registerSupporterAction: CampaignQuickAction = {
  id: 'register-supporter',
  label: 'Cadastrar apoiador',
  icon: UserPlus,
  description: 'Registrar um apoiador no cadastro nominal',
  href: SUPPORTER_CREATE_HREF,
}

const importSupportersAction: CampaignQuickAction = {
  id: 'import-supporters',
  label: 'Importar CSV',
  icon: FileUp,
  description: 'Importar apoiadores em lote a partir de planilha',
  href: SUPPORTER_IMPORT_HREF,
}

const coordinatorSupporterQuickActions: readonly CampaignQuickAction[] = [
  registerSupporterAction,
  importSupportersAction,
]

const staffSupporterQuickActions: readonly CampaignQuickAction[] = [registerSupporterAction]

const supporterQuickActionsByRole = new Map<CampaignRole, readonly CampaignQuickAction[]>()

const supporterQuickActionsForRole = (role: CampaignRole): readonly CampaignQuickAction[] => {
  if (!isStaffCampaignRole(role)) return []
  const cached = supporterQuickActionsByRole.get(role)
  if (cached) return cached
  // Import is coordinator-only — mirrors the page gate (`isCampaignCoordinator`);
  // the import route redirects non-coordinators back to the list.
  const actions =
    role === 'coordinator' ? coordinatorSupporterQuickActions : staffSupporterQuickActions
  supporterQuickActionsByRole.set(role, actions)
  return actions
}

export const resolveSupporterListQuickActions = (
  role: CampaignRole,
): readonly CampaignQuickAction[] => supporterQuickActionsForRole(role)

export const resolveSupporterDetailQuickActions = (
  role: CampaignRole,
): readonly CampaignQuickAction[] => supporterQuickActionsForRole(role)

export const resolveSupporterQuickActionsForPath = (
  pathname: string,
  role: CampaignRole,
  _context: CampaignQuickActionContext,
): readonly CampaignQuickAction[] => {
  if (!isSupportersPath(pathname)) return []
  return supporterQuickActionsForRole(role)
}
