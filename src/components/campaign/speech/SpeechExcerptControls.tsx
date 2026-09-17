'use client'

import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { useRef } from 'react'

import { formatSpeechClock, formatSpeechSpan } from '@/lib/speechClock'
import {
  MIN_EXCERPT_SECONDS,
  moveRangeEdge,
  rangeDurationSeconds,
  secondsFromTrackRatio,
  snapSecondsToSegmentBoundary,
  type ExcerptEdge,
  type ExcerptPreviewPhase,
  type ExcerptRange,
  type ExcerptSegment,
} from '@/lib/speechExcerptSelection'
import { cn } from '@/lib/utils'

/** Handles snap to a nearby phrase boundary within this screen distance... */
const SNAP_TOLERANCE_PX = 8
/** ...never more than this in seconds, so a wide/short track cannot over-magnetize. */
const SNAP_TOLERANCE_MAX_SECONDS = 2

const HANDLE_KEY_DELTAS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  PageDown: -5,
  PageUp: 5,
}

const excerptLimitsLabel = `Mínimo ${MIN_EXCERPT_SECONDS}s · sem limite — até o fim da fala`

type SpeechExcerptControlsProps = {
  segments: readonly ExcerptSegment[]
  range: ExcerptRange
  durationSeconds: number
  onChange: (range: ExcerptRange) => void
  /**
   * C173 — the player owns the preview (playback, timers, surface); the card
   * only hosts the control it renders, so no media logic leaks into the pure
   * geometry component.
   */
  previewArea?: ReactNode
  /** C173 — presentation state of the preview: card ring while playing, header chip. */
  previewState?: ExcerptPreviewPhase
}

/**
 * C166 — the excerpt range bar: two keyboard-operable handles (`role="slider"`)
 * over the speech duration, with a magnet on the transcript phrase boundaries.
 * It only translates pointers/keys into the pure geometry (`lib/speechExcerptSelection`);
 * the phrase clicks themselves stay on the transcript. C173 — the preview control
 * arrives as a pre-rendered `previewArea` slot: the card frames it, the player owns it.
 */
export const SpeechExcerptControls = ({
  segments,
  range,
  durationSeconds,
  onChange,
  previewArea,
  previewState = 'idle',
}: SpeechExcerptControlsProps) => {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragEdgeRef = useRef<ExcerptEdge | null>(null)

  const durationLabel = formatSpeechClock(durationSeconds)
  const startLabel = formatSpeechClock(range.startSeconds)
  const endLabel = formatSpeechClock(range.endSeconds)
  const spanLabel = formatSpeechSpan(rangeDurationSeconds(range))

  const percentOf = (seconds: number): number =>
    durationSeconds > 0 ? Math.min(100, Math.max(0, (seconds / durationSeconds) * 100)) : 0

  const secondsFromPointer = (clientX: number): number => {
    const track = trackRef.current
    if (!track) return range.startSeconds
    const rect = track.getBoundingClientRect()
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0
    const raw = secondsFromTrackRatio(ratio, durationSeconds)
    const tolerance =
      rect.width > 0
        ? Math.min(SNAP_TOLERANCE_MAX_SECONDS, (SNAP_TOLERANCE_PX / rect.width) * durationSeconds)
        : 0
    return snapSecondsToSegmentBoundary(raw, segments, tolerance)
  }

  const onHandlePointerDown = (edge: ExcerptEdge) => (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.focus()
    dragEdgeRef.current = edge
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onHandlePointerMove = (edge: ExcerptEdge) => (event: PointerEvent<HTMLDivElement>) => {
    if (dragEdgeRef.current !== edge) return
    onChange(moveRangeEdge(range, edge, secondsFromPointer(event.clientX), durationSeconds))
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    dragEdgeRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onHandleKeyDown = (edge: ExcerptEdge) => (event: KeyboardEvent<HTMLDivElement>) => {
    const current = edge === 'start' ? range.startSeconds : range.endSeconds
    const delta =
      event.key === 'Home'
        ? -durationSeconds
        : event.key === 'End'
          ? durationSeconds
          : (HANDLE_KEY_DELTAS[event.key] ?? 0)
    if (delta === 0) return
    event.preventDefault()
    onChange(moveRangeEdge(range, edge, current + delta, durationSeconds))
  }

  const handleProps = (edge: ExcerptEdge, seconds: number) => ({
    role: 'slider' as const,
    tabIndex: 0,
    'aria-label': edge === 'start' ? 'Início do trecho' : 'Fim do trecho',
    'aria-valuemin': edge === 'start' ? 0 : range.startSeconds + MIN_EXCERPT_SECONDS,
    'aria-valuemax': edge === 'start' ? range.endSeconds - MIN_EXCERPT_SECONDS : durationSeconds,
    'aria-valuenow': seconds,
    'aria-valuetext': formatSpeechClock(seconds),
    'data-excerpt-edge': edge,
    onPointerDown: onHandlePointerDown(edge),
    onPointerMove: onHandlePointerMove(edge),
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown: onHandleKeyDown(edge),
  })

  const previewChip =
    previewState === 'playing' ? (
      <span className="inline-flex h-5 items-center gap-1 rounded-full bg-primary/10 px-2 text-[10px] font-medium text-primary">
        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
        REPRODUZINDO
      </span>
    ) : previewState === 'ended' ? (
      <span className="text-[10px] font-medium text-muted-foreground">
        FIM VISÍVEL · {endLabel}
      </span>
    ) : null

  const rangeLabel = (
    <>
      <span className="text-foreground">{startLabel}</span> →{' '}
      <span className="text-foreground">{endLabel}</span> · {spanLabel}
    </>
  )

  return (
    <div
      className={cn(
        'mt-3 rounded-lg border bg-muted/30 p-3',
        previewState === 'playing' && 'ring-1 ring-primary/30',
      )}
      data-slot="speech-excerpt-controls"
    >
      {/* C173 — while a preview state is on, it owns the header's right slot and
          the range drops to its own line (gallery PARADO/REPRODUZINDO/FIM VISÍVEL). */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-primary">Trecho selecionado</span>
        {previewChip ?? (
          <span className="text-xs text-muted-foreground tabular-nums">{rangeLabel}</span>
        )}
      </div>
      {previewChip ? (
        <p className="mt-1 text-xs text-muted-foreground tabular-nums">{rangeLabel}</p>
      ) : null}

      <div
        ref={trackRef}
        data-slot="speech-excerpt-track"
        className="relative mt-4 h-9 touch-none select-none"
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{
            left: `${percentOf(range.startSeconds)}%`,
            right: `${100 - percentOf(range.endSeconds)}%`,
          }}
        />
        <div
          {...handleProps('start', range.startSeconds)}
          className="absolute top-1/2 h-7 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm border border-primary bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:h-8 pointer-coarse:w-5"
          style={{ left: `${percentOf(range.startSeconds)}%` }}
        />
        <div
          {...handleProps('end', range.endSeconds)}
          className="absolute top-1/2 h-7 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-sm border border-primary bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-coarse:h-8 pointer-coarse:w-5"
          style={{ left: `${percentOf(range.endSeconds)}%` }}
        />
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>00:00</span>
        <span>{startLabel}</span>
        <span>{endLabel}</span>
        <span>{durationLabel}</span>
      </div>

      <div
        className={cn(
          'mt-3 flex flex-wrap items-end justify-between gap-3 pt-3',
          previewState === 'idle' ? 'sm:border-t sm:border-border' : 'border-t border-border',
        )}
      >
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
          Clique nas frases: o limite encaixa no segmento (ímã). Arraste as alças para o ajuste
          fino. {excerptLimitsLabel} — a duração aparece enquanto seleciona.
        </p>
        {previewArea}
      </div>
    </div>
  )
}
