import { ChevronRightIcon, UserIcon, VideoIcon } from 'lucide-react'
import Link from 'next/link'

import { RecordingStatusBadge } from '@/components/campaign/recording/RecordingStatusBadge'
import { SpeechHighlightParts } from '@/components/campaign/speech/SpeechHighlightParts'
import { Button } from '@/components/ui/button'
import type { RecordingStatus } from '@/lib/recording'
import type { RecordingListItemViewModel } from '@/utilities/recordings/recordingViewModels'

const STATE_COPY: Record<Exclude<RecordingStatus, 'uploading'>, string> = {
  processing: 'Transcrevendo a gravação. Ela ainda não aparece na busca.',
  failed: 'A transcrição não foi concluída. O arquivo foi preservado — reprocesse no detalhe.',
  ready: 'Transcrição pronta e pesquisável.',
}

const metaLine = (recording: RecordingListItemViewModel): string => {
  const parts = [recording.recordedAtLabel ?? 'Sem data']
  if (recording.durationLabel) parts.push(recording.durationLabel)
  return parts.join(' · ')
}

/**
 * C199 — one recording in the "Gravações enviadas" list: state chip, date,
 * duration, the matching excerpt when the search found one and the single
 * "Abrir" action (delete lives only in the detail — design decision).
 */
export const RecordingResultCard = ({ recording }: { recording: RecordingListItemViewModel }) => {
  const excerpt = recording.excerpt

  return (
    <article className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[112px_minmax(0,1fr)_auto]">
      <Link
        href={recording.watchHref}
        aria-hidden="true"
        tabIndex={-1}
        className="grid aspect-video place-items-center rounded-lg bg-stone-200 text-stone-500 md:w-28"
      >
        <VideoIcon className="size-7" aria-hidden="true" />
      </Link>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{recording.title}</h3>
          <RecordingStatusBadge status={recording.status} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{metaLine(recording)}</p>

        {recording.status === 'uploading' ? (
          <div className="mt-2">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Arquivo sendo enviado · ainda não pesquisável
            </p>
          </div>
        ) : excerpt ? (
          <p className="mt-2 text-sm leading-5 text-foreground/90">
            {excerpt.truncatedStart ? '… ' : null}
            <SpeechHighlightParts parts={excerpt.parts} />
            {excerpt.truncatedEnd ? ' …' : null}
          </p>
        ) : (
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            {STATE_COPY[recording.status]}
          </p>
        )}

        {recording.topics.length > 0 || recording.matchedPersons.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {recording.topics.map((topic) => (
              <span
                key={topic.value}
                className="inline-flex min-h-7 items-center rounded-md bg-muted px-2 py-1 text-xs font-semibold"
              >
                {topic.label}
              </span>
            ))}
            {recording.matchedPersons.map((person) => (
              <span
                key={person}
                className="inline-flex min-h-7 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-semibold"
              >
                <UserIcon className="size-3.5 shrink-0" aria-hidden="true" />
                {person}
              </span>
            ))}
            {recording.matchedPersons.length > 0 ? (
              <span className="text-muted-foreground">aparece nesta gravação</span>
            ) : null}
          </div>
        ) : null}
      </div>

      <Button
        asChild
        variant="outline"
        className="min-h-11 self-center max-md:w-full md:self-center"
      >
        <Link href={recording.watchHref}>
          Abrir
          <ChevronRightIcon data-icon="inline-end" aria-hidden="true" />
        </Link>
      </Button>
    </article>
  )
}
