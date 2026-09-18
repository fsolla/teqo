import Link from 'next/link'

import type { ReelLibraryItemViewModel } from '@/lib/reel'

/**
 * C194 — one card of the reel library: the 9:16 cover leads, the title and the
 * feature follow, and the whole card is the link to the detail (there is no
 * second action on the card, so the "Abrir reel" affordance is visual).
 */
export const ReelLibraryCard = ({ reel }: { reel: ReelLibraryItemViewModel }) => (
  <article className="group overflow-hidden rounded-xl border border-border bg-card">
    <Link href={reel.detailHref} className="block focus-visible:outline-none">
      <div className="relative aspect-[9/16] overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element -- the cover is served by the authenticated campaign route; the Next optimizer has no session cookie. */}
        <img
          src={reel.coverUrl}
          alt={reel.coverAlt}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2 py-1 text-[11px] font-medium text-foreground">
          {reel.statusLabel}
        </span>
        <div
          aria-hidden="true"
          className="absolute inset-x-3 bottom-3 rounded-lg bg-black/65 p-3 text-white"
        >
          <p className="text-sm leading-4 font-semibold">{reel.title}</p>
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-sm leading-5 font-medium">{reel.title}</h3>
        <p className="mt-1.5 text-xs text-muted-foreground">{reel.featureLabel}</p>
        {reel.publishedAtLabel ? (
          <p className="mt-1 text-xs text-muted-foreground">Publicado em {reel.publishedAtLabel}</p>
        ) : null}
        <span className="mt-3 inline-flex h-8 items-center text-xs font-medium underline underline-offset-4 group-hover:text-primary">
          Abrir reel
        </span>
      </div>
    </Link>
  </article>
)
