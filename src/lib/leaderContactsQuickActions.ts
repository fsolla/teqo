import {
  homeActionsForRole,
  toHomeActionButtonProps,
  type ResolvedCampaignHomeAction,
} from '@/lib/campaignHomeActions'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import type { CampaignRole } from '@/lib/campaignRoles'

/** In-page anchors on `/campanha/meus-contatos` — hash navigation from the B89 drawer. */
export const LEADER_CONTACT_FORM_HASH = '#leader-contact-form' as const
export const LEADER_CONTACTS_LIST_HASH = '#leader-contacts-list' as const

const toLeaderContactsQuickAction = (action: ResolvedCampaignHomeAction): CampaignQuickAction => {
  if (action.id === 'register-supporter') {
    return { ...action, href: LEADER_CONTACT_FORM_HASH }
  }
  if (action.id === 'my-contacts') {
    return { ...action, href: LEADER_CONTACTS_LIST_HASH }
  }
  return action
}

export const resolveLeaderContactsQuickActions = (
  role: CampaignRole,
  _context: CampaignQuickActionContext,
): readonly CampaignQuickAction[] => {
  if (role !== 'leader') return []

  return toHomeActionButtonProps(homeActionsForRole('leader')).map(toLeaderContactsQuickAction)
}
