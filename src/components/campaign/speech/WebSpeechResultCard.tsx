import { PlayIcon, VideoIcon } from 'lucide-react'
import Link from 'next/link'

import { SpeechHighlightParts } from '@/components/campaign/speech/SpeechHighlightParts'
import { SpeechResultThumbnail } from '@/components/campaign/speech/SpeechResultThumbnail'
import { WebSpeechPlatformPill } from '@/components/campaign/speech/WebSpeechPlatformPill'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import type { WebSpeechListItemViewModel } from '@/utilities/speech/speechViewModels'

/** Same scan path as the Câmara card: the leading few chips, the rest summed. */
const MAX_TOPIC_CHIPS = 3
const MAX_SCOPE_CHIPS = 2

/**
 * C216 — one web speech in the "Falas na internet" list (design scenes 01/03/05):
 * the cover (or the honest neutral placeholder), the platform pill on the cover
 * and beside the date, the matching excerpt with the search highlight and the
 * single "Ver fala" action.
 */
export const WebSpeechResultCard = ({ speech }: { speech: WebSpeechListItemViewModel }) => {
  const { excerpt, thumbnailUrl, watchHref } = speech
  const metaLine = [speech.dateLabel, speech.durationLabel].filter(Boolean).join(' · ')
  const visibleTopics = speech.topics.slice(0, MAX_TOPIC_CHIPS)
  const visibleScopes = speech.scopes.slice(0, MAX_SCOPE_CHIPS)
  const hiddenChips =
    speech.topics.length - visibleTopics.length + (speech.scopes.length - visibleScopes.length)
  const hasChips = Boolean(speech.topics.length || speech.scopes.length)

  return (
    <article className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[152px_minmax(0,1fr)_auto]">
      <div className="relative">
        {thumbnailUrl ? (
          <SpeechResultThumbnail
            href={watchHref}
            src={thumbnailUrl}
            label={`Ver fala: ${speech.title}`}
            className="aspect-video w-full md:w-[152px]"
          />
        ) : (
          <Link
            href={watchHref}
            aria-hidden="true"
            tabIndex={-1}
            className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-lg bg-stone-200 text-stone-500 md:w-[152px]"
          >
            <VideoIcon className="size-7" aria-hidden="true" />
            <span className="absolute bottom-2 text-[10px] font-semibold">SEM CAPA</span>
          </Link>
        )}
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/65 px-2 py-1 text-[11px] text-white">
          {speech.platform.label}
        </span>
        {thumbnailUrl ? (
          <span className="pointer-events-none absolute inset-0 grid place-items-center">
            <PlayIcon className="size-6 text-white drop-shadow" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <WebSpeechPlatformPill platform={speech.platform.value} label={speech.platform.label} />
          <span className="text-xs text-muted-foreground">{metaLine}</span>
        </div>
        <h3 className="mt-2 text-sm font-semibold">{speech.title}</h3>

        {excerpt.parts.length > 0 ? (
          <p className="mt-2 text-sm leading-6 text-foreground/90">
            {excerpt.truncatedStart ? '… ' : null}
            <SpeechHighlightParts parts={excerpt.parts} />
            {excerpt.truncatedEnd ? ' …' : null}
          </p>
        ) : null}

        {hasChips ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleTopics.map((topic) => (
              <Badge key={topic.value} variant="secondary" className="font-normal">
                {topic.label}
              </Badge>
            ))}
            {visibleScopes.map((scope) => (
              <Badge key={scope.value} variant="secondary" className="font-normal">
                {scope.label}
              </Badge>
            ))}
            {hiddenChips > 0 ? (
              <Badge variant="outline" className="font-normal text-muted-foreground">
                +{hiddenChips}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <Button
        asChild
        variant={thumbnailUrl ? 'default' : 'outline'}
        className="min-h-11 self-end max-md:w-full"
      >
        <Link href={watchHref}>Ver fala</Link>
      </Button>
    </article>
  )
}
