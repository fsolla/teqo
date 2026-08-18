import { CampaignArticleCard, type CampaignArticleCardData } from '@/components/CampaignArticleCard'
import { CampaignContentCarousel } from '@/components/CampaignContentCarousel'
import type { Post } from '@/payload-types'
import {
  formatRelativePostDate,
  getCategoryName,
  getPostCanonicalPath,
  getVisiblePosts,
  POST_TYPE_BADGE_LABELS,
} from '@/utilities/posts'
import Link from 'next/link'

const CONTENT_SECTION_LIMIT = 5

const toCardData = (post: Post): CampaignArticleCardData | null => {
  const href = getPostCanonicalPath(post)
  if (!href) return null

  const cover =
    typeof post.coverImage === 'object' && post.coverImage !== null ? post.coverImage : null
  const categoryName = getCategoryName(post)
  const date = formatRelativePostDate(post.publishedDate)

  return {
    id: post.id,
    href,
    title: post.title,
    badgeLabel: POST_TYPE_BADGE_LABELS[post.type],
    meta: [date, categoryName].filter(Boolean).join(' · '),
    ...(cover?.url ? { coverUrl: cover.url, coverAlt: cover.alt ?? undefined } : {}),
    ...(post.subtitle ? { subtitle: post.subtitle } : {}),
  }
}

/**
 * Campaign home content board (S1 — articles): the 5 most recent visible posts
 * as a 1+4 bento on desktop and a one-per-screen carousel on mobile. Hides
 * entirely when nothing is visible (`isPostVisible` fail-closed — hidden
 * electoral tags never leak).
 */
export const CampaignContentSection = async () => {
  const cards = (await getVisiblePosts())
    .map(toCardData)
    .filter((card): card is CampaignArticleCardData => card !== null)
    .slice(0, CONTENT_SECTION_LIMIT)

  if (!cards.length) return null

  const [featured, ...rest] = cards

  return (
    <section
      aria-labelledby="contents-title"
      data-home-section="contents"
      className="border-y border-(--campaign-line) bg-(--campaign-band)"
    >
      <div className="mx-auto w-full max-w-[1160px] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="campaign-section-eyebrow m-0 font-black tracking-[0.1em] text-(--pt-red) uppercase">
              Acompanhe de perto
            </p>
            <h2
              id="contents-title"
              className="campaign-section-title m-0 mt-1 border-0 p-0 font-black tracking-[-0.02em] text-balance"
            >
              A caminhada, em tempo real
            </h2>
            <p className="campaign-section-copy m-0 mt-1 text-(--campaign-muted)">
              Bastidores, caravanas e as lutas do mandato: conteúdo atualizado, direto das redes.
            </p>
          </div>
          <Link
            href="/artigos"
            className="text-sm font-bold text-(--pt-red) underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
          >
            Ver artigos →
          </Link>
        </div>

        <div className="mt-6 hidden grid-cols-4 gap-4 md:grid">
          <div className="col-span-2 row-span-2">
            <CampaignArticleCard card={featured} featured />
          </div>
          {rest.map((card) => (
            <CampaignArticleCard key={card.id} card={card} />
          ))}
        </div>

        <div className="mt-5 md:hidden">
          <CampaignContentCarousel ariaLabel="Artigos recentes" items={cards} />
        </div>
      </div>
    </section>
  )
}
