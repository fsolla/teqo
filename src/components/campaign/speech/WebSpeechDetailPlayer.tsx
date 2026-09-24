'use client'

import { DownloadIcon, ExternalLinkIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { CampaignTranscriptSegmentButton } from '@/components/campaign/shared/CampaignTranscriptSegmentButton'
import { WebSpeechPlatformPill } from '@/components/campaign/speech/WebSpeechPlatformPill'
import { Button } from '@/components/ui/button'
import type { WebSpeechDetailViewModel } from '@/utilities/speech/speechViewModels'

type WebSpeechDetailPlayerProps = {
  speech: WebSpeechDetailViewModel
  /** `?t=` of the search hit; null when the detail was opened without a term. */
  initialSeconds: number | null
}

/**
 * C216 — the web speech detail (design scenes 02/05): the mirrored private
 * media (native video or audio control — the artifact's audio variant), the
 * download, "Abrir na origem", the origin attribution and the clickable
 * transcript that seeks the player. Playback itself is browser territory.
 */
export const WebSpeechDetailPlayer = ({ speech, initialSeconds }: WebSpeechDetailPlayerProps) => {
  const mediaRef = useRef<HTMLMediaElement | null>(null)
  const [activeStart, setActiveStart] = useState<number | null>(
    initialSeconds ?? speech.segments[0]?.startSeconds ?? null,
  )

  const seekTo = (seconds: number) => {
    const media = mediaRef.current
    if (!media) return
    media.currentTime = seconds
    setActiveStart(seconds)
    void media.play().catch(() => undefined)
  }

  const onTimeUpdate = () => {
    const media = mediaRef.current
    if (!media) return
    const current = media.currentTime
    const active = speech.segments.find(
      (segment) => current >= segment.startSeconds && current < segment.endSeconds,
    )
    setActiveStart(active?.startSeconds ?? null)
  }

  const onLoadedMetadata = () => {
    const media = mediaRef.current
    if (media && initialSeconds !== null && initialSeconds > 0) {
      media.currentTime = initialSeconds
      setActiveStart(initialSeconds)
    }
  }

  const setMediaRef = (element: HTMLVideoElement | HTMLAudioElement | null) => {
    mediaRef.current = element
  }

  const metaLine = [
    speech.durationLabel,
    ...speech.topics.map((topic) => topic.label),
    ...speech.scopes.map((scope) => scope.label),
  ]
    .filter(Boolean)
    .join(' · ')

  const badge = (
    <span className="absolute left-3 top-3 rounded border border-white/20 bg-black/60 px-2 py-1 text-[11px] text-white md:left-4 md:top-4 md:text-xs">
      Arquivo espelhado · privado
    </span>
  )

  // The mirrored file is the product: without it the page stays honest instead
  // of rendering a player that can only fail.
  const mediaBox = speech.fileHref ? (
    speech.mediaKind === 'audio' ? (
      <div className="relative grid h-40 place-items-center overflow-hidden rounded-xl bg-stone-950 px-3 text-white md:aspect-video md:h-auto md:px-6">
        <audio
          ref={setMediaRef}
          controls
          preload="metadata"
          aria-label="Reproduzir arquivo de áudio espelhado"
          src={speech.fileHref}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          className="w-full max-w-xl accent-primary"
        >
          Seu navegador não oferece reprodução de áudio.
        </audio>
        {badge}
      </div>
    ) : (
      <div className="relative">
        <video
          ref={setMediaRef}
          controls
          preload="metadata"
          src={speech.fileHref}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={onLoadedMetadata}
          className="aspect-video w-full rounded-xl border border-black/30 bg-black"
        >
          <track kind="captions" />
        </video>
        {badge}
      </div>
    )
  ) : (
    <div
      role="status"
      className="grid aspect-video w-full place-items-center rounded-xl border border-dashed border-input bg-stone-50 px-6 text-center"
    >
      <p className="text-sm text-muted-foreground">
        O arquivo espelhado desta fala não está disponível.
      </p>
    </div>
  )

  return (
    <div className="grid gap-7 lg:grid-cols-[1.2fr_.8fr]">
      <div className="min-w-0">
        {mediaBox}

        <div className="mt-3 flex flex-wrap gap-2 max-md:grid max-md:grid-cols-2">
          {speech.downloadHref ? (
            <Button asChild className="min-h-11">
              <a href={speech.downloadHref}>
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                Baixar
              </a>
            </Button>
          ) : null}
          {speech.sourceUrl ? (
            <Button asChild variant="outline" className="min-h-11">
              <a href={speech.sourceUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
                Abrir na origem
              </a>
            </Button>
          ) : null}
        </div>

        {/* Mobile shows the attribution inline under the title (scene 05). */}
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 max-md:hidden">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Origem
          </p>
          <p className="mt-1 text-sm font-medium">
            {[speech.platform.label, speech.channel].filter(Boolean).join(' · ')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Publicado em {speech.dateLabel}</p>
        </div>
      </div>

      <div className="min-w-0">
        <WebSpeechPlatformPill platform={speech.platform.value} label={speech.platform.label} />
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{speech.title}</h1>
        {metaLine ? (
          <p className="mt-2 text-sm text-muted-foreground max-md:hidden">{metaLine}</p>
        ) : null}
        <p className="mt-2 text-xs leading-5 text-muted-foreground md:hidden">
          {[speech.platform.label, speech.channel, speech.dateLabel].filter(Boolean).join(' · ')}
        </p>

        {speech.segments.length > 0 ? (
          <section aria-label="Transcrição" className="mt-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Transcrição
              </p>
              <span className="text-[11px] text-muted-foreground">Clique para posicionar</span>
            </div>
            <ol className="mt-2 max-h-[28rem] space-y-0.5 overflow-y-auto">
              {speech.segments.map((segment) => (
                <li key={`${segment.startSeconds}-${segment.startLabel}`}>
                  <CampaignTranscriptSegmentButton
                    segment={segment}
                    active={activeStart === segment.startSeconds}
                    variant="web"
                    onSeek={seekTo}
                  />
                </li>
              ))}
            </ol>
          </section>
        ) : (
          <p className="mt-6 text-xs text-muted-foreground">
            A transcrição desta fala está vazia — o arquivo continua disponível para download.
          </p>
        )}
      </div>
    </div>
  )
}
