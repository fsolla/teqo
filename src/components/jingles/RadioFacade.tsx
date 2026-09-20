'use client'

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { JINGLE_FOCUS_RING } from './focusRing'

/**
 * S22 — the Rádio Jorge Solla 1313 card with a click-to-load facade
 * (artefato: cenas 01/02/03/04/07): the official zeno.fm widget is only mounted
 * after "Ouvir a rádio", so no third-party request, script or ad loads on the
 * home pageview. While the iframe answers, the reaction is `loading`
 * (`role="status"` + `aria-busy`), promoting to `loaded` on `onLoad`; the three
 * states share one reserved footprint, so nothing jumps (CLS). The external
 * link stays available in every state. `compact` is the Cena 07 variant: the
 * zero-jingles home narrows the card and drops the facade's intro and note.
 */

const RADIO_PAGE_URL = 'https://zeno.fm/radio/jorge-solla-1313/'
const RADIO_PLAYER_URL = 'https://zeno.fm/player/jorge-solla-1313/'

type RadioState = 'facade' | 'loading' | 'loaded'

const ExternalLink = ({ className }: { className?: string }) => (
  <a
    href={RADIO_PAGE_URL}
    target="_blank"
    rel="noopener noreferrer"
    className={cn(
      'inline-flex min-h-11 items-center gap-1.5 rounded-md font-bold text-(--pt-red) underline-offset-4 hover:underline',
      JINGLE_FOCUS_RING,
      className,
    )}
  >
    Abrir no Zeno
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  </a>
)

const ShieldIcon = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className={cn('h-4 w-4 flex-none', className)}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
  </svg>
)

const RadioArt = ({ compact }: { compact?: boolean }) => (
  <div
    className={cn(
      'campaign-radio-art flex h-[190px] flex-col justify-between p-5 text-white md:h-auto md:p-6',
      compact ? 'sm:min-h-[220px]' : 'md:min-h-[270px] lg:p-7',
    )}
  >
    <div className="flex items-center justify-between">
      <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 font-[family-name:var(--font-exo2)] text-[10px] font-black tracking-[0.1em] uppercase md:text-[11px]">
        Rádio online
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6 text-(--pt-yellow) md:h-7 md:w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9M8.5 15.5a5 5 0 0 1 0-7M19.1 4.9c3.9 3.9 3.9 10.3 0 14.2M15.5 8.5a5 5 0 0 1 0 7" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    </div>
    <Image
      src="/campaign-kit/numero-negativo.png"
      alt="Jorge Solla 1313 — Mais Saúde, Mais Futuro"
      width={1037}
      height={595}
      className={cn(
        'h-auto self-center object-contain',
        compact ? 'w-[155px] sm:w-[165px]' : 'w-[155px] md:w-[190px]',
      )}
    />
    <div
      aria-hidden="true"
      className="campaign-radio-wave flex h-6 items-center justify-center gap-1.5 md:h-8"
    >
      <span className="h-2 md:h-3" />
      <span className="h-5 md:h-6" />
      <span className="h-3 md:h-4" />
      <span className="h-6 md:h-8" />
      <span className="h-4 md:h-5" />
      <span className="hidden h-7 md:block" />
      <span className="hidden h-3 md:block" />
    </div>
  </div>
)

const RadioPanel = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      // The loaded state's real footprint (header + 150/168px widget + note)
      // is the tallest of the three, so it is the reserved height for facade,
      // loading and loaded alike — no vertical jump (Cena 04's contract).
      'flex min-h-[330px] flex-col justify-center p-5 md:min-h-[312px] md:p-8',
      className,
    )}
    {...props}
  />
)

const FacadePlayButton = ({ onRequestPlayer }: { onRequestPlayer: () => void }) => (
  <button
    type="button"
    onClick={onRequestPlayer}
    className={cn(
      'inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-[10px] bg-(--pt-red) px-5 font-[family-name:var(--font-exo2)] font-black text-white md:w-auto',
      'shadow-[0_5px_0_#751111,0_10px_22px_rgb(71_19_14/18%)] transition-[transform,box-shadow,filter] duration-150 ease-out',
      'hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_7px_0_#751111,0_13px_25px_rgb(71_19_14/22%)]',
      'active:translate-y-[3px] active:shadow-[0_2px_0_#751111]',
      'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
      JINGLE_FOCUS_RING,
    )}
  >
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
      <path d="m8 5 11 7-11 7z" />
    </svg>
    Ouvir a rádio
  </button>
)

const FacadePanel = ({
  compact,
  onRequestPlayer,
}: {
  compact?: boolean
  onRequestPlayer: () => void
}) => (
  <RadioPanel>
    {compact ? (
      <>
        <h3 className="m-0 font-[family-name:var(--font-exo2)] text-2xl font-black tracking-[-0.02em]">
          Rádio Jorge Solla 1313
        </h3>
        <p className="mt-2 max-w-xl text-sm leading-6 text-(--campaign-muted)">
          O player oficial só é carregado quando você pedir.
        </p>
        <div className="mt-5 flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-x-5">
          <FacadePlayButton onRequestPlayer={onRequestPlayer} />
          <ExternalLink className="justify-center md:justify-start" />
        </div>
      </>
    ) : (
      <>
        <p className="m-0 hidden font-[family-name:var(--font-exo2)] text-xs font-black tracking-[0.1em] text-(--pt-red) uppercase md:block">
          Sintonize com a gente
        </p>
        <h3 className="m-0 mt-2 font-[family-name:var(--font-exo2)] text-2xl leading-tight font-black tracking-[-0.025em] md:text-[31px]">
          Rádio Jorge Solla 1313
        </h3>
        <p className="mt-3 max-w-xl text-[15px] leading-6 text-(--campaign-muted)">
          <span className="md:hidden">Carregue o player oficial só quando quiser ouvir.</span>
          <span className="hidden md:inline">
            Clique para carregar o player oficial e ouvir a programação da rádio.
          </span>
        </p>
        <div className="mt-5 flex flex-col gap-2 md:mt-6 md:flex-row md:flex-wrap md:items-center md:gap-x-6">
          <FacadePlayButton onRequestPlayer={onRequestPlayer} />
          <ExternalLink className="justify-center md:justify-start" />
        </div>
        <p className="mt-3 flex flex-col items-center gap-1 text-center text-xs leading-5 text-black/55 md:flex-row md:items-start md:gap-2 md:text-left">
          <ShieldIcon className="hidden md:block" />
          <span className="md:hidden">O player do zeno.fm só carrega depois do clique.</span>
          <span className="hidden md:inline">
            O player do zeno.fm só é carregado depois do seu clique.
          </span>
        </p>
      </>
    )}
  </RadioPanel>
)

const LoadingPanel = ({ panelRef }: { panelRef?: React.Ref<HTMLDivElement> }) => (
  <RadioPanel ref={panelRef} tabIndex={-1} role="status" aria-live="polite" aria-busy="true">
    <div className="flex items-start justify-between gap-5">
      <div>
        <p className="m-0 font-[family-name:var(--font-exo2)] text-xs font-black tracking-[0.1em] text-(--pt-red) uppercase">
          Sintonize com a gente
        </p>
        <h3 className="m-0 mt-1 font-[family-name:var(--font-exo2)] text-2xl leading-tight font-black tracking-[-0.02em] md:text-[28px]">
          Rádio Jorge Solla 1313
        </h3>
        <p className="mt-3 text-sm font-bold">Carregando o player da rádio…</p>
        <p className="mt-1 text-xs text-(--campaign-muted)">Isso pode levar alguns segundos.</p>
      </div>
      <div className="campaign-radio-spinner mt-2 flex-none" aria-hidden="true" />
    </div>
    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
      <button
        type="button"
        disabled
        aria-busy="true"
        className="min-h-11 cursor-default rounded-[10px] bg-[rgb(162_28_28/10%)] px-5 text-sm font-bold text-[#7d4848]"
      >
        Carregando…
      </button>
      <ExternalLink className="text-sm" />
    </div>
  </RadioPanel>
)

/**
 * Mounted at the click (with the iframe) but kept `hidden` until `onLoad`:
 * `display:none` does not stop the frame from loading, so the same element
 * survives the `loading → loaded` promotion and the widget never refetches.
 */
const LoadedPanel = ({ hidden, onLoaded }: { hidden: boolean; onLoaded: () => void }) => (
  <div className={cn(hidden && 'hidden')}>
    <RadioPanel>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 font-[family-name:var(--font-exo2)] text-2xl font-black tracking-[-0.02em]">
          Rádio Jorge Solla 1313
        </h3>
        <ExternalLink className="text-sm" />
      </div>
      <iframe
        src={RADIO_PLAYER_URL}
        title="Player da Rádio Jorge Solla 1313 no zeno.fm"
        allow="autoplay"
        onLoad={onLoaded}
        className="h-[150px] w-full rounded-xl border-0 bg-(--campaign-band) md:h-[168px]"
      />
      <p className="mt-2 mb-0 text-xs leading-5 text-(--campaign-muted)">
        Player fornecido por zeno.fm. Ao usar, você acessa um serviço externo.
      </p>
    </RadioPanel>
  </div>
)

export const RadioFacade = ({ compact = false }: { compact?: boolean }) => {
  const [state, setState] = useState<RadioState>('facade')
  const statusRef = useRef<HTMLDivElement>(null)

  // The facade's button unmounts at the click; move the keyboard focus to the
  // status region so the journey does not fall back to the document body.
  useEffect(() => {
    if (state === 'loading') statusRef.current?.focus()
  }, [state])

  return (
    <article
      data-radio
      data-radio-state={state}
      className={cn(
        'grid overflow-hidden rounded-[18px] border border-[rgb(71_19_14/18%)] bg-white shadow-[0_16px_44px_rgb(71_19_14/10%)]',
        compact
          ? 'mx-auto mt-8 max-w-[880px] sm:grid-cols-[240px_1fr]'
          : 'mt-9 md:grid-cols-[270px_1fr]',
      )}
    >
      <RadioArt compact={compact} />
      {state === 'facade' ? (
        <FacadePanel compact={compact} onRequestPlayer={() => setState('loading')} />
      ) : (
        <>
          {state === 'loading' ? <LoadingPanel panelRef={statusRef} /> : null}
          <LoadedPanel hidden={state === 'loading'} onLoaded={() => setState('loaded')} />
        </>
      )}
    </article>
  )
}
