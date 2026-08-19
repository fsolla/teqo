import { ContentShareButton } from '@/components/ContentShareButton'
import type { ContentShareKind } from '@/lib/contentShare'
import Image from 'next/image'
import Link from 'next/link'

export type CampaignContentCardData = {
  id: string | number
  href: string
  title: string
  badgeLabel: string
  meta: string
  /** Source of the content — drives the WhatsApp share message template. */
  shareKind: ContentShareKind
  coverUrl?: string
  coverAlt?: string
  subtitle?: string
  /** Cover ratio: 16:9 for articles/videos, 1:1 for Instagram posts. */
  coverAspect?: 'video' | 'square'
  /** External target (e.g. a YouTube video): opens in a new tab with noopener. */
  external?: boolean
}

type CampaignContentCardProps = {
  card: CampaignContentCardData
  featured?: boolean
}

const cardClassName = (featured: boolean) =>
  `flex h-full flex-col rounded-xl border border-(--campaign-line) bg-white p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--pt-red) ${
    featured ? 'gap-3' : 'gap-2'
  }`

/**
 * Presentational content card for the campaign home content bento/carousel —
 * one spelling for every source (article, YouTube, Instagram in S3). Internal
 * targets use `Link`; external ones open on the platform in a new tab with
 * `noopener` (no inline player, per the approved wireframe). The card body is
 * one anchor; the S4 share control lives as an absolutely positioned sibling
 * (a button inside the anchor would be invalid interactive nesting), on a
 * wrapper that also owns the hover `group` so the cover zoom keeps working.
 */
export const CampaignContentCard = ({ card, featured = false }: CampaignContentCardProps) => {
  const inner = (
    <>
      <div
        className={`relative w-full shrink-0 overflow-hidden rounded-lg bg-(--campaign-band) ${
          card.coverAspect === 'square' ? 'aspect-square' : 'aspect-video'
        }`}
      >
        {card.coverUrl ? (
          <Image
            src={card.coverUrl}
            alt={card.coverAlt ?? card.title}
            fill
            sizes={featured ? '(min-width: 768px) 44vw, 92vw' : '(min-width: 768px) 22vw, 92vw'}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
        <span className="absolute top-2 left-2 rounded-full bg-(--pt-red-dark) px-2 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
          {card.badgeLabel}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <h3
          className={`leading-snug font-bold text-(--campaign-ink) group-hover:underline ${
            featured ? 'text-base' : 'text-sm'
          }`}
        >
          {card.title}
        </h3>
        {featured && card.subtitle ? (
          <p className="text-xs leading-relaxed text-(--campaign-muted)">{card.subtitle}</p>
        ) : null}
        <span className="mt-auto text-xs text-(--campaign-muted)">{card.meta}</span>
      </div>
    </>
  )

  return (
    <div className="group relative h-full">
      {card.external ? (
        <a
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cardClassName(featured)}
        >
          {inner}
        </a>
      ) : (
        <Link href={card.href} className={cardClassName(featured)}>
          {inner}
        </Link>
      )}
      <ContentShareButton kind={card.shareKind} title={card.title} href={card.href} />
    </div>
  )
}
