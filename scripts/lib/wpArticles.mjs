/**
 * Live-fetch helpers for the WordPress origin jorgesolla.com.br.
 *
 * Extracted from scripts/seed-posts.mjs (OPS52-media) so the seed and the
 * media-recovery tool share ONE implementation of "fetch the live articles"
 * and "resolve the cover image" — no twin fetch logic.
 *
 * Cover resolution mirrors the seed exactly: the WordPress REST featured media
 * (`_embedded`), falling back to the first inline <img> of the article body
 * (most covers on this site come from that fallback — only 7/43 posts carry
 * featured media).
 */
import { JSDOM } from 'jsdom'

export const WP_BASE_URL = 'https://jorgesolla.com.br'
export const WP_USER_AGENT = 'teqo-content-migration-bot/1.0 (+https://jorgesolla.com.br)'

export const stripHtml = (html) =>
  new JSDOM(`<!DOCTYPE html><body>${html || ''}</body>`).window.document.body.textContent
    .replace(/\s+/g, ' ')
    .trim()

/** Normalized article shape returned by the REST fetch. */
/** @typedef {{ slug: string, title: string, date: string|null, html: string, coverUrl: string|null, coverAlt: string|null }} Article */

/**
 * Fetches the live articles from the WordPress REST API (`_embed`, paginated).
 * @param {AbortSignal} [signal] Optional — the seed passes none (its HTML-crawl
 *   fallback depends on the current failure semantics); the media-recovery
 *   tool passes a timeout so a stalled origin fails fast.
 * @returns {Promise<Article[]>}
 */
export async function fetchArticlesFromWordPress(signal) {
  /** @type {Article[]} */
  const articles = []
  let page = 1
  let totalPages = 1

  do {
    const url = `${WP_BASE_URL}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed`
    const res = await fetch(url, { headers: { 'User-Agent': WP_USER_AGENT }, signal })
    if (!res.ok) throw new Error(`REST API returned ${res.status} for page ${page}`)

    if (page === 1) {
      totalPages = Number(res.headers.get('x-wp-totalpages') || '1') || 1
    }

    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break

    for (const item of data) {
      const embeddedMedia = item?._embedded?.['wp:featuredmedia']?.[0]
      articles.push({
        slug: item.slug,
        title: stripHtml(item?.title?.rendered) || item.slug,
        date: item.date || null,
        html: item?.content?.rendered || '',
        coverUrl: embeddedMedia?.source_url || null,
        coverAlt: embeddedMedia?.alt_text || null,
      })
    }

    page += 1
  } while (page <= totalPages)

  return articles
}

/**
 * First inline <img src> of an article's body HTML (absolute URL kept as-is).
 * @param {string} html
 * @returns {string|null}
 */
export function inlineCoverUrl(html) {
  const doc = new JSDOM(`<!DOCTYPE html><body><div id="root">${html || ''}</div></body>`).window
    .document
  return doc.getElementById('root').querySelector('img')?.getAttribute('src') || null
}

/**
 * Cover resolution shared with the seed: REST featured media, else the first
 * inline image of the body.
 * @param {Article} article
 * @returns {string|null}
 */
export function resolveCoverSource(article) {
  return article.coverUrl || inlineCoverUrl(article.html)
}

/**
 * Media filenames follow the seed's deterministic key `<slug>.<ext>`; the
 * slug is the filename without its last extension.
 * @param {string} filename
 * @returns {string}
 */
export function slugFromFilename(filename) {
  return filename.replace(/\.[a-z0-9]+$/i, '')
}

/**
 * Resolves a cover URL for downloading: relative sources become absolute
 * against the WordPress origin, and only http(s) URLs on that host pass —
 * the recovery tool runs with network reach, so covers must stay on the
 * trusted origin (all resolved covers today are jorgesolla.com.br).
 * @param {string} coverUrl
 * @returns {string}
 */
export function resolveCoverDownloadUrl(coverUrl) {
  let url
  try {
    url = new URL(coverUrl, WP_BASE_URL)
  } catch {
    throw new Error(`cover URL inválida: ${coverUrl}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`cover URL com protocolo inesperado: ${url.protocol}`)
  }
  if (url.host !== new URL(WP_BASE_URL).host) {
    throw new Error(`cover URL fora do origin do WordPress: ${url.host}`)
  }
  return url.href
}

/**
 * Pure row→cover mapping used by the media-recovery tool: for each media row,
 * the post that references it as coverImage gives the exact slug; rows without
 * a post fall back to the slug derived from the deterministic filename.
 * @param {{ id: number|string, filename: string|null }[]} mediaRows
 * @param {{ coverImage: number|string|null, slug: string }[]} posts
 * @param {Map<string, Article>} articlesBySlug
 * @returns {{ row: object, slug: string|null, coverUrl: string|null, source: 'post'|'filename'|null }[]}
 */
export function resolveMediaCoverSources(mediaRows, posts, articlesBySlug) {
  const slugByMediaId = new Map()
  for (const post of posts) {
    if (post.coverImage != null) slugByMediaId.set(post.coverImage, post.slug)
  }

  return mediaRows.map((row) => {
    const slugFromPost = row.id != null ? slugByMediaId.get(row.id) : undefined
    const slug = slugFromPost || slugFromFilename(row.filename || '')
    const article = slug ? articlesBySlug.get(slug) : undefined
    return {
      row,
      slug: slug || null,
      coverUrl: article ? resolveCoverSource(article) : null,
      source: slugFromPost ? 'post' : article ? 'filename' : null,
    }
  })
}
