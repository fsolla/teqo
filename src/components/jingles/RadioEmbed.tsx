import { cn } from '@/lib/utils'

const RADIO_PLAYER_URL = 'https://zeno.fm/player/jorge-solla-1313/'

/**
 * S24 — the Rádio Jorge Solla 1313 embed (artefato: cenas 01/02/03), replacing
 * the S22 click-to-load facade: the official zeno.fm player is server-rendered
 * and starts loading with the page — no button, state machine or request gated
 * behind a click. The frame keeps the reserved 150/168px footprint from the
 * first paint (no jump) and stays a bare third-party widget (no transparency
 * line, chip or shield). `compact` is the zero-jingles variant: the frame
 * narrows and centers; the section header/copy and the jingles grid are owned
 * by `JingleHomeSection` and unchanged.
 */
export const RadioEmbed = ({ compact = false }: { compact?: boolean }) => (
  <article
    data-radio
    aria-label="Player da Rádio Jorge Solla 1313"
    className={cn(
      'overflow-hidden rounded-[14px] border border-(--campaign-line) bg-white p-3 shadow-[0_10px_28px_rgb(71_19_14/7%)] md:p-4',
      compact ? 'mx-auto mt-8 max-w-[880px]' : 'mt-9',
    )}
  >
    <iframe
      src={RADIO_PLAYER_URL}
      title="Player da Rádio Jorge Solla 1313 no zeno.fm"
      allow="autoplay"
      className="h-[150px] w-full rounded-xl border-0 bg-(--campaign-band) md:h-[168px]"
    />
  </article>
)
