import { Plus } from 'lucide-react'

import { resolveStaffHomeQuickActions } from '@/lib/campaignHomeActions'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

const STATE_DEPUTY_LIST_PATH = '/campanha/dobradinhas' as const
const STATE_DEPUTY_CREATE_PATH = '/campanha/dobradinhas/nova' as const
const STATE_DEPUTY_PATH_PREFIX = `${STATE_DEPUTY_LIST_PATH}/` as const

const isStateDeputyListPath = (pathname: string): boolean =>
  pathname === STATE_DEPUTY_LIST_PATH || pathname === `${STATE_DEPUTY_LIST_PATH}/`

const isStateDeputyCreatePath = (pathname: string): boolean => pathname === STATE_DEPUTY_CREATE_PATH

export const parseStateDeputyDetailSlug = (pathname: string): string | undefined => {
  if (!pathname.startsWith(STATE_DEPUTY_PATH_PREFIX)) return undefined
  const slug = pathname.slice(STATE_DEPUTY_PATH_PREFIX.length)
  if (!slug || slug.includes('/') || slug === 'nova') return undefined
  return slug
}

export const matchesDobradinhasQuickActionSurface = (pathname: string): boolean =>
  isStateDeputyListPath(pathname) ||
  isStateDeputyCreatePath(pathname) ||
  parseStateDeputyDetailSlug(pathname) !== undefined

const newStateDeputyAction = (): CampaignQuickAction => ({
  id: 'new-state-deputy',
  label: 'Nova dobradinha',
  icon: Plus,
  description: 'Cadastrar um deputado estadual parceiro da campanha',
  href: STATE_DEPUTY_CREATE_PATH,
})

/** B83 — `/dobradinhas` list, detail and create surfaces. */
export const resolveDobradinhasQuickActions = (
  pathname: string,
  role: CampaignRole,
): readonly CampaignQuickAction[] => {
  if (!matchesDobradinhasQuickActionSurface(pathname) || !isStaffCampaignRole(role)) {
    return []
  }

  const staffActions = resolveStaffHomeQuickActions(role, pathname)

  if (isStateDeputyListPath(pathname)) {
    return [newStateDeputyAction(), ...staffActions]
  }

  return staffActions
}
