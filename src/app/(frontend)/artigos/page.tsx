import { CampaignInternalPageIntro } from '@/components/CampaignInternalPageIntro'
import { PostCard } from '@/components/PostCard'
import { getCachedGlobal } from '@/utilities/globalReads'
import { resolveOgImage } from '@/utilities/ogImageReads'
import { getTypePath, getVisiblePosts } from '@/utilities/posts'
import { absoluteSitePath, resolveSiteMetadata } from '@/utilities/seo'
import type { Metadata } from 'next'
import Link from 'next/link'

const LATEST_NEWS_LIMIT = 6

const ARTIGOS_DESCRIPTION = 'Notícias, artigos e a atuação do deputado Jorge Solla pela Bahia.'

export async function generateMetadata(): Promise<Metadata> {
  const [home, globalMetadata] = await Promise.all([
    getCachedGlobal('home', 2)(),
    getCachedGlobal('metadata')(),
  ])
  const { siteUrl, siteName, twitterCreator } = resolveSiteMetadata(globalMetadata)
  const canonicalUrl = absoluteSitePath(siteUrl, '/artigos')
  const { url: imageUrl, media } = await resolveOgImage(home.image)
  const images = imageUrl
    ? [
        {
          url: imageUrl,
          width: media?.width ?? undefined,
          height: media?.height ?? undefined,
          alt: media?.alt ?? 'Jorge Solla',
        },
      ]
    : []
  const title = `Artigos e notícias | ${siteName}`

  return {
    title,
    description: ARTIGOS_DESCRIPTION,
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      siteName,
      title,
      description: ARTIGOS_DESCRIPTION,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: ARTIGOS_DESCRIPTION,
      creator: twitterCreator,
      images: images.map((image) => image.url),
    },
  }
}

export default async function ArtigosPage() {
  const latestNews = (await getVisiblePosts())
    .filter((post) => post.type === 'noticia')
    .slice(0, LATEST_NEWS_LIMIT)

  return (
    <main className="w-full">
      <CampaignInternalPageIntro eyebrow="Mandato em movimento" title="Artigos e notícias" />

      <section data-theme="editorial" className="w-full bg-background text-foreground">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <h2 className="border-none text-left text-3xl font-bold tracking-tight sm:text-4xl">
              Últimas notícias
            </h2>
            <Link
              href={getTypePath('noticia')}
              className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              Ver todas
            </Link>
          </div>
          {latestNews.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {latestNews.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhuma notícia publicada ainda.</p>
          )}
        </div>
      </section>
    </main>
  )
}
