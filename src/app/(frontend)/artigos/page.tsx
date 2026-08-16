import { PostCard } from '@/components/PostCard'
import { Media } from '@/payload-types'
import { getCachedDocumentById } from '@/utilities/documentReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { getTypePath, getVisiblePosts } from '@/utilities/posts'
import Image from 'next/image'
import Link from 'next/link'

const LATEST_NEWS_LIMIT = 6

export default async function ArtigosPage() {
  const home = await getCachedGlobal('home', 2)()

  let heroImage: Media | null = null
  if (typeof home.image === 'number') {
    heroImage = await getCachedDocumentById('media', `${home.image}`)()
  } else {
    heroImage = home.image ?? null
  }

  const latestNews = (await getVisiblePosts())
    .filter((post) => post.type === 'noticia')
    .slice(0, LATEST_NEWS_LIMIT)

  return (
    <main className="w-full">
      <section className="relative flex min-h-[68vh] w-full flex-col items-center justify-center gap-8 px-4 pt-24 pb-16 text-center text-(--site-header-foreground) sm:px-6 sm:pt-28 lg:px-8">
        <div className="flex max-w-4xl flex-col items-center gap-5">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl">
            O mandato do tamanho da Bahia
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-(--site-header-muted) sm:text-xl">
            Notícias, campanhas e a atuação do deputado Jorge Solla por uma Bahia mais justa.
          </p>
          <Link
            href={getTypePath('noticia')}
            className="inline-flex items-center justify-center rounded-md bg-white/15 px-5 py-2.5 text-sm font-semibold text-(--site-header-foreground) ring-1 ring-white/25 backdrop-blur transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            Ver notícias
          </Link>
        </div>
        {heroImage?.url ? (
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15">
            <Image
              className="h-auto w-full object-cover"
              src={heroImage.url}
              alt={heroImage.alt}
              width={heroImage.width ?? 1200}
              height={heroImage.height ?? 675}
              priority
            />
          </div>
        ) : null}
      </section>

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
