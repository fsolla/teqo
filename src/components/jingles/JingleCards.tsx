'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'

import { splitJingleTitle, type JingleViewModel } from '@/lib/jingle'
import { JINGLE_PLAY_EVENT, RADIO_PLAY_EVENT } from '@/lib/radio'
import { formatSpeechClock } from '@/lib/speechClock'
import { cn } from '@/lib/utils'

import { JINGLE_FOCUS_RING } from './focusRing'

/**
 * S21 — the jingles card grid (artefato: cenas 01/02). One client component
 * owns the exclusivity state: every card renders its own `<audio
 * preload="none">` (no request before the play, per the gate note) and starting
 * one pauses the others. The play control reverts on a failed `play()` so
 * `aria-pressed` never gets stuck; progress/time come from the media events.
 * S22 reuses this core in the home sound section, so the
 * `article[data-jingle]`/`data-state`/download contract stays single-owned and
 * the heading level follows the host page outline.
 */

const PLAY_CONTROL = cn(
  'inline-flex h-14 w-14 flex-none items-center justify-center rounded-full bg-(--pt-yellow) text-(--pt-yellow-ink)',
  'shadow-[0_6px_0_#cfb900,0_10px_22px_rgb(0_0_0/15%)] transition-[transform,box-shadow,filter] duration-150 ease-out',
  'hover:-translate-y-0.5 hover:brightness-[0.98] hover:shadow-[0_8px_0_#cfb900,0_12px_24px_rgb(0_0_0/18%)]',
  'active:translate-y-[3px] active:shadow-[0_3px_0_#cfb900]',
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
  JINGLE_FOCUS_RING,
)

const DOWNLOAD_CONTROL = cn(
  'mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[rgb(162_28_28/32%)] bg-transparent',
  'font-[family-name:var(--font-exo2)] font-extrabold text-(--pt-red) no-underline',
  'transition-[background-color,border-color,transform] duration-150 ease-out hover:border-(--pt-red) hover:bg-[rgb(162_28_28/7%)] active:scale-[0.99]',
  'motion-reduce:transition-none',
  JINGLE_FOCUS_RING,
)

const PlayIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-[25px] w-[25px] fill-current stroke-current"
  >
    <path d="m8 5 11 7-11 7z" />
  </svg>
)

const PauseIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-[25px] w-[25px] fill-current stroke-current"
  >
    <path d="M8 5h3v14H8zM14 5h3v14h-3z" />
  </svg>
)

const DownloadIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-[18px] w-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
)

type Playback = {
  currentSeconds: number
  durationSeconds: number | null
}

const EMPTY_PLAYBACK: Playback = { currentSeconds: 0, durationSeconds: null }

const EMPTY_TIME = '—:—'

export const JingleCards = ({
  jingles,
  headingLevel = 'h2',
}: {
  jingles: readonly JingleViewModel[]
  headingLevel?: 'h2' | 'h3' | 'h4'
}) => {
  const Heading = headingLevel
  const [activeId, setActiveId] = useState<JingleViewModel['id'] | null>(null)
  const [playback, setPlayback] = useState<Record<number, Playback>>({})
  const audioRefs = useRef(new Map<number, HTMLAudioElement>())
  // S25 — the radio:play listener reads the live active id without
  // re-subscribing on every card change.
  const activeIdRef = useRef<JingleViewModel['id'] | null>(null)
  // One stable ref callback per id: an inline arrow would be detached and
  // reattached on every render (each `timeupdate` re-renders the list).
  const audioRefCallbacks = useRef(new Map<number, (node: HTMLAudioElement | null) => void>())

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  // S25 — one audio at a time with the home radio: a `radio:play` pauses only
  // this component's active card. Inert on `/jingles` (no radio broadcasts
  // there), so the exclusivity never leaks into the page's own behaviour.
  const stopActiveCard = useCallback(() => {
    const current = activeIdRef.current
    if (current === null) return
    audioRefs.current.get(current)?.pause()
    setActiveId(null)
  }, [])

  useEffect(() => {
    window.addEventListener(RADIO_PLAY_EVENT, stopActiveCard)
    return () => window.removeEventListener(RADIO_PLAY_EVENT, stopActiveCard)
  }, [stopActiveCard])

  const audioRef = (id: number) => {
    const cached = audioRefCallbacks.current.get(id)
    if (cached) return cached

    const callback = (node: HTMLAudioElement | null) => {
      if (node) {
        audioRefs.current.set(id, node)
        return
      }

      audioRefs.current.delete(id)
    }
    audioRefCallbacks.current.set(id, callback)
    return callback
  }

  const updatePlayback = (id: number, patch: Partial<Playback>) => {
    setPlayback((current) => ({
      ...current,
      [id]: { ...(current[id] ?? EMPTY_PLAYBACK), ...patch },
    }))
  }

  const toggle = (id: number) => {
    const audio = audioRefs.current.get(id)
    if (!audio) return

    if (activeId === id) {
      stopActiveCard()
      return
    }

    for (const [otherId, other] of audioRefs.current) {
      if (otherId !== id) other.pause()
    }

    setActiveId(id)
    window.dispatchEvent(new CustomEvent(JINGLE_PLAY_EVENT))
    // A pending play() of another card rejects when we pause it; the catch
    // must only clear the state of THIS card, never the one now playing.
    void audio.play().catch(() => setActiveId((current) => (current === id ? null : current)))
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-5 sm:gap-6 md:grid-cols-3">
      {jingles.map((jingle) => {
        const playing = activeId === jingle.id
        const { base, credit } = splitJingleTitle(jingle.title)
        const state = playback[jingle.id] ?? EMPTY_PLAYBACK
        const percent =
          state.durationSeconds && state.durationSeconds > 0
            ? Math.min(100, (state.currentSeconds / state.durationSeconds) * 100)
            : 0

        return (
          <article
            key={jingle.id}
            data-jingle
            data-state={playing ? 'playing' : 'stopped'}
            className={cn(
              'overflow-hidden rounded-[14px] border bg-white shadow-[0_12px_34px_rgb(71_19_14/8%)]',
              playing
                ? 'border-[rgb(162_28_28/36%)] shadow-[0_14px_38px_rgb(162_28_28/14%)]'
                : 'border-(--campaign-line)',
            )}
          >
            <div className="relative aspect-square overflow-hidden bg-(--campaign-band)">
              <Image
                src={jingle.coverUrl}
                alt={jingle.coverAlt}
                fill
                sizes="(min-width: 768px) 33vw, 100vw"
                className="object-cover"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-[58%] bottom-0 bg-[linear-gradient(to_bottom,transparent,rgb(24_10_9/42%))]"
              />
            </div>

            <div className="p-4 md:p-5">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  data-play
                  className={PLAY_CONTROL}
                  aria-label={`${playing ? 'Pausar' : 'Tocar'} jingle ${jingle.title}`}
                  aria-pressed={playing}
                  onClick={() => toggle(jingle.id)}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <div className="min-w-0 flex-1">
                  <Heading className="m-0 border-b-0 pb-0 text-left font-[family-name:var(--font-exo2)] text-2xl leading-[1.02] font-black tracking-[-0.02em] wrap-anywhere">
                    {base}
                  </Heading>
                  {credit ? (
                    <p className="mt-1.5 text-[13px] leading-[1.25] font-bold text-(--campaign-muted)">
                      {credit}
                    </p>
                  ) : null}
                  {playing ? (
                    <p className="mt-2 flex items-center gap-2 text-sm font-bold text-(--pt-red)">
                      <span className="h-2 w-2 rounded-full bg-(--pt-red)" />
                      Em reprodução
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-(--campaign-muted)">Pronto para tocar</p>
                  )}
                </div>
              </div>

              <div
                className="mt-5"
                role="progressbar"
                aria-label={`Progresso do jingle ${jingle.title}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
              >
                <div className="h-1.5 overflow-hidden rounded-full bg-[#dedbd8]">
                  <div
                    className="h-full rounded-[inherit] bg-(--pt-red)"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10px] font-bold tracking-wide text-black/50 uppercase md:text-[11px]">
                  <span>
                    Tempo{' '}
                    {state.currentSeconds > 0
                      ? formatSpeechClock(state.currentSeconds)
                      : EMPTY_TIME}
                  </span>
                  <span>
                    Duração{' '}
                    {state.durationSeconds ? formatSpeechClock(state.durationSeconds) : EMPTY_TIME}
                  </span>
                </div>
              </div>

              <a
                href={jingle.audioUrl}
                download={jingle.downloadFilename}
                className={DOWNLOAD_CONTROL}
                aria-label={`Baixar ${jingle.title} em MP3`}
              >
                <DownloadIcon />
                Baixar MP3
              </a>
              <p className="mt-3 truncate text-center text-[11px] text-black/45">
                {jingle.downloadFilename}
              </p>
            </div>

            <audio
              ref={audioRef(jingle.id)}
              src={jingle.audioUrl}
              preload="none"
              onTimeUpdate={(event) =>
                updatePlayback(jingle.id, { currentSeconds: event.currentTarget.currentTime })
              }
              onLoadedMetadata={(event) =>
                updatePlayback(jingle.id, { durationSeconds: event.currentTarget.duration })
              }
              onEnded={() => {
                updatePlayback(jingle.id, { currentSeconds: 0 })
                setActiveId((current) => (current === jingle.id ? null : current))
              }}
            />
          </article>
        )
      })}
    </div>
  )
}
