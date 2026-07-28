/**
 * Client-safe half of `CampaignHoverTooltip`. These must NOT live in that
 * `'use client'` module: `CampaignTableHead` is a server component and renders
 * the tooltip for a column `description`, and a `'use client'` module turns
 * every export into a client reference that the server cannot call.
 */

/** Dotted-underline affordance for any label wrapped in a `CampaignHoverTooltip`. */
export const campaignHoverExplanationClassName =
  'underline decoration-dotted decoration-muted-foreground/70 underline-offset-2'

/** Maps a left/center/right layout align to the tooltip `align` it should open toward. */
export const campaignHoverTooltipAlign = (
  align: 'left' | 'center' | 'right',
): 'start' | 'center' | 'end' =>
  align === 'right' ? 'end' : align === 'center' ? 'center' : 'start'
