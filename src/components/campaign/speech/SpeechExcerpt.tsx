import { SpeechHighlightParts } from '@/components/campaign/speech/SpeechHighlightParts'
import type { SpeechHighlightedExcerpt } from '@/lib/speechHighlight'

/**
 * C216-FOLLOWUP-DRY — the truncated excerpt shared by the speech cards and the
 * C192 provenance block: a leading `… ` and a trailing ` …` around the
 * highlighted parts, nothing when there is no excerpt. `quoted` wraps the
 * provenance excerpt in typographic quotes; `className` keeps each site's own
 * line-height/margin (the sites differ on purpose).
 */
export const SpeechExcerpt = ({
  excerpt,
  className,
  quoted = false,
}: {
  excerpt: SpeechHighlightedExcerpt
  className: string
  quoted?: boolean
}) => {
  if (excerpt.parts.length === 0) return null

  const prefix = excerpt.truncatedStart ? '… ' : ''
  const suffix = excerpt.truncatedEnd ? ' …' : ''

  return (
    <p className={className}>
      {quoted ? `“${prefix}` : prefix}
      <SpeechHighlightParts parts={excerpt.parts} />
      {quoted ? `${suffix}”` : suffix}
    </p>
  )
}
