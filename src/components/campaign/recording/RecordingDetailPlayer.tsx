'use client'

import { CircleAlertIcon, DownloadIcon, InfoIcon, PlayIcon, UploadIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { RecordingRetryButton } from '@/components/campaign/recording/RecordingRetryButton'
import { RecordingSpeakerTranscript } from '@/components/campaign/recording/RecordingSpeakerTranscript'
import { CampaignTranscriptSegmentButton } from '@/components/campaign/shared/CampaignTranscriptSegmentButton'
import { Button } from '@/components/ui/button'
import {
  canRetryRecording,
  RECORDING_SPEAKER_INFO_BANNER,
  RECORDING_SPEAKER_INFO_BANNER_MOBILE,
  type RecordingStatus,
} from '@/lib/recording'
import { cn } from '@/lib/utils'
import type {
  RecordingDetailSegmentViewModel,
  RecordingSpeakerGroupViewModel,
} from '@/utilities/recordings/recordingViewModels'

type RecordingDetailPlayerProps = {
  recordingId: number
  status: RecordingStatus
  fileHref: string
  downloadHref: string
  failureMessage: string | null
  segments: readonly RecordingDetailSegmentViewModel[]
  /** C200 — groups when the whole transcript is keyed; empty otherwise. */
  speakerGroups: readonly RecordingSpeakerGroupViewModel[]
  /** C200 — true when a reprocessing dropped some identification. */
  speakerLabelsDropped: boolean
  /** `?t=` of the search hit; null when the detail was opened without a term. */
  initialSeconds: number | null
}

/**
 * C199 — the recording detail media surface: the private player, the download
 * and the clickable transcript (left/right columns of the approved design). In
 * `processing`/`failed` the file already exists (the upload finished), so
 * player and download stay available and only the transcript is replaced by the
 * honest state panel.
 */
export const RecordingDetailPlayer = ({
  recordingId,
  status,
  fileHref,
  downloadHref,
  failureMessage,
  segments,
  speakerGroups,
  speakerLabelsDropped,
  initialSeconds,
}: RecordingDetailPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  // The first segment starts highlighted: the design's transcript shows the
  // read position without waiting for the first `timeupdate`.
  const [activeStart, setActiveStart] = useState<number | null>(
    initialSeconds ?? segments[0]?.startSeconds ?? null,
  )
  // Accepting the retry swaps the failure panel for the processing one before
  // the server round trip lands (approved scene 9).
  const [retrying, setRetrying] = useState(false)
  const hasFile = status !== 'uploading'
  const showTranscript = status === 'ready' && segments.length > 0
  const grouped = speakerGroups.length > 0

  const seekTo = (seconds: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = seconds
    setActiveStart(seconds)
    void video.play().catch(() => undefined)
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

  const mediaColumn = (
    <div className="min-w-0">
      {hasFile ? (
        <video
          ref={videoRef}
          controls
          preload="metadata"
          src={fileHref}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={() => {
            const video = videoRef.current
            if (video && initialSeconds !== null && initialSeconds > 0) {
              video.currentTime = initialSeconds
              setActiveStart(initialSeconds)
            }
          }}
          className="aspect-video w-full rounded-lg border border-black/30 bg-black"
        >
          <track kind="captions" />
        </video>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="flex aspect-video w-full flex-col items-center justify-center rounded-lg border border-dashed border-input bg-stone-50 px-6 text-center"
        >
          <UploadIcon className="size-7 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">O arquivo ainda está sendo enviado</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Player e download aparecem quando o envio terminar.
          </p>
        </div>
      )}

      {status === 'processing' || retrying ? (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <div className="flex items-center gap-2 font-semibold">
            <span
              className="size-4 animate-spin rounded-full border-2 border-amber-300 border-t-amber-800 motion-reduce:animate-none"
              aria-hidden="true"
            />
            {retrying ? 'Reprocessando a transcrição' : 'Transcrição em processamento'}
          </div>
          <p className="mt-1">
            {retrying
              ? 'O arquivo foi preservado. Você pode assistir enquanto a nova transcrição é preparada.'
              : 'O vídeo já pode ser assistido. A transcrição ainda não está disponível.'}
          </p>
        </div>
      ) : null}

      {canRetryRecording(status) && !retrying ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-red-50/60 p-3 text-xs leading-5 text-red-800">
          <div className="flex items-center gap-2 font-semibold">
            <CircleAlertIcon className="size-4" aria-hidden="true" />A transcrição não foi concluída
          </div>
          <p className="mt-1">{failureMessage ?? 'Não foi possível processar o áudio.'}</p>
          <p className="mt-1">O arquivo foi preservado.</p>
        </div>
      ) : null}

      {hasFile ? (
        <div className="mt-3 flex flex-wrap items-start gap-2 max-md:flex-col max-md:items-stretch">
          {canRetryRecording(status) ? (
            <RecordingRetryButton
              recordingId={recordingId}
              className="max-md:w-full"
              onSubmittingChange={setRetrying}
            />
          ) : null}
          <Button
            asChild
            variant={status === 'ready' ? 'default' : 'outline'}
            className="min-h-11 max-md:w-full"
          >
            <a href={downloadHref}>
              <DownloadIcon data-icon="inline-start" aria-hidden="true" />
              {status === 'ready' ? 'Baixar' : 'Baixar arquivo'}
            </a>
          </Button>
        </div>
      ) : null}

      {status === 'uploading' ? (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <PlayIcon className="size-4" aria-hidden="true" />A transcrição começa quando o envio
          terminar.
        </p>
      ) : null}

      {grouped ? (
        <div className="mt-4 flex gap-2 rounded-lg border border-border bg-muted/50 p-3">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs leading-5 text-muted-foreground">
            <span className="md:hidden">{RECORDING_SPEAKER_INFO_BANNER_MOBILE}</span>
            <span className="max-md:hidden">{RECORDING_SPEAKER_INFO_BANNER}</span>
          </p>
        </div>
      ) : null}

      {status === 'ready' && segments.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          A transcrição desta gravação está vazia — o arquivo continua disponível para download.
        </p>
      ) : null}
    </div>
  )

  if (!showTranscript) {
    // Non-ready states keep the media column bounded on desktop so the state
    // panel and the recovery action stay in the first fold (approved scene 8).
    return (
      <div data-slot="recording-player">
        <div className="lg:max-w-3xl">{mediaColumn}</div>
      </div>
    )
  }

  return (
    <div
      data-slot="recording-player"
      className={cn(
        'grid gap-6',
        grouped
          ? 'lg:grid-cols-[minmax(0,1.05fr)_minmax(430px,.95fr)]'
          : 'lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]',
      )}
    >
      {mediaColumn}

      {grouped ? (
        <RecordingSpeakerTranscript
          recordingId={recordingId}
          groups={speakerGroups}
          labelsDropped={speakerLabelsDropped}
          activeStart={activeStart}
          onSeek={seekTo}
        />
      ) : (
        <section aria-label="Transcrição" className="min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Transcrição
            </p>
            <span className="text-[11px] text-muted-foreground">Clique para posicionar</span>
          </div>
          <ol className="mt-2 max-h-[28rem] space-y-0.5 overflow-y-auto">
            {segments.map((segment) => (
              <li key={`${segment.startSeconds}-${segment.startLabel}`}>
                <CampaignTranscriptSegmentButton
                  segment={segment}
                  active={activeStart === segment.startSeconds}
                  onSeek={seekTo}
                />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}
