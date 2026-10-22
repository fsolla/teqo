import { ContentShareButton } from '@/components/ContentShareButton'
import type { ContentShareKind } from '@/lib/contentShare'
import { PUBLIC_FOCUS } from '@/lib/publicSite'
import Image from 'next/image'
import Link from 'next/link'

export type CampaignContentCardData = {
  id: string | number
  href: string
  title: string
  meta: string
  /** Source of the content — drives the WhatsApp share message template. */
  shareKind: ContentShareKind
  coverUrl?: string
  coverAlt?: string
  subtitle?: string
  /** External target (e.g. a YouTube video): opens in a new tab with noopener. */
  external?: boolean
}

type CampaignContentCardProps = {
  card: CampaignContentCardData
  /** S47 — the editorial board is 1 featured + 3 compact text rows. */
  variant?: 'featured' | 'compact'
}

const ACTION_LABELS: Record<ContentShareKind, string> = {
  article: 'Ler notícia',
  video: 'Assistir no YouTube',
  instagram: 'Ver no Instagram',
  event: 'Ver',
}

const CARD_LINK = `block rounded-sm text-(--campaign-ink) no-underline ${PUBLIC_FOCUS}`

/**
 * S47 — one item of the editorial home board (design scene 01/02): the
 * `featured` variant carries the cover of the lead story; the `compact`
 * variant is the text-only row of the side column. Both keep the S4 share
 * control as a sibling of the anchor (never nested inside it) and derive the
 * action label from the content source.
 */
export const CampaignContentCard = ({ card, variant = 'compact' }: CampaignContentCardProps) => {
  const featured = variant === 'featured'
  const actionLabel = ACTION_LABELS[card.shareKind]

  const inner = featured ? (
    <>
      <div className="h-[220px] w-full overflow-hidden bg-[#d7d0cb] lg:h-[338px]">
        {card.coverUrl ? (
          <Image
            src={card.coverUrl}
            alt={card.coverAlt ?? card.title}
            width={720}
            height={405}
            sizes="(min-width: 1024px) 650px, 100vw"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.025] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : null}
      </div>
      <p className="mt-4 text-xs font-bold text-(--pt-red) lg:mt-5">{card.meta}</p>
      <h3 className="mt-2 max-w-[690px] font-[family-name:var(--font-exo2)] text-[25px] leading-[1.12] font-extrabold tracking-[-0.02em] text-balance lg:text-[31px] lg:leading-[1.1] lg:tracking-[-0.025em]">
        {card.title}
      </h3>
      {card.subtitle ? (
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-(--campaign-muted)">
          {card.subtitle}
        </p>
      ) : null}
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-(--pt-red)">
        {actionLabel} <span aria-hidden="true">→</span>
      </span>
    </>
  ) : (
    <>
      <p className="text-xs font-bold text-(--pt-red)">{card.meta}</p>
      <h3 className="mt-3 line-clamp-3 font-[family-name:var(--font-exo2)] text-xl leading-[1.18] font-extrabold tracking-[-0.02em] text-balance lg:text-[23px] lg:leading-[1.16]">
        {card.title}
      </h3>
      <p className="mt-4 text-sm font-bold text-(--pt-red)">
        {actionLabel} <span aria-hidden="true">→</span>
      </p>
    </>
  )

  return (
    <div className="group relative h-full">
      {card.external ? (
        <a
          href={card.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${CARD_LINK} ${featured ? '' : 'py-6 pr-12 lg:py-7'}`}
        >
          {inner}
        </a>
      ) : (
        <Link href={card.href} className={`${CARD_LINK} ${featured ? '' : 'py-6 pr-12 lg:py-7'}`}>
          {inner}
        </Link>
      )}
      <ContentShareButton kind={card.shareKind} title={card.title} href={card.href} />
    </div>
  )
}
