'use client'

import { CheckIcon, CopyIcon, InfoIcon } from 'lucide-react'
import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

import { WhatsAppIcon } from '@/components/socialIcons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { copyFeedbackLabels, copyFeedbackLiveMessages, useCopyFeedback } from '@/lib/copyFeedback'
import {
  buildRadioShareWhatsAppUrl,
  JINGLE_PLAY_EVENT,
  RADIO_CONNECT_TIMEOUT_MS,
  RADIO_PAGE_URL,
  RADIO_PLAY_EVENT,
  RADIO_SHARE_MESSAGE,
  RADIO_STREAM_URL,
  RADIO_TITLE,
} from '@/lib/radio'
import { cn } from '@/lib/utils'

import { JINGLE_FOCUS_RING } from './focusRing'

type RadioStatus = 'idle' | 'connecting' | 'playing' | 'error'

const PLAY_CONTROL = cn(
  'inline-flex size-12 flex-none items-center justify-center rounded-full bg-(--pt-yellow) text-(--pt-yellow-ink) md:size-14',
  'shadow-[0_6px_0_#cfb900,0_10px_22px_rgb(0_0_0/15%)] transition-[transform,box-shadow,filter,opacity] duration-150 ease-out',
  'hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_8px_0_#cfb900,0_12px_24px_rgb(0_0_0/18%)]',
  'active:translate-y-[3px] active:shadow-[0_3px_0_#cfb900]',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
  JINGLE_FOCUS_RING,
)

const SHARE_OUTLINE = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[rgb(162_28_28/32%)] bg-transparent px-3.5',
  'font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-red) no-underline',
  'transition-colors duration-150 ease-out hover:border-(--pt-red) hover:bg-[rgb(162_28_28/7%)] motion-reduce:transition-none',
  JINGLE_FOCUS_RING,
)

const SHARE_LINK = cn(
  'inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-bold text-(--pt-red)',
  JINGLE_FOCUS_RING,
)

const SHARE_PRIMARY = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-(--pt-red) px-4 text-sm font-black text-white no-underline',
  'font-[family-name:var(--font-exo2)] transition-[filter] duration-150 ease-out hover:brightness-110 motion-reduce:transition-none',
  JINGLE_FOCUS_RING,
)

const RETRY_CONTROL = cn(
  'inline-flex min-h-11 items-center rounded-lg bg-(--pt-red) px-4 text-sm font-black text-white',
  'font-[family-name:var(--font-exo2)] transition-[filter] duration-150 ease-out hover:brightness-110 motion-reduce:transition-none',
  JINGLE_FOCUS_RING,
)

const ZENO_LINK = cn(
  'inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold text-(--pt-red) underline underline-offset-4',
  JINGLE_FOCUS_RING,
)

const PlayIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-5 w-5 fill-current stroke-current md:h-[25px] md:w-[25px]"
  >
    <path d="m8 5 11 7-11 7z" />
  </svg>
)

const PauseIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-5 w-5 fill-current stroke-current md:h-[25px] md:w-[25px]"
  >
    <path d="M8 5h3v14H8zM14 5h3v14h-3z" />
  </svg>
)

const ShareIcon = ({ className }: { className: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
  </svg>
)

/**
 * S25 (Cena 05) — the radio share control: one discreet trigger with the two
 * approved exits (the literal message into the sender's own WhatsApp, or the
 * message copied to the clipboard with the shared feedback). The copy writes
 * the literal, link included — what circulates is the message, matching the
 * gate's box. Private to this file: the radio owns its share surface.
 */
const RadioShareControl = ({ variant }: { variant: 'outline' | 'link' }) => {
  const [open, setOpen] = useState(false)
  const { feedback, copy } = useCopyFeedback()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={variant === 'outline' ? SHARE_OUTLINE : SHARE_LINK}
          aria-label={`Compartilhar ${RADIO_TITLE}`}
        >
          <ShareIcon className={variant === 'outline' ? 'size-[18px]' : 'size-4'} />
          Compartilhar
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        // The portal lives under `document.body`, outside the home's
        // `[data-theme='campaign-site']` wrapper: without the attribute the
        // campaign tokens (--pt-red, --campaign-band, …) are undefined and the
        // primary WhatsApp CTA renders invisible (same fix as CardsStudio).
        data-theme="campaign-site"
        className="w-80 rounded-xl border border-(--campaign-line) bg-white p-4 shadow-xl"
      >
        <p className="m-0 font-[family-name:var(--font-exo2)] text-base font-black">
          Compartilhar a rádio
        </p>
        <p className="mt-2 rounded-lg bg-(--campaign-band) p-3 text-xs leading-5 break-words text-(--campaign-muted)">
          {RADIO_SHARE_MESSAGE}
        </p>
        <div className="mt-3 grid gap-2">
          <a
            href={buildRadioShareWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className={SHARE_PRIMARY}
            onClick={() => setOpen(false)}
          >
            <WhatsAppIcon className="size-4" />
            Compartilhar no WhatsApp
          </a>
          <button
            type="button"
            className={cn(SHARE_OUTLINE, 'w-full')}
            onClick={() => void copy(RADIO_SHARE_MESSAGE)}
          >
            {feedback === 'copied' ? (
              <CheckIcon className="size-4" aria-hidden="true" />
            ) : (
              <CopyIcon className="size-4" aria-hidden="true" />
            )}
            {copyFeedbackLabels[feedback]}
          </button>
        </div>
        <span aria-live="polite" className="sr-only">
          {copyFeedbackLiveMessages[feedback]}
        </span>
      </PopoverContent>
    </Popover>
  )
}

/**
 * S25 — the home radio player (artefato: cenas 01–05). The zeno.fm iframe of
 * S24 is gone: this client component owns a bare `<audio preload="none">`
 * pointed at the stream, so no request to the stream (or any third party) leaves
 * before the visitor's play. The state machine (`idle → connecting → playing |
 * error`) turns a refused `play()` or a connection that never delivers audio
 * into the honest error state with retry and "Ouvir no Zeno" — never an
 * infinite spinner. `compact` is the zero-jingles variant (centered, share on
 * the bottom row); with jingles the section grid follows the gate's Cena 01 on
 * `md+` and the Cena 02 row on mobile. Exclusivity with the jingles is the
 * `radio:play`/`radio:pause`/`jingle:play` broadcast from `lib/radio`.
 */
export const RadioPlayer = ({ compact = false }: { compact?: boolean }) => {
  const [status, setStatus] = useState<RadioStatus>('idle')
  const audioRef = useRef<HTMLAudioElement>(null)
  // Invalidates the pending play()/timeout of a superseded attempt: pausing or
  // retrying during `connecting` must not let the old attempt win later.
  const attemptRef = useRef(0)
  // Event handlers read the live status without re-subscribing window listeners.
  const statusRef = useRef<RadioStatus>('idle')

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const stopPlayback = useCallback((next: 'idle' | 'error') => {
    attemptRef.current += 1
    audioRef.current?.pause()
    setStatus(next)
  }, [])

  const start = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return

    // The jingle stops on the gesture itself, even if the stream then fails.
    window.dispatchEvent(new CustomEvent(RADIO_PLAY_EVENT))

    const attempt = (attemptRef.current += 1)
    setStatus('connecting')
    // The stream answers 302 with a per-request signed URL: a retry needs a new
    // request, and `load()` is what discards the failed one.
    audio.load()
    void audio
      .play()
      .then(() => {
        if (attemptRef.current === attempt) setStatus('playing')
      })
      .catch(() => {
        if (attemptRef.current === attempt) stopPlayback('error')
      })
  }, [stopPlayback])

  const toggle = useCallback(() => {
    if (statusRef.current === 'playing' || statusRef.current === 'connecting') {
      stopPlayback('idle')
      return
    }
    start()
  }, [start, stopPlayback])

  // Never an infinite spinner: a stream that accepts the connection and never
  // delivers audio becomes the honest error state after the timeout.
  useEffect(() => {
    if (status !== 'connecting') return
    const timeout = setTimeout(() => stopPlayback('error'), RADIO_CONNECT_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [status, stopPlayback])

  // One audio at a time: a jingle started anywhere pauses the radio.
  useEffect(() => {
    const onJinglePlay = () => {
      if (statusRef.current !== 'playing' && statusRef.current !== 'connecting') return
      stopPlayback('idle')
    }
    window.addEventListener(JINGLE_PLAY_EVENT, onJinglePlay)
    return () => window.removeEventListener(JINGLE_PLAY_EVENT, onJinglePlay)
  }, [stopPlayback])

  return (
    <article
      data-radio
      data-state={status}
      aria-label={`Player da ${RADIO_TITLE}`}
      className={cn(
        'overflow-hidden rounded-[14px] border border-(--campaign-line) bg-white shadow-[0_10px_28px_rgb(71_19_14/7%)]',
        compact ? 'mx-auto mt-8 max-w-[880px] p-3' : 'mt-9 p-3 md:p-4',
      )}
    >
      {status === 'error' ? (
        <div>
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 flex-none place-items-center rounded-full bg-[rgb(162_28_28/10%)] text-(--pt-red)"
            >
              <InfoIcon className="size-5" />
            </span>
            <div>
              <h3 className="m-0 border-0 p-0 font-[family-name:var(--font-exo2)] text-lg font-black">
                A rádio não conectou
              </h3>
              <p className="m-0 mt-1 text-sm leading-5 text-(--campaign-muted)">
                Tente de novo ou ouça na página da rádio.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={start} className={RETRY_CONTROL}>
              Tentar novamente
            </button>
            <a
              href={RADIO_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={ZENO_LINK}
            >
              Ouvir no Zeno
            </a>
            <div className="ml-auto">
              <RadioShareControl variant="outline" />
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn(
              'flex items-center gap-3',
              compact ? undefined : 'md:grid md:grid-cols-[112px_1fr_auto] md:gap-5',
            )}
          >
            <div className="relative grid size-[76px] flex-none place-items-center overflow-hidden rounded-[10px] md:size-28">
              <span
                aria-hidden="true"
                className="absolute inset-[13%] rounded-full border border-[rgb(0_0_0/8%)] bg-white shadow-[0_7px_18px_rgb(71_19_14/10%)]"
              />
              <Image
                src="/campaign-kit/radio/radio-jorge-solla-1313-logo.png"
                alt="Logo da Rádio Jorge Solla 1313"
                width={112}
                height={112}
                className="relative z-[1] aspect-square w-[74%] rounded-full object-cover"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-2 text-[10px] font-black tracking-[0.08em] text-(--pt-red) uppercase md:rounded-full md:bg-[rgb(162_28_28/8%)] md:px-3 md:py-1 md:text-[11px]">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-(--pt-red) shadow-[0_0_0_4px_rgb(162_28_28/11%)]"
                  />
                  Ao vivo
                </span>
                <span className="hidden text-xs text-(--campaign-muted) md:inline">
                  Rádio online
                </span>
              </div>
              <h3 className="m-0 mt-1 border-0 p-0 font-[family-name:var(--font-exo2)] text-lg leading-tight font-black tracking-[-0.025em] md:mt-3 md:text-[28px] md:leading-none">
                {RADIO_TITLE}
              </h3>
              {status === 'connecting' ? (
                <p
                  role="status"
                  className="m-0 mt-1 flex items-center gap-2 text-xs font-bold md:mt-2 md:text-sm"
                >
                  <span
                    aria-hidden="true"
                    className="size-5 animate-spin rounded-full border-2 border-[rgb(162_28_28/18%)] border-t-(--pt-red) [animation-duration:0.8s] motion-reduce:animate-none"
                  />
                  Conectando à rádio…
                </p>
              ) : status === 'playing' ? (
                <p className="m-0 mt-1 flex items-center gap-2 text-xs font-bold text-(--pt-red) md:mt-2 md:text-sm">
                  <span aria-hidden="true" className="size-2 rounded-full bg-(--pt-red)" />
                  Em reprodução
                </p>
              ) : (
                <p className="m-0 mt-1 text-xs text-(--campaign-muted) md:mt-2 md:text-sm">
                  Pronta para tocar
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 md:pr-2">
              {compact ? null : (
                <span className="hidden md:inline-flex">
                  <RadioShareControl variant="outline" />
                </span>
              )}
              <button
                type="button"
                className={cn(PLAY_CONTROL, status === 'connecting' && 'opacity-60')}
                aria-label={
                  status === 'connecting'
                    ? 'Conectando'
                    : status === 'playing'
                      ? `Pausar ${RADIO_TITLE}`
                      : `Ouvir ${RADIO_TITLE}`
                }
                aria-pressed={status === 'playing'}
                aria-busy={status === 'connecting'}
                onClick={toggle}
              >
                {status === 'playing' ? <PauseIcon /> : <PlayIcon />}
              </button>
            </div>
          </div>

          <div
            className={cn(
              'mt-3 flex justify-end border-t border-(--campaign-line) pt-2',
              compact ? undefined : 'md:hidden',
            )}
          >
            <RadioShareControl variant="link" />
          </div>
        </>
      )}

      {/* A live stream never ends: `ended` is intentionally ignored (a stub
          short media file must not flip the player back to idle). */}
      <audio
        ref={audioRef}
        src={RADIO_STREAM_URL}
        preload="none"
        onPlaying={() => {
          if (statusRef.current === 'connecting' || statusRef.current === 'playing') {
            setStatus('playing')
          }
        }}
        onError={() => {
          if (statusRef.current === 'connecting' || statusRef.current === 'playing') {
            stopPlayback('error')
          }
        }}
      />
    </article>
  )
}
