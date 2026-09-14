import { ExternalLinkIcon, PlayIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { SpeechHighlightParts } from '@/components/campaign/speech/SpeechHighlightParts'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import type { SpeechHighlightedExcerpt } from '@/lib/speechHighlight'
import type { SpeechListItemViewModel } from '@/utilities/speech/speechViewModels'

/**
 * The LLM classifies many topics per speech; the card shows the leading few so
 * the excerpt keeps the scan path (the detail lists all of them).
 */
const MAX_TOPIC_CHIPS = 3
const MAX_SCOPE_CHIPS = 2
const MAX_KEYWORD_CHIPS = 3

const MetaSeparator = () => <span aria-hidden="true">·</span>

const SpeechExcerpt = ({ excerpt }: { excerpt: SpeechHighlightedExcerpt }) => {
  if (excerpt.parts.length === 0) return null

  return (
    <p className="text-sm leading-relaxed text-foreground/90">
      {excerpt.truncatedStart ? '… ' : null}
      <SpeechHighlightParts parts={excerpt.parts} />
      {excerpt.truncatedEnd ? ' …' : null}
    </p>
  )
}

const ActionLink = ({
  href,
  children,
  variant,
}: {
  href: string
  children: ReactNode
  variant: 'default' | 'outline' | 'ghost'
}) => (
  <Button asChild variant={variant} className="min-h-11">
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  </Button>
)

export const SpeechResultCard = ({ speech }: { speech: SpeechListItemViewModel }) => {
  const visibleTopics = speech.topics.slice(0, MAX_TOPIC_CHIPS)
  const visibleScopes = speech.scopes.slice(0, MAX_SCOPE_CHIPS)
  const visibleKeywords = speech.keywords.slice(0, MAX_KEYWORD_CHIPS)
  const hiddenChips =
    speech.topics.length -
    visibleTopics.length +
    (speech.scopes.length - visibleScopes.length) +
    (speech.keywords.length - visibleKeywords.length)

  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{speech.speechAtLabel}</span>
        {speech.type ? (
          <>
            <MetaSeparator />
            <span>{speech.type}</span>
          </>
        ) : null}
        {speech.durationLabel ? (
          <>
            <MetaSeparator />
            <span>{speech.durationLabel}</span>
          </>
        ) : null}
        {speech.presidingOfficer ? (
          <>
            <MetaSeparator />
            <span>Presidiu: {speech.presidingOfficer}</span>
          </>
        ) : null}
      </div>

      <div className="mt-2">
        <SpeechExcerpt excerpt={speech.excerpt} />
      </div>

      {speech.topics.length || speech.scopes.length || speech.keywords.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
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
          {visibleKeywords.map((keyword) => (
            <Badge key={keyword} variant="outline" className="font-normal text-muted-foreground">
              {keyword}
            </Badge>
          ))}
          {hiddenChips > 0 ? (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              +{hiddenChips}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button asChild className="min-h-11">
          <Link href={speech.watchHref}>
            <PlayIcon data-icon="inline-start" aria-hidden="true" />
            {speech.matchKind === 'segment' ? 'Assistir no trecho' : 'Ver fala'}
          </Link>
        </Button>
        {speech.sourceUrl ? (
          <ActionLink href={speech.sourceUrl} variant="ghost">
            <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
            Abrir fonte
          </ActionLink>
        ) : null}
      </div>
    </article>
  )
}
