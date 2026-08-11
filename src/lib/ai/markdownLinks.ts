export type ExternalLinkTarget = {
  target: '_blank'
  rel: 'noopener noreferrer'
}

/**
 * App-internal destinations the assistant emits — the B162 link catalog only
 * ever produces `/campanha…` paths (B187/B188).
 */
const CAMPAIGN_INTERNAL_LINK = /^\/campanha(?:\/|$)/

export const isCampaignInternalLink = (href: string): boolean => CAMPAIGN_INTERNAL_LINK.test(href)

/**
 * Decides whether a markdown href rendered by the Sollinha chat should open in
 * a new tab. Only absolute http(s) URLs (and protocol-relative ones) qualify —
 * everything the assistant produces today (`/campanha/...` paths) stays as a
 * same-tab anchor, and non-web protocols (`mailto:`, `tel:`, `#anchor`) render
 * untouched.
 */
export const externalLinkTarget = (href: string): ExternalLinkTarget | null => {
  if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
    return { target: '_blank', rel: 'noopener noreferrer' }
  }
  return null
}

/** The click metadata that decides same-tab vs new-tab navigation (B198). */
export type LinkClickMeta = {
  button: number
  altKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  defaultPrevented: boolean
}

/**
 * B198 — a mobile link click on the mobile drawer closes it only for the
 * navigation that replaces the page in the SAME tab: an internal link touched
 * with a plain left click. Modified clicks (cmd/ctrl/shift/alt), middle clicks
 * and already-prevented clicks open the destination in a new tab (or nowhere)
 * — the origin tab keeps the drawer so the conversation is where it was. The
 * desktop panel never closes (the accept keeps it open while navigating).
 */
export const shouldCloseDrawerOnLinkClick = (
  href: string,
  isMobile: boolean,
  event: LinkClickMeta,
): boolean => {
  if (!isMobile) return false
  if (!isCampaignInternalLink(href)) return false
  if (event.defaultPrevented) return false
  if (event.button !== 0) return false
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false
  return true
}
