'use client'

import { FilmIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { SpeechHighlightParts } from '@/components/campaign/speech/SpeechHighlightParts'
import { cn } from '@/lib/utils'
import type { SpeechDetailSegmentViewModel } from '@/utilities/speech/speechViewModels'

/**
 * C154 — native `<video>` plus the clickable ASR transcript. The VOD is the
 * Câmara excerpt MP4 and the segment `startSeconds` are relative to it, so a
 * click is a plain `currentTime` seek. No autoplay (browsers block it): the
 * user presses play and the video starts at the requested fragment.
 */
export const SpeechDetailPlayer = ({
  vodPlaybackUrl,
  segments,
  initialSeconds,
}: {
  vodPlaybackUrl: string | null
  segments: readonly SpeechDetailSegmentViewModel[]
  initialSeconds: number | null
}) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [activeStart, setActiveStart] = useState<number | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || initialSeconds === null || initialSeconds <= 0) return

    const seek = () => {
      video.currentTime = initialSeconds
    }
    if (video.readyState >= 1) {
      seek()
      return
    }
    video.addEventListener('loadedmetadata', seek, { once: true })
    return () => video.removeEventListener('loadedmetadata', seek)
  }, [initialSeconds, vodPlaybackUrl])

  const seekTo = (seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = seconds
    void video.play().catch(() => {})
  }

  const onTimeUpdate = () => {
    const video = videoRef.current
    if (!video) return
    const current = video.currentTime
    const active = segments.find(
      (segment) => current >= segment.startSeconds && current < segment.endSeconds,
    )
    setActiveStart(active?.startSeconds ?? null)
  }

  return (
    <div data-slot="speech-player">
      {vodPlaybackUrl ? (
        <video
          ref={videoRef}
          controls
          preload="metadata"
          src={vodPlaybackUrl}
          onTimeUpdate={onTimeUpdate}
          className="aspect-video w-full rounded-lg border bg-black"
        >
          <track kind="captions" />
        </video>
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 text-muted-foreground">
          <FilmIcon className="size-8" aria-hidden="true" />
          <p className="text-sm">VOD indisponível para esta fala.</p>
        </div>
      )}

      {segments.length > 0 ? (
        <section className="mt-5" aria-label="Transcrição">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Transcrição (clique para posicionar)
          </p>
          <ol className="mt-2 space-y-0.5">
            {segments.map((segment) => {
              const active = activeStart === segment.startSeconds
              return (
                <li key={segment.startSeconds}>
                  <button
                    type="button"
                    data-start-seconds={segment.startSeconds}
                    onClick={() => seekTo(segment.startSeconds)}
                    className={cn(
                      'flex w-full gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active && 'bg-muted',
                    )}
                  >
                    <span
                      className={cn(
                        'w-12 shrink-0 pt-0.5 text-xs tabular-nums',
                        active ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {segment.startLabel}
                    </span>
                    <span className="text-sm leading-relaxed text-foreground/90">
                      <SpeechHighlightParts parts={segment.parts} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
