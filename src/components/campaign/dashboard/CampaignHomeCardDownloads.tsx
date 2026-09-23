import { ArrowDownIcon } from 'lucide-react'

import {
  CARD_DOWNLOAD_COUNTS_CAPTION,
  CARD_DOWNLOAD_COUNTS_EMPTY_BODY,
  CARD_DOWNLOAD_COUNTS_EMPTY_CAPTION,
  CARD_DOWNLOAD_COUNTS_EMPTY_TITLE,
  CARD_DOWNLOAD_COUNTS_SUBTITLE,
  CARD_DOWNLOAD_COUNTS_TITLE,
  type CardDownloadCountsView,
} from '@/lib/cardDownloadCounts'
import { formatElectionNumber } from '@/lib/electionFormat'

/**
 * S32 — the "Cards" block of the staff home: one absolute download counter per
 * card model, in the natural catalog order (six columns on desktop, one row per
 * model on mobile). It counts downloads, never people — no total, no
 * percentage, no series — and an unavailable aggregate omits the whole block
 * instead of claiming "no downloads yet".
 */
export const CampaignHomeCardDownloads = ({ view }: { view: CardDownloadCountsView }) => {
  if (view.state === 'unavailable') return null

  return (
    <section aria-label={CARD_DOWNLOAD_COUNTS_TITLE} className="mt-6 pb-4 md:pb-6">
      {/* `border-b-0 pb-0` neutralize the global `h2 { border-b pb-2 }` rule: the
          approved divider sits at the end of the summary above, not under this
          heading. */}
      <h2 className="border-b-0 pb-0 text-base font-semibold">{CARD_DOWNLOAD_COUNTS_TITLE}</h2>

      {view.state === 'empty' ? (
        <>
          <div className="mt-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:px-5 sm:py-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
              >
                <ArrowDownIcon className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{CARD_DOWNLOAD_COUNTS_EMPTY_TITLE}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {CARD_DOWNLOAD_COUNTS_EMPTY_BODY}
                </p>
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {CARD_DOWNLOAD_COUNTS_EMPTY_CAPTION}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{CARD_DOWNLOAD_COUNTS_SUBTITLE}</p>
          <dl className="mt-3 grid grid-cols-1 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 sm:grid-cols-6">
            {view.counts.map((entry) => (
              <div
                key={entry.modelId}
                className="flex min-h-[58px] min-w-0 items-center justify-between gap-4 border-t border-border px-4 py-2.5 first:border-t-0 sm:block sm:min-h-0 sm:border-t-0 sm:border-l sm:first:border-l-0"
              >
                <dt className="text-xs font-medium leading-4 text-muted-foreground">
                  {entry.label}
                </dt>
                <dd className="text-lg font-medium tracking-tight tabular-nums sm:mt-1">
                  {formatElectionNumber(entry.count)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {CARD_DOWNLOAD_COUNTS_CAPTION}
          </p>
        </>
      )}
    </section>
  )
}
