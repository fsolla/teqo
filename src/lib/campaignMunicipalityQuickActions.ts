import {
  homeActionsForRole,
  resolveStaffHomeQuickActions,
  toHomeActionButtonProps,
  type ResolvedCampaignHomeAction,
} from '@/lib/campaignHomeActions'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import { isListPath } from '@/lib/campaignQuickActionPaths'
import type { CampaignRole } from '@/lib/campaignRoles'
import { isStaffCampaignRole } from '@/lib/campaignRoles'

const MUNICIPALITIES_LIST_PATH = '/campanha/municipios' as const

const municipalityDetailPathPattern = /^\/campanha\/municipios\/([^/]+)(?:\/|$)/

export const isMunicipalitiesListPath = (pathname: string): boolean =>
  isListPath(pathname, MUNICIPALITIES_LIST_PATH)

export const parseMunicipalityDetailSlug = (pathname: string): string | undefined => {
  const match = pathname.match(municipalityDetailPathPattern)
  return match?.[1]
}

export const resolveMunicipalityListQuickActions = (
  role: CampaignRole,
  returnPath?: string,
): readonly ResolvedCampaignHomeAction[] => resolveStaffHomeQuickActions(role, returnPath)

export const resolveMunicipalityDetailQuickActions = (
  role: CampaignRole,
  municipalitySlug: string,
  returnPath?: string,
): readonly ResolvedCampaignHomeAction[] => {
  if (!isStaffCampaignRole(role)) return []

  const actions = homeActionsForRole(role).filter(
    (action) => action.id !== 'uncovered-municipalities',
  )
  return toHomeActionButtonProps(actions, { municipalitySlug, returnPath })
}

export const resolveMunicipalityQuickActionsForPath = (
  pathname: string,
  role: CampaignRole,
  context: CampaignQuickActionContext,
): readonly ResolvedCampaignHomeAction[] => {
  if (isMunicipalitiesListPath(pathname)) {
    return resolveMunicipalityListQuickActions(role, pathname)
  }

  const slug = context.municipalitySlug ?? parseMunicipalityDetailSlug(pathname)
  if (slug) {
    return resolveMunicipalityDetailQuickActions(role, slug, pathname)
  }

  return []
}
