import type { Crumb } from '@/components/SiteHeader'
import { SiteHeader } from '@/components/SiteHeader'
import { Badge } from '@/components/ui/Badge'
import type { Media, Post } from '@/payload-types'
import { getCachedDocumentById } from '@/utilities/documentReads'
import { extractFirstImageFromLexical } from '@/utilities/extractFirstImageFromLexical'
import { getCachedGlobal } from '@/utilities/globalReads'
import {
  POST_TYPE_LABELS,
  formatPostDate,
  getCachedPostBySlug,
  getCategoryListingPath,
  getCategoryName,
  getCategorySlug,
  getPostCanonicalPath,
  getTypePath,
  getVisiblePosts,
  isPostType,
  isPostVisible,
} from '@/utilities/posts'
import { stripTrailingSlash, toAbsoluteUrl, truncate } from '@/utilities/seo'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import type { Article, WithContext } from 'schema-dts'

export const dynamicParams = true

const MAX_DESCRIPTION_LENGTH = 200

type RouteParams = { type: string; category: string; slug: string }

export async function generateStaticParams(): Promise<RouteParams[]> {
  const posts = await getVisiblePosts()

  return posts
    .map((post): RouteParams | null => {
      const category = getCategorySlug(post)
      if (!category || !post.slug) return null
      return { type: post.type, category, slug: post.slug }
    })
    .filter((entry): entry is RouteParams => entry !== null)
}

type Metadatum = Awaited<ReturnType<ReturnType<typeof getCachedGlobal<'metadata'>>>>

/** Resolve the OG image: cover image first, then first body image, then the global fallback. */
async function resolveOgImage(post: Post, globalImage: Metadatum['image']): Promise<Media | null> {
  const cover =
    typeof post.coverImage === 'object' && post.coverImage !== null ? post.coverImage : null
  if (cover) return cover

  const bodyImage = post.body ? extractFirstImageFromLexical(post.body) : null
  if (bodyImage) return bodyImage

  if (globalImage) {
    return typeof globalImage === 'number'
      ? await getCachedDocumentById('media', String(globalImage))()
      : globalImage
  }

  return null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getCachedPostBySlug(slug)()

  if (!post || !isPostVisible(post)) return {}

  const globalMetadata = await getCachedGlobal('metadata')()
  const siteUrl = stripTrailingSlash(globalMetadata.URL)
  const canonicalPath = getPostCanonicalPath(post)
  const canonicalUrl = canonicalPath ? `${siteUrl}${canonicalPath}` : siteUrl

  const image = await resolveOgImage(post, globalMetadata.image)
  const imageUrl = image?.url ? toAbsoluteUrl(image.url, siteUrl) : undefined

  const description = post.subtitle
    ? truncate(post.subtitle, MAX_DESCRIPTION_LENGTH)
    : globalMetadata.description
  const title = `${post.title} | ${globalMetadata.openGraph.siteName}`
  const categoryName = getCategoryName(post)

  const keywords = [
    ...globalMetadata.keywords
      .map((k) => (typeof k === 'string' ? k : k.keyword))
      .filter((k): k is string => typeof k === 'string'),
    post.title,
    ...(categoryName ? [categoryName] : []),
  ]

  const ogImages = imageUrl
    ? [
        {
          url: imageUrl,
          secureUrl: imageUrl,
          width: image?.width ?? undefined,
          height: image?.height ?? undefined,
          alt: image?.alt,
          type: image?.mimeType ?? undefined,
        },
      ]
    : []

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'article',
      locale: 'pt-BR',
      url: canonicalUrl,
      siteName: globalMetadata.openGraph.siteName,
      title,
      description,
      images: ogImages,
      publishedTime: post.publishedDate ?? post.createdAt,
      modifiedTime: post.updatedAt,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: globalMetadata.twitter.creator,
      images: ogImages.map((img) => img.url),
    },
  }
}

export default async function Page({ params }: { params: Promise<RouteParams> }) {
  const { type, category, slug } = await params

  if (!isPostType(type)) return notFound()

  const post = await getCachedPostBySlug(slug)()

  if (!post || !isPostVisible(post)) return notFound()

  const canonicalPath = getPostCanonicalPath(post)
  if (!canonicalPath) return notFound()

  // Redirect stale/mismatched URLs to the canonical type + category slug.
  if (canonicalPath !== `/${type}/${category}/${slug}`) {
    return redirect(canonicalPath)
  }

  const globalMetadata = await getCachedGlobal('metadata')()
  const siteUrl = stripTrailingSlash(globalMetadata.URL)
  const canonicalUrl = `${siteUrl}${canonicalPath}`

  const ogImage = await resolveOgImage(post, globalMetadata.image)
  const ogImageUrl = ogImage?.url ? toAbsoluteUrl(ogImage.url, siteUrl) : undefined

  const categoryName = getCategoryName(post)
  const categorySlug = getCategorySlug(post)
  const publishedDate = formatPostDate(post.publishedDate)

  const coverImage =
    typeof post.coverImage === 'object' && post.coverImage !== null ? post.coverImage : null

  const breadcrumbs: Crumb[] = [
    { label: POST_TYPE_LABELS[post.type], href: getTypePath(post.type) },
    ...(categoryName && categorySlug
      ? [{ label: categoryName, href: getCategoryListingPath(post.type, categorySlug) }]
      : []),
    { label: post.title },
  ]

  const jsonLd: WithContext<Article> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    ...(post.subtitle ? { description: truncate(post.subtitle, MAX_DESCRIPTION_LENGTH) } : {}),
    inLanguage: 'pt-BR',
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    datePublished: post.publishedDate ?? post.createdAt,
    dateModified: post.updatedAt,
    ...(ogImageUrl ? { image: [ogImageUrl] } : {}),
    author: {
      '@type': 'Organization',
      name: globalMetadata.openGraph.siteName,
      url: siteUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: globalMetadata.openGraph.siteName,
      url: siteUrl,
    },
  }

  const bodyHTML = post.body ? convertLexicalToHTML({ data: post.body }) : ''
  // Escape "<" so no field value (e.g. a title containing "</script>") can break out of the JSON-LD script tag.
  const jsonLdString = JSON.stringify(jsonLd).replace(/</g, '\\u003c')

  return (
    <>
      <SiteHeader breadcrumbs={breadcrumbs} />
      <main className="w-full">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString }} />
        <section className="border-b border-border bg-muted/30">
          <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 text-xs font-medium text-muted-foreground">
                {categoryName ? <Badge variant="secondary">{categoryName}</Badge> : null}
                {publishedDate ? (
                  <time
                    className="uppercase tracking-wide"
                    dateTime={post.publishedDate ?? undefined}
                  >
                    {publishedDate}
                  </time>
                ) : null}
              </div>
              <h1 className="text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl lg:text-5xl">
                {post.title}
              </h1>
              {post.subtitle ? (
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  {post.subtitle}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {coverImage?.url ? (
          <figure className="mx-auto w-full max-w-4xl px-4 pt-10 sm:px-6 lg:px-8 lg:pt-12">
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted ring-1 ring-border">
              <Image
                src={coverImage.url}
                alt={coverImage.alt ?? post.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 896px"
                className="object-cover"
              />
            </div>
          </figure>
        ) : null}

        <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
          {bodyHTML ? (
            <article
              className="space-y-6 text-lg leading-8 text-foreground/90 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:pl-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:border-none [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-primary [&_h3]:text-xl [&_h3]:font-semibold [&_img]:rounded-lg [&_li]:ml-5 [&_li]:list-disc [&_p]:text-lg [&_strong]:font-semibold [&_strong]:text-foreground"
              dangerouslySetInnerHTML={{ __html: bodyHTML }}
            />
          ) : null}
        </section>
      </main>
    </>
  )
}
