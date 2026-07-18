import { PostCard } from '@/components/PostCard'
import { SiteHeader } from '@/components/SiteHeader'
import { Badge } from '@/components/ui/Badge'
import { Separator } from '@/components/ui/separator'
import { getCachedGlobal } from '@/utilities/globals'
import { stripTrailingSlash } from '@/utilities/seo'
import { POST_TYPE_LABELS, getVisiblePosts, isPostType } from '@/utilities/posts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const dynamicParams = true

type RouteParams = { type: string }

export async function generateStaticParams(): Promise<RouteParams[]> {
  const posts = await getVisiblePosts()
  const types = new Set(posts.map((post) => post.type))
  return [...types].map((type) => ({ type }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}): Promise<Metadata> {
  const { type } = await params
  if (!isPostType(type)) return {}

  const globalMetadata = await getCachedGlobal('metadata')()
  const siteUrl = stripTrailingSlash(globalMetadata.URL)
  const label = POST_TYPE_LABELS[type]
  const title = `${label} | ${globalMetadata.openGraph.siteName}`
  const description = `${label} de ${globalMetadata.openGraph.siteName}.`

  return {
    title,
    description,
    alternates: { canonical: `${siteUrl}/${type}` },
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      url: `${siteUrl}/${type}`,
      siteName: globalMetadata.openGraph.siteName,
      title,
      description,
    },
  }
}

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { type } = await params
  if (!isPostType(type)) return notFound()

  const posts = (await getVisiblePosts()).filter((post) => post.type === type)

  const label = POST_TYPE_LABELS[type]

  return (
    <>
      <SiteHeader breadcrumbs={[{ label }]} />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="mb-6 flex flex-col items-start gap-3">
          <Badge className="bg-primary/10 text-primary uppercase tracking-wide">Publicações</Badge>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{label}</h1>
        </header>
        <Separator className="mb-8" />
        {posts.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">Nenhuma publicação por aqui ainda.</p>
        )}
      </main>
    </>
  )
}
