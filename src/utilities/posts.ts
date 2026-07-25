import 'server-only'

import type { Post, Tag } from '@/payload-types'

import configPromise from '@payload-config'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'

const POST_TYPES = ['noticia', 'campanha', 'artigo', 'evento'] as const

export type PostType = (typeof POST_TYPES)[number]

export const POST_TYPE_LABELS: Record<PostType, string> = {
  noticia: 'Notícias',
  campanha: 'Campanha',
  artigo: 'Artigos',
  evento: 'Eventos',
}

export const isPostType = (value: string): value is PostType =>
  (POST_TYPES as readonly string[]).includes(value)

/**
 * A related tag hides its posts when it is explicitly marked `hidden`, OR when
 * the relation is unpopulated (a bare numeric id). Unpopulated relations fail
 * closed so we never leak a post whose electoral-control tags we could not
 * verify.
 */
const isTagHiding = (tag: number | Tag): boolean =>
  typeof tag !== 'object' || tag === null || tag.hidden === true

/**
 * A post is visible on the site only if it is published AND NONE of its tags —
 * including the required `category` tag — is `hidden`. Requires the
 * `category`/`tags` relations to be populated (fetch with depth >= 1); an
 * unpopulated tag fails closed and hides the post.
 */
export const isPostVisible = (post: Post): boolean => {
  if (post._status !== 'published') return false

  const relatedTags: (number | Tag)[] = [post.category, ...(post.tags ?? [])]

  return !relatedTags.some(isTagHiding)
}

export const getCategorySlug = (post: Post): string | null =>
  typeof post.category === 'object' && post.category !== null ? (post.category.slug ?? null) : null

export const getCategoryName = (post: Post): string | null =>
  typeof post.category === 'object' && post.category !== null ? post.category.name : null

/** Listing path for a post type, e.g. `/noticia`. */
export const getTypePath = (type: PostType): string => `/${type}`

/** Listing path for a category within a type, e.g. `/noticia/saude`. */
export const getCategoryListingPath = (type: PostType, categorySlug: string): string =>
  `${getTypePath(type)}/${categorySlug}`

/** Canonical article path derived from the post's CURRENT type + category slug. */
export const getPostCanonicalPath = (post: Post): string | null => {
  const categorySlug = getCategorySlug(post)
  if (!post.slug || !categorySlug) return null
  return `${getCategoryListingPath(post.type, categorySlug)}/${post.slug}`
}

export const formatPostDate = (date?: string | null): string | null => {
  if (!date) return null
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(date))
}

const findPublishedPosts = (depth: number) =>
  getPayload({ config: configPromise }).then((payload) =>
    payload.find({
      collection: 'post',
      depth,
      limit: 0,
      sort: '-publishedDate',
      where: { _status: { equals: 'published' } },
    }),
  )

const findPublishedPostBySlug = (slug: string, depth: number) =>
  getPayload({ config: configPromise })
    .then((payload) =>
      payload.find({
        collection: 'post',
        depth,
        limit: 1,
        where: {
          and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }],
        },
      }),
    )
    .then((result) => result.docs[0] ?? null)

/**
 * Cached list of every published post. Tagged with the shared `posts` listing
 * tag so `revalidatePostsListing()` (called from Post/Tag `afterChange`) busts it.
 */
const getCachedPublishedPosts = (depth = 1) =>
  unstable_cache(() => findPublishedPosts(depth), ['posts', String(depth)], {
    tags: ['posts'],
  })

export const getCachedPostBySlug = (slug: string, depth = 2) =>
  unstable_cache(
    () => findPublishedPostBySlug(slug, depth),
    ['post-by-slug', slug, String(depth)],
    { tags: ['posts'] },
  )

/**
 * Every published post that also passes the site visibility predicate, newest
 * first. Shared by the home page and every listing/article route so the
 * `getCachedPublishedPosts(...).docs.filter(isPostVisible)` boilerplate lives once.
 */
export const getVisiblePosts = async (depth = 1): Promise<Post[]> => {
  const { docs } = await getCachedPublishedPosts(depth)()
  return docs.filter(isPostVisible)
}
