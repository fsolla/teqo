import type { JingleViewModel } from '@/lib/jingle'

import { JingleCards } from './JingleCards'

/**
 * S21 — the jingles page shell (artefato: cenas 01/02): the player core
 * (`JingleCards`) owns the exclusivity state, the lazy audio and the download
 * name; this shell keeps the published band and the lazy-audio note. S22
 * reuses the same core in the home sound section.
 */
export const JinglePlayer = ({ jingles }: { jingles: readonly JingleViewModel[] }) => (
  <section aria-label="Jingles publicados" className="bg-white px-4 py-7 sm:px-8 sm:py-14">
    <JingleCards jingles={jingles} />

    <p className="m-0 mt-5 px-3 text-center text-xs leading-5 text-(--campaign-muted) md:hidden">
      Sem autoplay. O áudio só é carregado depois do play.
    </p>
  </section>
)
