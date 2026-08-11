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
  /**
   * Dialog-style action bridged by the agenda page: opens the calendar-feed
   * dialog (C94). A function can live in this client-only context — never
   * crossed server→client.
   */
  openCalendarFeed?: () => void
  /** C114 — opens the Google Calendar mirror dialog (same bridge as above). */
  openGoogleCalendarSync?: () => void
}

export const emptyCampaignQuickActionContext = (): CampaignQuickActionContext => ({})
