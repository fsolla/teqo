import { PostCard } from '@/components/PostCard'
import { SiteHeader } from '@/components/SiteHeader'
import { Badge } from '@/components/ui/Badge'
import { Separator } from '@/components/ui/separator'
import { getCachedGlobal } from '@/utilities/globals'
import { stripTrailingSlash } from '@/utilities/seo'
import {
  POST_TYPE_LABELS,
  getCategoryName,
  getCategorySlug,
  getVisiblePosts,
  isPostType,
} from '@/utilities/posts'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const dynamicParams = true

type RouteParams = { type: string; category: string }

export async function generateStaticParams(): Promise<RouteParams[]> {
  const posts = await getVisiblePosts()
  const combos = new Map<string, RouteParams>()

  for (const post of posts) {
    const category = getCategorySlug(post)
    if (!category) continue
    combos.set(`${post.type}/${category}`, { type: post.type, category })
  }

  return [...combos.values()]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}): Promise<Metadata> {
  const { type, category } = await params
  if (!isPostType(type)) return {}

  const posts = (await getVisiblePosts()).filter(
    (post) => post.type === type && getCategorySlug(post) === category,
  )

  if (!posts.length) return {}

  const globalMetadata = await getCachedGlobal('metadata')()
  const siteUrl = stripTrailingSlash(globalMetadata.URL)
  const categoryName = getCategoryName(posts[0]) ?? category
  const label = POST_TYPE_LABELS[type]
  const title = `${categoryName} | ${label} | ${globalMetadata.openGraph.siteName}`
  const description = `${label} sobre ${categoryName} de ${globalMetadata.openGraph.siteName}.`
  const canonicalUrl = `${siteUrl}/${type}/${category}`

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      url: canonicalUrl,
      siteName: globalMetadata.openGraph.siteName,
      title,
      description,
    },
  }
}

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { type, category } = await params
  if (!isPostType(type)) return notFound()

  const posts = (await getVisiblePosts()).filter(
    (post) => post.type === type && getCategorySlug(post) === category,
  )

  if (!posts.length) return notFound()

  const categoryName = getCategoryName(posts[0]) ?? category
  const label = POST_TYPE_LABELS[type]

  return (
    <>
      <SiteHeader breadcrumbs={[{ label, href: `/${type}` }, { label: categoryName }]} />
      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <header className="mb-6 flex flex-col items-start gap-3">
          <Badge className="bg-primary/10 text-primary uppercase tracking-wide">{label}</Badge>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {categoryName}
          </h1>
        </header>
        <Separator className="mb-8" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </main>
    </>
  )
}
