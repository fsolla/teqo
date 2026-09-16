'use client'

import { DownloadIcon, ExternalLinkIcon, FilmIcon, PlayIcon, ScissorsIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import type { SpeechVodResolveResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/resolver-vod/types'
import { SpeechCutDialog } from '@/components/campaign/speech/SpeechCutDialog'
import { SpeechCutResultCard } from '@/components/campaign/speech/SpeechCutResultCard'
import { SpeechExcerptControls } from '@/components/campaign/speech/SpeechExcerptControls'
import { SpeechExcerptShare } from '@/components/campaign/speech/SpeechExcerptShare'
import { SpeechHighlightParts } from '@/components/campaign/speech/SpeechHighlightParts'
import { YoutubeIcon } from '@/components/socialIcons'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import type { SpeechCutViewModel } from '@/lib/speechCut'
import {
  excerptSelectionDuration,
  extendRangeToSegment,
  initialExcerptRange,
  isExcerptSelectionAvailable,
  MIN_EXCERPT_SECONDS,
  SPEECH_EXCERPT_REQUEST_EVENT,
  type ExcerptRange,
} from '@/lib/speechExcerptSelection'
import { buildSpeechExcerptYoutubeUrl } from '@/lib/speechShare'
import type { SpeechVodResolution } from '@/lib/speechVod'
import { cn } from '@/lib/utils'
import type { SpeechDetailSegmentViewModel } from '@/utilities/speech/speechViewModels'

const RESOLVE_ENDPOINT = '/campanha/comunicacao/acervo/resolver-vod'
const GENERATING_TITLE = 'A Câmara está gerando o trecho deste vídeo.'

const buildYoutubeSrc = (videoId: string, startSeconds: number | null): string => {
  const params = new URLSearchParams({ playsinline: '1', rel: '0' })
  if (startSeconds !== null && startSeconds > 0) {
    params.set('start', String(Math.floor(startSeconds)))
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

type ResolutionState =
  | { kind: 'idle' }
  | { kind: 'resolving' }
  | { kind: 'generating' }
  | { kind: 'resolved'; playbackUrl: string | null; downloadUrl: string | null }
  | { kind: 'failed'; message: string | null }

const toResolutionState = (resolution: SpeechVodResolution): ResolutionState =>
  resolution.state === 'pronto'
    ? {
        kind: 'resolved',
        playbackUrl: resolution.playbackUrl,
        downloadUrl: resolution.downloadUrl,
      }
    : resolution.state === 'gerando'
      ? { kind: 'generating' }
      : { kind: 'failed', message: null }

type SpeechDetailPlayerProps = {
  speechId: number
  /** C162 — YouTube default when the session link parses; null falls back to the VOD. */
  youtubeVideoId: string | null
  /** Seconds from the session start to the excerpt; null makes the YouTube seek inert. */
  youtubeOffsetSeconds: number | null
  /** Stored VOD + excerpt coordinates: the Câmara may be asked on click. */
  vodResolvable: boolean
  segments: readonly SpeechDetailSegmentViewModel[]
  initialSeconds: number | null
  sourceUrl: string | null
  /** C166 — raw duration for the excerpt picker; null falls back to the last segment end. */
  durationSeconds: number | null
  /** C166 — speech type for the share message (`null` reads as "fala"). */
  speechType: string | null
  /** C166 — day label (`dd/mm/aaaa`) for the share message. */
  speechDateLabel: string
  /** C167 — official summary, the deterministic fallback for the cut metadata. */
  speechSummary: string | null
}

const StatusPanel = ({
  title,
  detail,
  busy = false,
  children,
}: {
  title: string
  detail: string
  busy?: boolean
  children?: ReactNode
}) => (
  <div
    role="status"
    aria-live="polite"
    className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border bg-muted/40 px-6 text-center text-muted-foreground"
  >
    {busy ? (
      <Spinner
        className="size-6 text-muted-foreground"
        aria-label="Resolvendo o trecho na Câmara"
      />
    ) : (
      <FilmIcon className="size-8" aria-hidden="true" />
    )}
    <p className="text-sm font-medium text-foreground/90">{title}</p>
    <p className="max-w-md text-xs">{detail}</p>
    {children}
  </div>
)

/**
 * C162 — one player for the four acervo quadrants: YouTube default when the
 * session link exists (no Câmara call on render), the stored VOD otherwise
 * resolved on click (`video-sob-demanda`, exact `excerptTMs`, links probed
 * before use), and honest states when neither path has a playable file.
 * Transcript clicks seek the current surface: native seconds on the MP4,
 * session-offset seconds on the YouTube embed.
 */
export const SpeechDetailPlayer = ({
  speechId,
  youtubeVideoId,
  youtubeOffsetSeconds,
  vodResolvable,
  segments,
  initialSeconds,
  sourceUrl,
  durationSeconds,
  speechType,
  speechDateLabel,
  speechSummary,
}: SpeechDetailPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  // C171-F1 — transcript point clicked while the embed is active: the target
  // has to survive until the Câmara `<video>` mounts and takes the first seek.
  const pendingSeekRef = useRef<number | null>(null)
  const [resolution, setResolution] = useState<ResolutionState>({ kind: 'idle' })
  const [activeStart, setActiveStart] = useState<number | null>(null)
  // C166: one state for the explicit selection mode — a non-null range means
  // the mode is on, so "selecting" cannot drift from "has a range".
  const [selection, setSelection] = useState<ExcerptRange | null>(null)
  // C167: the dialog opens from the current selection; the published cut is kept
  // in session so the share kit stays visible after the dialog closes.
  const [cutDialogOpen, setCutDialogOpen] = useState(false)
  const [publishedCut, setPublishedCut] = useState<SpeechCutViewModel | null>(null)
  const [youtubeStart, setYoutubeStart] = useState<number | null>(() =>
    youtubeVideoId && youtubeOffsetSeconds !== null
      ? youtubeOffsetSeconds + (initialSeconds ?? 0)
      : null,
  )
  // C171 — one player surface at a time: the YouTube embed until the assessor
  // asks for the Câmara excerpt, which then plays in place.
  const [surface, setSurface] = useState<'youtube' | 'vod'>(youtubeVideoId ? 'youtube' : 'vod')

  const resolving = resolution.kind === 'resolving'
  const playbackUrl = resolution.kind === 'resolved' ? resolution.playbackUrl : null
  const youtubeSurface = surface === 'youtube' && Boolean(youtubeVideoId)
  const youtubeWatchUrl = youtubeVideoId
    ? buildSpeechExcerptYoutubeUrl(
        youtubeVideoId,
        youtubeOffsetSeconds,
        activeStart ?? initialSeconds ?? 0,
      )
    : null
  const selectionDuration = excerptSelectionDuration(durationSeconds, segments)
  const selectionAvailable = isExcerptSelectionAvailable(durationSeconds, segments)
  const selecting = selection !== null
  const showExcerptShare = selecting && Boolean(youtubeVideoId)
  const showCutAction = selecting && vodResolvable

  // C171-F1 — the pending transcript point wins over the ?t deep link; the
  // surface switch is a dep so the already verified file seeks on mount.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const target = pendingSeekRef.current ?? initialSeconds
    if (target === null || target <= 0) return

    const seek = () => {
      video.currentTime = target
      pendingSeekRef.current = null
    }
    if (video.readyState >= 1) {
      seek()
      return
    }
    video.addEventListener('loadedmetadata', seek, { once: true })
    return () => video.removeEventListener('loadedmetadata', seek)
  }, [initialSeconds, playbackUrl, surface])

  const requestResolution = async (deliverDownload: boolean) => {
    // Opened synchronously inside the click gesture so the popup blocker sees
    // a user-initiated tab; pointed at the verified URL only after the probe.
    const pendingTab = deliverDownload ? window.open('', '_blank') : null
    setResolution({ kind: 'resolving' })

    try {
      const { ok, payload } = await postCampaignJson<SpeechVodResolveResponse>(RESOLVE_ENDPOINT, {
        speechId,
      })
      if (!ok || payload.status !== 'success') {
        pendingTab?.close()
        setResolution({
          kind: 'failed',
          message: payload.status === 'error' ? payload.message : null,
        })
        return
      }

      const next = toResolutionState(payload.resolution)
      setResolution(next)
      if (!deliverDownload) return

      if (next.kind === 'resolved' && next.downloadUrl) {
        if (pendingTab) pendingTab.location.href = next.downloadUrl
        else window.open(next.downloadUrl, '_blank')
        return
      }
      pendingTab?.close()
    } catch {
      pendingTab?.close()
      setResolution({ kind: 'failed', message: null })
    }
  }

  // C171 — "Assistir na Câmara": switches the player surface and asks the
  // Câmara only when there is nothing verified yet and no request in flight.
  const watchVod = () => {
    setSurface('vod')
    if (playbackUrl || resolving || resolution.kind === 'generating') return
    void requestResolution(false)
  }

  const seekTo = (seconds: number) => {
    if (youtubeSurface) {
      if (youtubeOffsetSeconds === null) return
      pendingSeekRef.current = seconds
      setYoutubeStart(youtubeOffsetSeconds + seconds)
      setActiveStart(seconds)
      return
    }
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

  /** Turns the picker on with the initial range — idempotent (keeps the current one). */
  const requestSelection = useCallback(() => {
    if (selectionDuration === null || selectionDuration < MIN_EXCERPT_SECONDS) return
    setSelection((current) => current ?? initialExcerptRange(segments, selectionDuration))
  }, [segments, selectionDuration])

  const toggleSelection = () => {
    if (selecting) {
      setSelection(null)
      return
    }
    requestSelection()
  }

  // C174 — the empty "Cortes desta fala" CTA lives outside the player. It only
  // announces the intent; the state stays here, so the request turns the picker
  // on (idempotent, unlike the toggle) and never overwrites an active range.
  useEffect(() => {
    window.addEventListener(SPEECH_EXCERPT_REQUEST_EVENT, requestSelection)
    return () => window.removeEventListener(SPEECH_EXCERPT_REQUEST_EVENT, requestSelection)
  }, [requestSelection])

  // C162 keeps the transcript click seeking; C166 turns it into a phrase magnet
  // while the explicit selection mode is on.
  const onSegmentActivate = (index: number) => {
    const segment = segments[index]
    if (!segment) return
    if (selection === null || selectionDuration === null) {
      seekTo(segment.startSeconds)
      return
    }
    setSelection(extendRangeToSegment(selection, segments, index, selectionDuration))
  }

  const seekable = youtubeSurface ? youtubeOffsetSeconds !== null : Boolean(playbackUrl)

  const renderMedia = (): ReactNode => {
    if (youtubeSurface && youtubeVideoId) {
      return (
        <iframe
          src={buildYoutubeSrc(youtubeVideoId, youtubeStart)}
          title="Vídeo da sessão no YouTube"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; compute-pressure"
          allowFullScreen
          className="aspect-video w-full rounded-lg border bg-black"
        />
      )
    }
    if (playbackUrl) {
      return (
        <video
          ref={videoRef}
          controls
          preload="metadata"
          src={playbackUrl}
          onTimeUpdate={onTimeUpdate}
          className="aspect-video w-full rounded-lg border bg-black"
        >
          <track kind="captions" />
        </video>
      )
    }
    if (resolution.kind === 'resolving') {
      return (
        <StatusPanel
          busy
          title="Resolvendo o trecho na Câmara…"
          detail="Isso pode levar alguns segundos. Se demorar, tente novamente em instantes — a página não trava."
        />
      )
    }
    if (resolution.kind === 'generating') {
      return (
        <StatusPanel
          title={GENERATING_TITLE}
          detail="A geração pode levar alguns instantes. Tente novamente em um momento."
        >
          <Button
            variant="outline"
            className="mt-1 min-h-10"
            onClick={() => void requestResolution(false)}
          >
            Tentar novamente
          </Button>
        </StatusPanel>
      )
    }
    if (resolution.kind === 'failed' || resolution.kind === 'resolved') {
      return (
        <StatusPanel
          title="Não foi possível carregar o vídeo deste trecho."
          detail={
            resolution.kind === 'failed' && resolution.message
              ? resolution.message
              : 'A Câmara não entregou o arquivo agora. A transcrição e a fonte oficial continuam disponíveis.'
          }
        >
          <Button
            variant="outline"
            className="mt-1 min-h-10"
            onClick={() => void requestResolution(false)}
          >
            Tentar novamente
          </Button>
        </StatusPanel>
      )
    }
    if (vodResolvable) {
      return (
        <StatusPanel
          title="O trecho deste vídeo é gerado pela Câmara dos Deputados."
          detail="Clique para resolver o arquivo exato desta fala — ele é verificado antes de tocar."
        >
          <Button className="mt-1 min-h-10" onClick={() => void requestResolution(false)}>
            <PlayIcon data-icon="inline-start" aria-hidden="true" />
            Assistir o trecho
          </Button>
        </StatusPanel>
      )
    }
    return (
      <StatusPanel
        title="Vídeo indisponível neste momento."
        detail="Esta fala não tem vídeo no YouTube nem trecho gerado pela Câmara disponível agora."
      />
    )
  }

  const inlineNotice = youtubeSurface ? (
    resolution.kind === 'generating' ? (
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {GENERATING_TITLE} Tente novamente em um momento.
      </p>
    ) : resolution.kind === 'failed' ? (
      <p className="text-xs text-destructive" role="status" aria-live="polite">
        {resolution.message ??
          'Não foi possível resolver o arquivo deste trecho na Câmara. Tente novamente.'}
      </p>
    ) : resolution.kind === 'resolved' && !resolution.downloadUrl ? (
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        O arquivo deste trecho não pôde ser verificado na Câmara agora.
      </p>
    ) : null
  ) : null

  // C171 — the exit block stays reachable with the embed playing: the app
  // never sees the iframe's internal error, so the way out cannot depend on
  // detecting the block.
  const renderYoutubeExit = (): ReactNode => {
    if (!youtubeWatchUrl) return null
    return (
      <div data-slot="speech-youtube-exit" className="mt-3 rounded-lg border bg-muted/40 px-4 py-3">
        <p className="text-xs font-medium text-foreground/90">
          Se o vídeo não abrir aqui, assista por outro caminho:
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {youtubeSurface && vodResolvable ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              data-slot="speech-youtube-exit-camera"
              onClick={watchVod}
            >
              <PlayIcon data-icon="inline-start" aria-hidden="true" />
              Assistir na Câmara
            </Button>
          ) : null}
          <Button asChild variant="outline" className="min-h-10">
            <a
              href={youtubeWatchUrl}
              target="_blank"
              rel="noreferrer"
              data-slot="speech-youtube-exit-link"
            >
              <YoutubeIcon />
              Abrir no YouTube
            </a>
          </Button>
        </div>
        {vodResolvable ? (
          <p className="mt-2 text-xs text-muted-foreground">
            O trecho da Câmara toca nesta página; o YouTube abre no ponto da fala.
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div data-slot="speech-player" aria-busy={resolving || undefined}>
      {renderMedia()}

      {renderYoutubeExit()}

      {selection && selectionDuration !== null ? (
        <SpeechExcerptControls
          segments={segments}
          range={selection}
          durationSeconds={selectionDuration}
          onChange={setSelection}
        />
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {selectionAvailable ? (
          <Button
            type="button"
            variant={selecting ? 'secondary' : 'outline'}
            className="min-h-10"
            aria-pressed={selecting}
            data-slot="speech-excerpt-toggle"
            onClick={toggleSelection}
          >
            <ScissorsIcon data-icon="inline-start" aria-hidden="true" />
            Selecionar trecho
          </Button>
        ) : null}
        {showCutAction && selection ? (
          <Button
            type="button"
            className="min-h-10"
            data-slot="speech-cut-open"
            onClick={() => setCutDialogOpen(true)}
          >
            <ScissorsIcon data-icon="inline-start" aria-hidden="true" />
            Cortar vídeo
          </Button>
        ) : null}
        {showExcerptShare && selection && youtubeVideoId ? (
          <SpeechExcerptShare
            videoId={youtubeVideoId}
            offsetSeconds={youtubeOffsetSeconds}
            startSeconds={selection.startSeconds}
            endSeconds={selection.endSeconds}
            speechType={speechType}
            dateLabel={speechDateLabel}
          />
        ) : null}
        {vodResolvable ? (
          <Button
            // While the excerpt share or the cut action is on screen it is the
            // primary action; the download steps back to outline instead of
            // splitting the CTA.
            variant={showExcerptShare || showCutAction ? 'outline' : 'default'}
            className="min-h-10"
            disabled={resolving}
            aria-busy={resolving || undefined}
            onClick={() => {
              if (resolution.kind === 'resolved' && resolution.downloadUrl) {
                window.open(resolution.downloadUrl, '_blank')
                return
              }
              void requestResolution(true)
            }}
          >
            {resolving ? (
              <Spinner data-icon="inline-start" aria-label="Resolvendo o trecho" />
            ) : (
              <DownloadIcon data-icon="inline-start" aria-hidden="true" />
            )}
            Baixar vídeo (MP4)
          </Button>
        ) : null}
        {sourceUrl ? (
          <Button asChild variant="outline" className="min-h-10">
            <a href={sourceUrl} target="_blank" rel="noreferrer">
              <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
              Abrir fonte
            </a>
          </Button>
        ) : null}
      </div>

      {inlineNotice}

      {publishedCut ? <SpeechCutResultCard cut={publishedCut} /> : null}

      {selection ? (
        <SpeechCutDialog
          open={cutDialogOpen}
          onOpenChange={setCutDialogOpen}
          speechId={speechId}
          speechType={speechType}
          dateLabel={speechDateLabel}
          summary={speechSummary}
          range={selection}
          onPublished={setPublishedCut}
        />
      ) : null}

      {!youtubeVideoId && selectionAvailable ? (
        <div className="mt-3 rounded-lg border bg-muted/40 px-4 py-3">
          <p className="text-xs font-medium text-foreground/90">
            Compartilhar por link exige o vídeo no YouTube
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Esta fala não tem vídeo no YouTube — não há link externo que abra no ponto. Você ainda
            pode baixar o MP4 ou abrir a fonte oficial, e a seleção de trecho continua disponível.
          </p>
        </div>
      ) : null}

      {segments.length > 0 ? (
        <section className="mt-5" aria-label="Transcrição">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            {selecting
              ? 'Transcrição (clique nas frases para marcar o trecho)'
              : seekable
                ? 'Transcrição (clique para posicionar)'
                : 'Transcrição'}
          </p>
          <ol className="mt-2 space-y-0.5">
            {segments.map((segment, index) => {
              const active = activeStart === segment.startSeconds
              const inSelection =
                selection !== null &&
                segment.endSeconds > selection.startSeconds &&
                segment.startSeconds < selection.endSeconds
              return (
                <li key={segment.startSeconds}>
                  <button
                    type="button"
                    data-start-seconds={segment.startSeconds}
                    data-in-selection={inSelection || undefined}
                    onClick={() => onSegmentActivate(index)}
                    disabled={!seekable && !selecting}
                    className={cn(
                      'flex w-full gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
                      seekable && !selecting && 'hover:bg-muted',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      !selecting && active && 'bg-muted',
                      inSelection && 'border-l-2 border-primary bg-primary/10',
                    )}
                  >
                    <span
                      className={cn(
                        'w-12 shrink-0 pt-0.5 text-xs tabular-nums',
                        inSelection || (!selecting && active)
                          ? 'text-primary'
                          : 'text-muted-foreground',
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
