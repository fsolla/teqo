import { CampaignContentCard, type CampaignContentCardData } from '@/components/CampaignContentCard'
import { PUBLIC_FOCUS, PUBLIC_PATHS, PUBLIC_SOCIAL_LINKS } from '@/lib/publicSite'
import { cn } from '@/lib/utils'
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

const CONTENT_SECTION_LIMIT = 4

const sectionHeaderLinkClassName =
  'rounded-sm text-sm font-bold text-(--pt-red) underline decoration-(--pt-red) underline-offset-[5px] hover:text-(--pt-red-dark)'

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
    ...(post.thumbnailUrl
      ? { coverUrl: post.thumbnailUrl, coverAlt: post.caption ?? 'Publicação no Instagram' }
      : {}),
    external: true,
  },
  date: dateTimeOf(post.timestamp),
})

const youtubeHref = PUBLIC_SOCIAL_LINKS.youtube.href
const instagramHref = PUBLIC_SOCIAL_LINKS.instagram.href

const BoardLinks = () => (
  <>
    <Link href={PUBLIC_PATHS.artigos} className={cn(sectionHeaderLinkClassName, PUBLIC_FOCUS)}>
      Todos os artigos
    </Link>
    <a
      href={youtubeHref}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(sectionHeaderLinkClassName, PUBLIC_FOCUS)}
    >
      YouTube
    </a>
    <a
      href={instagramHref}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(sectionHeaderLinkClassName, PUBLIC_FOCUS)}
    >
      Instagram
    </a>
  </>
)

/**
 * S47 — the editorial home board (design scene 01/02): the 4 most recent items
 * across the visible posts (S1), the eligible YouTube feed (S2) and the
 * eligible Instagram feed (S3), newest first, as 1 featured story + 3 compact
 * rows. The previous mobile carousel is gone — the side column simply stacks.
 * With nothing visible the section renders the approved empty state instead of
 * leaving a silent hole (`isPostVisible` fail-closed — hidden electoral tags
 * never leak), and a feed outage degrades to the articles-only board.
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

  const [featured, ...rest] = cards

  return (
    <section
      aria-labelledby="contents-title"
      data-home-section="contents"
      className="bg-(--campaign-cream)"
    >
      <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 lg:px-16 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="m-0 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-red)">
              Acompanhe de perto
            </p>
            <h2
              id="contents-title"
              className="mt-2 max-w-2xl border-0 p-0 font-[family-name:var(--font-exo2)] text-[34px] leading-[1.03] font-black tracking-[-0.04em] text-balance lg:text-[44px] lg:leading-[1.02] lg:tracking-[-0.045em]"
            >
              O mandato, onde a Bahia acontece
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-6 text-(--campaign-muted) lg:text-base lg:leading-7">
              Notícias, vídeos e registros do trabalho em Brasília e nos municípios.
            </p>
          </div>
          <div className="mb-1 hidden flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-(--pt-red) lg:flex">
            <BoardLinks />
          </div>
        </div>

        {featured ? (
          <div className="mt-8 grid border-y border-(--campaign-line) lg:mt-10 lg:grid-cols-12">
            <article className="border-b border-(--campaign-line) py-7 lg:col-span-7 lg:border-r lg:border-b-0 lg:pr-8">
              <CampaignContentCard card={featured} variant="featured" />
            </article>
            <div className="divide-y divide-(--campaign-line) lg:col-span-5 lg:pl-8">
              {rest.map((card) => (
                <article key={card.id}>
                  <CampaignContentCard card={card} variant="compact" />
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-8 flex min-h-[290px] flex-col items-center justify-center border-y border-(--campaign-line) px-8 text-center lg:mt-10">
            <svg
              aria-hidden="true"
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--pt-red)"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
            </svg>
            <h3 className="mt-5 font-[family-name:var(--font-exo2)] text-2xl font-extrabold">
              Ainda não há publicações
            </h3>
            <p className="mt-3 max-w-sm text-sm leading-6 text-(--campaign-muted)">
              As notícias do mandato aparecerão aqui assim que forem publicadas.
            </p>
          </div>
        )}

        {featured ? (
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-(--pt-red) lg:hidden">
            <BoardLinks />
          </div>
        ) : null}
      </div>
    </section>
  )
}
