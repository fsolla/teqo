import Link from 'next/link'

import { SpeechCutStatusBadge } from '@/components/campaign/speech/SpeechCutStatusBadge'
import { SpeechHighlightParts } from '@/components/campaign/speech/SpeechHighlightParts'
import { campaignSpeechCutDetailHref } from '@/lib/campaignPaths'
import { formatSpeechClock } from '@/lib/speechClock'
import type { SpeechCutViewModel } from '@/lib/speechCut'
import { splitHighlightedParts } from '@/lib/speechHighlight'

const countLabel = (count: number): string =>
  count === 1 ? '1 corte desta fala' : `${count} cortes desta fala`

/** Touch-sized outlined button on mobile; the compact text link on `md+`. */
const CutAction = ({ cut }: { cut: SpeechCutViewModel }) => (
  <Link
    href={campaignSpeechCutDetailHref(cut.id)}
    aria-label={`Abrir corte: ${cut.title}`}
    className="flex min-h-11 w-full shrink-0 items-center justify-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground underline-offset-4 hover:bg-muted md:min-h-0 md:w-fit md:justify-start md:border-0 md:bg-transparent md:px-0 md:text-primary md:hover:bg-transparent md:hover:underline"
  >
    Abrir corte →
  </Link>
)

/**
 * C174 — the cuts of a speech nested under its search result. A list that only
 * links to the C168 detail (editing stays there): the acervo search answers
 * "this speech already rendered a cut" without becoming a second library. The
 * origin-only card (`showDescription`) mirrors the approved scene: the matched
 * term highlighted and the cut description as the evidence.
 */
export const SpeechNestedCuts = ({
  cuts,
  caption,
  query,
  showDescription = false,
}: {
  cuts: readonly SpeechCutViewModel[]
  caption?: string
  /** The search term, highlighted in the title. */
  query?: string
  /** CENA 05 — origin-only result: title + description, action below. */
  showDescription?: boolean
}) => (
  <div className="mt-4 border-l pl-4">
    <p className="mb-2 text-xs font-medium text-muted-foreground">
      {caption ?? countLabel(cuts.length)}
    </p>
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {cuts.map((cut) => (
        <li key={cut.id} className="rounded-lg bg-muted/55 p-3 ring-1 ring-border">
          <div className="flex flex-wrap items-center gap-2">
            <SpeechCutStatusBadge status={cut.status} />
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatSpeechClock(cut.durationSeconds)}
            </span>
          </div>
          {showDescription ? (
            <>
              <p className="mt-2 text-sm font-medium">
                <SpeechHighlightParts parts={splitHighlightedParts(cut.title, query ?? '')} />
              </p>
              {cut.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{cut.description}</p>
              ) : null}
              <div className="mt-3">
                <CutAction cut={cut} />
              </div>
            </>
          ) : (
            <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-x-4">
              <p className="text-sm font-medium">
                <SpeechHighlightParts parts={splitHighlightedParts(cut.title, query ?? '')} />
              </p>
              <CutAction cut={cut} />
            </div>
          )}
        </li>
      ))}
    </ul>
  </div>
)
