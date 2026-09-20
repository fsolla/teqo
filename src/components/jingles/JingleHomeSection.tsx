import Link from 'next/link'

import type { JingleViewModel } from '@/lib/jingle'

import { JINGLE_FOCUS_RING } from './focusRing'
import { JingleCards } from './JingleCards'
import { RadioFacade } from './RadioFacade'

type JingleHomeSectionProps = {
  jingles: readonly JingleViewModel[]
  showAll: boolean
}

const SEE_ALL_CONTROL = `inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-bold text-(--pt-red) underline-offset-4 hover:underline ${JINGLE_FOCUS_RING}`

/**
 * S22 — the home sound section (artefato: cenas 01/02/06/07): the Rádio 1313
 * facade (click-to-load) followed by up to three published jingles and the
 * "Ver todos" handoff to `/jingles` when more exist. With zero published
 * jingles the grid and the handoff are gone and only the radio stays
 * (fail-closed, same kill switch as S21); the page passes the already-cached
 * `getPublishedJingleItems()` listing in, so the section never re-reads.
 */
export const JingleHomeSection = ({ jingles, showAll }: JingleHomeSectionProps) => {
  const hasJingles = jingles.length > 0

  return (
    <section
      aria-labelledby="sound-title"
      data-home-section="sound"
      className="relative overflow-hidden border-b border-(--campaign-line) bg-(--campaign-cream)"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-20 h-64 w-64 rounded-full bg-(--pt-yellow)/45"
      />
      <div className="relative mx-auto w-full max-w-[1160px] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="campaign-section-eyebrow m-0 font-black tracking-[0.1em] text-(--pt-red) uppercase">
            A trilha da nossa caminhada
          </p>
          <h2
            id="sound-title"
            className="campaign-section-title campaign-sound-title m-0 mt-2 border-0 p-0 font-black tracking-[-0.03em] text-balance"
          >
            {hasJingles ? (
              <>
                Cante, baixe
                <br className="md:hidden" /> e espalhe
              </>
            ) : (
              'Sintonize com a Rádio 1313'
            )}
          </h2>
          <p className="campaign-section-copy mx-auto mt-3 max-w-xl text-(--campaign-muted)">
            {hasJingles
              ? 'Ouça a Rádio Jorge Solla 1313 e os jingles oficiais da campanha. Dê o play e baixe o seu preferido para levar com você.'
              : 'Ainda não há jingles publicados por aqui. Enquanto isso, ouça a Rádio Jorge Solla 1313.'}
          </p>
        </div>

        <RadioFacade compact={!hasJingles} />

        {hasJingles ? (
          <>
            <div className="mt-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6 lg:mt-12">
              <div>
                <p className="campaign-section-eyebrow m-0 font-black tracking-[0.1em] text-(--pt-red) uppercase">
                  Jingles oficiais
                </p>
                <h3 className="m-0 mt-1 font-[family-name:var(--font-exo2)] text-2xl font-black tracking-[-0.02em]">
                  <span className="md:hidden">Dê o play</span>
                  <span className="hidden md:inline">Dê o play. O próximo ritmo é seu.</span>
                </h3>
              </div>
              <span className="text-sm text-(--campaign-muted)">Um jingle toca por vez.</span>
            </div>

            <div className="mt-6">
              <JingleCards jingles={jingles} headingLevel="h4" />
            </div>

            {showAll ? (
              <div className="mt-8 text-center">
                <Link href="/jingles" className={SEE_ALL_CONTROL}>
                  Ver todos os jingles
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  )
}
