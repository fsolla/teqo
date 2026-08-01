/**
 * Client-safe quick-action context — routes and B80+ providers fill this so
 * `resolveQuickActionsForPath` can prefill wizard/list hrefs.
 */
export type CampaignQuickActionContext = {
  municipalitySlug?: string
  municipalityId?: number
  leadershipId?: number
  organizationSlug?: string
  activitySlug?: string
  demandSlug?: string
  advisorId?: number
}

export const emptyCampaignQuickActionContext = (): CampaignQuickActionContext => ({})
