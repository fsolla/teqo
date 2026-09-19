import { PostCard } from '@/components/PostCard'
import { ShareLinkRedirect } from '@/components/ShareLinkRedirect'
import { SiteHeader } from '@/components/SiteHeader'
import { Badge } from '@/components/ui/Badge'
import { Separator } from '@/components/ui/separator'
import {
  isValidShareLinkDestination,
  normalizeShareLinkDescription,
  shareLinkPath,
} from '@/lib/shareLink'
import type { ShareLink } from '@/payload-types'
import { getCachedGlobal } from '@/utilities/globalReads'
import { POST_TYPE_LABELS, getVisiblePosts, isPostType } from '@/utilities/posts'
import { absoluteSitePath, resolveSiteMetadata } from '@/utilities/seo'
import {
  getCachedPublishedShareLinkBySlug,
  resolveShareLinkOgImageUrl,
} from '@/utilities/shareLinkReads'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

export const dynamicParams = true

type RouteParams = { type: string }

export async function generateStaticParams(): Promise<RouteParams[]> {
  const posts = await getVisiblePosts()
  const types = new Set(posts.map((post) => post.type))
  return [...types].map((type) => ({ type }))
}

/**
 * S19 — the share-link page lives inside the existing `[type]` dynamic segment
 * (Next refuses a second dynamic folder name at the same level, E337). A
 * non-post-type segment is looked up as a published share link; an unknown,
 * unpublished or invalid one resolves to the same 404 (never reveals whether it
 * existed), the same uniform not-found contract as `/corte/[id]`.
 */
const loadPublishedShareLink = async (slug: string): Promise<ShareLink | null> => {
  const link = await getCachedPublishedShareLinkBySlug(slug)()
  if (!link || !isValidShareLinkDestination(link.destination)) return null
  return link
}

const resolveShareLinkMetadata = async (link: ShareLink): Promise<Metadata> => {
  const globalMetadata = await getCachedGlobal('metadata')()
  const { siteUrl, siteName, twitterCreator } = resolveSiteMetadata(globalMetadata)
  const canonicalUrl = absoluteSitePath(siteUrl, shareLinkPath(link.slug))
  const description = normalizeShareLinkDescription(link.description)
  const imageUrl = await resolveShareLinkOgImageUrl(link)
  const images = imageUrl ? [{ url: imageUrl, alt: link.title }] : []

  return {
    title: `${link.title} | ${siteName}`,
    description,
    robots: { index: false, follow: false },
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      siteName,
      // The card shows exactly what the editor configured (never the destination).
      title: link.title,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: link.title,
      description,
      creator: twitterCreator,
      images: images.map((entry) => entry.url),
    },
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}): Promise<Metadata> {
  const { type } = await params
  if (isPostType(type)) {
    const globalMetadata = await getCachedGlobal('metadata')()
    const { siteUrl, siteName } = resolveSiteMetadata(globalMetadata)
    const label = POST_TYPE_LABELS[type]
    const title = `${label} | ${siteName}`
    const description = `${label} de ${siteName}.`
    const canonicalUrl = absoluteSitePath(siteUrl, `/${type}`)

    return {
      title,
      description,
      ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
      openGraph: {
        type: 'website',
        locale: 'pt-BR',
        ...(canonicalUrl ? { url: canonicalUrl } : {}),
        siteName,
        title,
        description,
      },
    }
  }

  const link = await loadPublishedShareLink(type)
  if (!link) return {}

  return resolveShareLinkMetadata(link)
}

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { type } = await params

  if (!isPostType(type)) {
    const link = await loadPublishedShareLink(type)
    if (!link) notFound()

    return <ShareLinkRedirect destination={link.destination} />
  }

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
