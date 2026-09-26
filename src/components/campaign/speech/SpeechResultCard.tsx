import { ExternalLinkIcon, PlayIcon } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { SpeechExcerpt } from '@/components/campaign/speech/SpeechExcerpt'
import { SpeechNestedCuts } from '@/components/campaign/speech/SpeechNestedCuts'
import {
  SpeechResultChips,
  type SpeechChipGroup,
} from '@/components/campaign/speech/SpeechResultChips'
import { SpeechResultThumbnail } from '@/components/campaign/speech/SpeechResultThumbnail'
import {
  SpeechLiteralMatchBadge,
  SpeechSemanticBadges,
  SpeechSemanticProvenance,
} from '@/components/campaign/speech/SpeechSemanticEvidence'
import { Button } from '@/components/ui/button'
import type { SpeechListItemViewModel } from '@/utilities/speech/speechViewModels'

/**
 * The LLM classifies many topics per speech; the card shows the leading few so
 * the excerpt keeps the scan path (the detail lists all of them).
 */
const MAX_TOPIC_CHIPS = 3
const MAX_SCOPE_CHIPS = 2
const MAX_KEYWORD_CHIPS = 3

const MetaSeparator = () => <span aria-hidden="true">·</span>

const ActionLink = ({
  href,
  children,
  variant,
  fullWidthOnMobile = false,
}: {
  href: string
  children: ReactNode
  variant: 'default' | 'outline' | 'ghost'
  fullWidthOnMobile?: boolean
}) => (
  <Button
    asChild
    variant={variant}
    className={fullWidthOnMobile ? 'min-h-11 w-full md:w-auto' : 'min-h-11'}
  >
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  </Button>
)

const SpeechMetaLine = ({
  speech,
  originLabel = false,
}: {
  speech: SpeechListItemViewModel
  originLabel?: boolean
}) => {
  const items: string[] = []
  if (originLabel) items.push('Fala de origem')
  items.push(speech.speechAtLabel)
  if (speech.type) items.push(speech.type)
  if (speech.durationLabel) items.push(speech.durationLabel)
  if (speech.presidingOfficer) items.push(`Presidiu: ${speech.presidingOfficer}`)

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      {items.map((item, index) => (
        <span key={item} className="inline-flex items-center gap-x-2 whitespace-nowrap">
          {index > 0 ? <MetaSeparator /> : null}
          <span>{item}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * The primary CTA of every result card: a link to the speech (or its trecho)
 * whose variant/width the caller owns (C229 adds the theme appearance).
 */
const SpeechWatchButton = ({
  speech,
  watchLabel,
  variant,
  className,
}: {
  speech: SpeechListItemViewModel
  watchLabel: string
  variant: 'default' | 'outline'
  className: string
}) => (
  <Button asChild variant={variant} className={className}>
    <Link href={speech.watchHref}>
      <PlayIcon data-icon="inline-start" aria-hidden="true" />
      {watchLabel}
    </Link>
  </Button>
)

const SpeechActions = ({
  speech,
  className,
  fullWidthOnMobile = false,
}: {
  speech: SpeechListItemViewModel
  className: string
  fullWidthOnMobile?: boolean
}) => (
  <div className={className}>
    <SpeechWatchButton
      speech={speech}
      watchLabel={speech.matchKind === 'segment' ? 'Assistir no trecho' : 'Ver fala'}
      variant="default"
      className={fullWidthOnMobile ? 'min-h-11 w-full md:w-auto' : 'min-h-11'}
    />
    {speech.officialTextUrl ? (
      <ActionLink
        href={speech.officialTextUrl}
        variant="ghost"
        fullWidthOnMobile={fullWidthOnMobile}
      >
        <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
        Abrir Diário Oficial
      </ActionLink>
    ) : null}
  </div>
)

export const SpeechResultCard = ({
  speech,
  query,
}: {
  speech: SpeechListItemViewModel
  /** C174 — the search term, highlighted on the nested cuts. */
  query?: string
}) => {
  // C174 (option B): a speech that surfaced only because a cut matched the term
  // shows the origin note instead of an excerpt the speech does not contain, and
  // the actions sit at the top right (approved scene 05). C229 — a semantic
  // result outranks this branch: the evidence lives in the speech itself.
  if (!speech.matchedTextSearch && !speech.semanticMatch) {
    return (
      <article className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
          <div className="min-w-0">
            {speech.literalFallback ? (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <SpeechLiteralMatchBadge />
              </div>
            ) : null}
            <SpeechMetaLine speech={speech} originLabel />
            <p className="mt-2 text-sm text-muted-foreground">
              A fala não contém o termo exato; ela aparece porque um corte vinculado corresponde à
              busca.
            </p>
          </div>
          <SpeechActions
            speech={speech}
            className="flex flex-col items-stretch gap-2 md:shrink-0 md:flex-row md:items-center"
            fullWidthOnMobile
          />
        </div>

        {speech.cuts.length ? (
          <SpeechNestedCuts
            cuts={speech.cuts}
            caption="Correspondência no corte"
            query={query}
            showDescription
          />
        ) : null}
      </article>
    )
  }

  const chipGroups: SpeechChipGroup[] = [
    { key: 'topics', items: speech.topics, max: MAX_TOPIC_CHIPS },
    { key: 'scopes', items: speech.scopes, max: MAX_SCOPE_CHIPS },
    {
      key: 'keywords',
      items: speech.keywords.map((keyword) => ({ value: keyword, label: keyword })),
      max: MAX_KEYWORD_CHIPS,
      variant: 'outline',
      className: 'font-normal text-muted-foreground',
    },
  ]
  const isTheme = speech.semanticMatch
  // C229 — a semantic card only offers the trecho seek when the speech really
  // contains the literal query (a stopword-only segment hit must not claim it).
  const watchLabel =
    speech.matchKind === 'segment' && speech.matchedTextSearch ? 'Assistir no trecho' : 'Ver fala'
  // C229 — the semantic card replaces the common excerpt with the evidence
  // block; the two never coexist (design gate).
  const bodyNode = isTheme ? (
    <SpeechSemanticProvenance excerpt={speech.excerpt} />
  ) : (
    <SpeechExcerpt
      excerpt={speech.excerpt}
      className="text-sm leading-relaxed text-foreground/90"
    />
  )
  const chips = <SpeechResultChips groups={chipGroups} />
  const hasChips = Boolean(speech.topics.length || speech.scopes.length || speech.keywords.length)

  return (
    <article className="rounded-xl border bg-card p-4">
      {isTheme ? (
        <div className="flex flex-col items-start gap-2">
          <SpeechSemanticBadges matchedTextSearch={speech.matchedTextSearch} />
          <SpeechMetaLine speech={speech} />
        </div>
      ) : (
        <div className="flex flex-col items-start gap-2">
          {speech.literalFallback ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <SpeechLiteralMatchBadge />
            </div>
          ) : null}
          <SpeechMetaLine speech={speech} />
        </div>
      )}

      <div className={isTheme ? 'mt-3' : 'mt-2'}>
        {speech.thumbnailUrl ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-4">
            <SpeechResultThumbnail
              href={speech.watchHref}
              src={speech.thumbnailUrl}
              label={watchLabel}
              fullWidthOnMobile={isTheme}
            />
            <div className="min-w-0 flex-1">{bodyNode}</div>
          </div>
        ) : (
          bodyNode
        )}
      </div>

      {isTheme ? (
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {hasChips ? <div className="flex flex-wrap gap-1.5">{chips}</div> : <span />}
          <div className="flex flex-col items-stretch gap-2 md:flex-none md:flex-row md:items-center md:justify-end">
            <SpeechWatchButton
              speech={speech}
              watchLabel={watchLabel}
              variant="outline"
              className="min-h-11 w-full max-md:border-primary max-md:bg-primary max-md:text-primary-foreground md:min-h-10 md:w-auto"
            />
            {speech.officialTextUrl ? (
              <ActionLink href={speech.officialTextUrl} variant="ghost" fullWidthOnMobile>
                <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
                Abrir Diário Oficial
              </ActionLink>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {hasChips ? <div className="mt-3 flex flex-wrap gap-1.5">{chips}</div> : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SpeechWatchButton
              speech={speech}
              watchLabel={watchLabel}
              variant="default"
              className="min-h-11"
            />
            {speech.officialTextUrl ? (
              <ActionLink href={speech.officialTextUrl} variant="ghost">
                <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
                Abrir Diário Oficial
              </ActionLink>
            ) : null}
          </div>
        </>
      )}

      {speech.cuts.length ? <SpeechNestedCuts cuts={speech.cuts} query={query} /> : null}
    </article>
  )
}
