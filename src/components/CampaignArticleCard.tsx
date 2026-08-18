import Image from 'next/image'
import Link from 'next/link'

export type CampaignArticleCardData = {
  id: string | number
  href: string
  title: string
  badgeLabel: string
  meta: string
  coverUrl?: string
  coverAlt?: string
  subtitle?: string
}

type CampaignArticleCardProps = {
  card: CampaignArticleCardData
  featured?: boolean
}

/** Presentational article card for the campaign home content bento/carousel. */
export const CampaignArticleCard = ({ card, featured = false }: CampaignArticleCardProps) => (
  <Link
    href={card.href}
    className={`group flex h-full flex-col rounded-xl border border-(--campaign-line) bg-white p-3 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--pt-red) ${
      featured ? 'gap-3' : 'gap-2'
    }`}
  >
    <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-(--campaign-band)">
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
  </Link>
)
