export type ExternalLinkTarget = {
  target: '_blank'
  rel: 'noopener noreferrer'
}

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
