import { CampaignContentCard, type CampaignContentCardData } from '@/components/CampaignContentCard'
import { CampaignContentCarousel } from '@/components/CampaignContentCarousel'
import type { Post } from '@/payload-types'
import {
  formatRelativePostDate,
  getCategoryName,
  getPostCanonicalPath,
  getVisiblePosts,
} from '@/utilities/posts'
import type { InstagramPost } from '@/utilities/socialFeed/instagramFeed'
import { getInstagramFeed } from '@/utilities/socialFeed/instagramFeedView'
import {
  formatYouTubeViews,
  getYouTubeFeed,
  type YouTubeVideo,
} from '@/utilities/socialFeed/youtubeFeed'
import Link from 'next/link'

const CONTENT_SECTION_LIMIT = 5

const sectionHeaderLinkClassName =
  'text-sm font-bold text-(--pt-red) underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none'

type DatedCard = {
  card: CampaignContentCardData
  date: number
}

/** 0 sentinel: a missing date sinks the item to the bottom of the recency merge. */
const dateTimeOf = (value?: string | null): number => {
  const time = new Date(value ?? '').getTime()
  return Number.isNaN(time) ? 0 : time
}

const byRecencyDesc = (a: DatedCard, b: DatedCard): number => b.date - a.date

const toArticleCardData = (post: Post): DatedCard | null => {
  const href = getPostCanonicalPath(post)
  if (!href) return null

  const cover =
    typeof post.coverImage === 'object' && post.coverImage !== null ? post.coverImage : null
  const categoryName = getCategoryName(post)

  return {
    card: {
      id: post.id,
      href,
      title: post.title,
      shareKind: 'article' as const,
      meta: [formatRelativePostDate(post.publishedDate), categoryName].filter(Boolean).join(' · '),
      ...(cover?.url ? { coverUrl: cover.url, coverAlt: cover.alt ?? undefined } : {}),
      ...(post.subtitle ? { subtitle: post.subtitle } : {}),
    },
    date: dateTimeOf(post.publishedDate),
  }
}

const toVideoCardData = (video: YouTubeVideo): DatedCard => ({
  card: {
    id: `yt:${video.id}`,
    href: `https://www.youtube.com/watch?v=${video.id}`,
    title: video.title,
    shareKind: 'video' as const,
    meta: [
      formatRelativePostDate(video.publishedAt),
      video.viewCount != null ? `${formatYouTubeViews(video.viewCount)} visualizações` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    ...(video.thumbnailUrl ? { coverUrl: video.thumbnailUrl, coverAlt: video.title } : {}),
    external: true,
  },
  date: dateTimeOf(video.publishedAt),
})

const toInstagramCardData = (post: InstagramPost): DatedCard => ({
  card: {
    id: `ig:${post.id}`,
    href: post.permalink,
    title: post.caption ?? 'Publicação no Instagram',
    shareKind: 'instagram' as const,
    meta: formatRelativePostDate(post.timestamp) ?? '',
    coverAspect: 'square',
    ...(post.thumbnailUrl
      ? { coverUrl: post.thumbnailUrl, coverAlt: post.caption ?? 'Publicação no Instagram' }
      : {}),
    external: true,
  },
  date: dateTimeOf(post.timestamp),
})

/**
 * Campaign home content board: the 5 most recent items across the visible
 * posts (S1), the eligible YouTube feed (S2) and the eligible Instagram feed
 * (S3), newest first, as a 1+4 bento on desktop and a one-per-screen carousel
 * on mobile. Hides entirely when nothing is visible (`isPostVisible`
 * fail-closed — hidden electoral tags never leak) and never breaks when a
 * feed API is down (snapshot or no cards). With the feeds unconfigured it
 * degrades to the S1 articles-only behavior.
 */
export const CampaignContentSection = async () => {
  const [visiblePosts, youtubeFeed, instagramFeed] = await Promise.all([
    getVisiblePosts(),
    getYouTubeFeed(),
    getInstagramFeed(),
  ])
  const articleCards = visiblePosts
    .map(toArticleCardData)
    .filter((entry): entry is DatedCard => entry !== null)
  const videoCards = (youtubeFeed?.videos ?? []).map(toVideoCardData)
  const instagramCards = (instagramFeed?.posts ?? []).map(toInstagramCardData)

  const cards = [...articleCards, ...videoCards, ...instagramCards]
    .sort(byRecencyDesc)
    .slice(0, CONTENT_SECTION_LIMIT)
    .map(({ card }) => card)

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
          <div className="flex flex-wrap gap-4">
            <Link href="/artigos" className={sectionHeaderLinkClassName}>
              Ver artigos →
            </Link>
            {instagramFeed?.username ? (
              <a
                href={`https://www.instagram.com/${instagramFeed.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className={sectionHeaderLinkClassName}
              >
                Seguir no Instagram →
              </a>
            ) : null}
            {youtubeFeed ? (
              <a
                href={`https://www.youtube.com/channel/${youtubeFeed.channelId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={sectionHeaderLinkClassName}
              >
                YouTube →
              </a>
            ) : null}
          </div>
        </div>

        <div className="mt-6 hidden grid-cols-4 gap-4 md:grid">
          <div className="col-span-2 row-span-2">
            <CampaignContentCard card={featured} featured />
          </div>
          {rest.map((card) => (
            <CampaignContentCard key={card.id} card={card} />
          ))}
        </div>

        <div className="mt-5 md:hidden">
          <CampaignContentCarousel ariaLabel="Conteúdos recentes" items={cards} />
        </div>
      </div>
    </section>
  )
}
