/**
 * Client-safe quick-action context — routes and B80+ providers fill this so
 * `resolveQuickActionsForPath` can prefill wizard/list hrefs.
 */
export type CampaignQuickActionContext = {
  municipalitySlug?: string
  leadershipId?: number
  organizationSlug?: string
  activitySlug?: string
  demandSlug?: string
}

export const emptyCampaignQuickActionContext = (): CampaignQuickActionContext => ({})
