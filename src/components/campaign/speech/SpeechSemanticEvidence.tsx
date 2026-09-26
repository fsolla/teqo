import { SparklesIcon } from 'lucide-react'

import { SpeechExcerpt } from '@/components/campaign/speech/SpeechExcerpt'
import type { SpeechHighlightedExcerpt } from '@/lib/speechHighlight'

/**
 * C229 — the shared semantic marks of a result card (design scenes 01/02): the
 * "Tema" seal (the engine surfaced the row by meaning), the coexisting "Termo
 * exato" seal (the row also contains the literal query) and the evidence block
 * "Trecho mais próximo do tema" — a real passage, no highlight and no score.
 * Both the Câmara and the web cards render exactly this structure.
 */

export const SpeechSemanticBadges = ({ matchedTextSearch }: { matchedTextSearch: boolean }) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="inline-flex h-5 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
      <SparklesIcon className="size-3" aria-hidden="true" />
      Tema
    </span>
    {matchedTextSearch ? (
      <span className="inline-flex h-5 items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground">
        Termo exato
      </span>
    ) : null}
  </div>
)

/**
 * C229 — the seal of a literal result inside the degraded theme path (design
 * scene 04): the engine was down, the list below is by term. The plain exact
 * search never renders it (the page only passes `literalFallback` when the
 * actor asked for the theme).
 */
export const SpeechLiteralMatchBadge = () => (
  <span
    data-testid="speech-literal-badge"
    className="inline-flex h-5 items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium text-foreground"
  >
    Termo exato
  </span>
)

export const SpeechSemanticProvenance = ({ excerpt }: { excerpt: SpeechHighlightedExcerpt }) => {
  if (excerpt.parts.length === 0) return null

  return (
    <div className="rounded-lg border-l-2 border-primary bg-primary/[0.035] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
        Trecho mais próximo do tema
      </p>
      <SpeechExcerpt
        excerpt={excerpt}
        className="mt-1 text-sm leading-6 text-foreground/90"
        quoted
      />
    </div>
  )
}
