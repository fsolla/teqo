import { loadNotificationBellData } from '@/app/(campaign)/campanha/actions/notifications'
import { CampaignNotificationBell } from '@/components/campaign/shell/CampaignNotificationBell'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import type { CampaignUser } from '@/payload-types'

type CampaignNotificationBellSlotProps = {
  user: CampaignUser
}

export const CampaignNotificationBellSlot = async ({ user }: CampaignNotificationBellSlotProps) => {
  if (!isStaffCampaignRole(user.role)) return null

  const bellData = await loadNotificationBellData()
  if (!bellData) return null

  return <CampaignNotificationBell {...bellData} />
}
