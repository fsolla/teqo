import { Plus } from 'lucide-react'

import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import {
  ORGANIZATION_NEW_PATH,
  type OrganizationQuickActionSurface,
} from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

const listQuickActions = (): readonly CampaignQuickAction[] => [
  {
    id: 'new-organization',
    label: 'Nova organização',
    icon: Plus,
    description: 'Cadastrar sindicato, associação ou movimento de apoio',
    href: ORGANIZATION_NEW_PATH,
  },
]

export const resolveOrganizationQuickActions = (
  surface: OrganizationQuickActionSurface,
  role: CampaignRole,
  _context: CampaignQuickActionContext,
): readonly CampaignQuickAction[] => {
  if (!isStaffCampaignRole(role)) return []

  if (surface.kind === 'list') {
    return listQuickActions()
  }

  // Detail: leadership list has no organization filter URL yet (B88 as-built);
  // orgs rarely have a single obvious municipality for A1–A5 prefills.
  return []
}
