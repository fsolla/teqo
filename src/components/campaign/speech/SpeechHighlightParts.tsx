import type { SpeechHighlightPart } from '@/lib/speechHighlight'

/**
 * C154 — renders a speech text split into highlighted/normal parts (the card
 * excerpt and the detail transcript share the same marking).
 */
export const SpeechHighlightParts = ({ parts }: { parts: readonly SpeechHighlightPart[] }) => (
  <>
    {parts.map((part, index) =>
      part.highlighted ? (
        <mark key={index} className="rounded-sm bg-amber-200/70 px-0.5 text-foreground">
          {part.text}
        </mark>
      ) : (
        <span key={index}>{part.text}</span>
      ),
    )}
  </>
)
