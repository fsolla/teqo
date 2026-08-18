/**
 * Seeds the `post` / `tag` / `media` collections from a LIVE fetch of
 * jorgesolla.com.br, classifying each article by category + tags.
 *
 * Source of truth is the live site (fetched when the script runs), NOT the
 * reference `noticias-jorgesolla.md`. Primary source is the public WordPress
 * REST API (`/wp-json/wp/v2/posts`), with an HTML category-archive crawl as a
 * fallback if the API is blocked/unavailable.
 *
 * Safety model (mirrors scripts/guard-dev-db.mjs and scripts/db-pull.mjs):
 *   - This script WRITES (creates posts/tags/media). It refuses to run against
 *     a non-local DATABASE_URL unless ALLOW_REMOTE_DB=true is set explicitly.
 *   - Idempotent: re-running looks up posts/tags/media by slug/filename and
 *     skips (or reuses) what already exists, so it never duplicates.
 *
 * HTML -> Lexical: the WordPress `content.rendered` HTML is converted to
 * Payload Lexical richText with `convertHTMLToLexical` from
 * `@payloadcms/richtext-lexical`, using the project's default editor config
 * (via `editorConfigFactory.default`) and `jsdom` as the DOM implementation.
 * The frontend renders `body` with `convertLexicalToHTML`, so this round-trips.
 *
 * Usage:
 *   pnpm db:seed:posts
 *   pnpm db:seed:posts --dry-run   (plan-only: fetches + resolves covers and
 *                                   reports what WOULD be created — no writes)
 *   (against a remote DB, on purpose:)  ALLOW_REMOTE_DB=true pnpm db:seed:posts
 */
import { convertHTMLToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { JSDOM } from 'jsdom'
import { getPayload } from 'payload'
import { dieWithLabel, loadCliEnv } from './lib/cli.mjs'

import { assertLocalDatabase } from './assert-local-database.mjs'

import {
  WP_BASE_URL as BASE_URL,
  WP_USER_AGENT as USER_AGENT,
  fetchArticlesFromWordPress,
  resolveCoverSource,
  stripHtml,
} from './lib/wpArticles.mjs'

/** @import { Article } from './lib/wpArticles.mjs' */

// Mirror Next.js precedence (.env.local wins over .env) without clobbering a
// DATABASE_URL already set in the real environment.
loadCliEnv()

const config = (await import('../src/payload.config.ts')).default

const die = dieWithLabel('seed:posts')

const args = new Set(process.argv.slice(2))
const unknown = [...args].filter((a) => a !== '--dry-run')
if (unknown.length > 0) die(`argumento desconhecido: ${unknown.join(', ')}`)
const dryRun = args.has('--dry-run')

/** Host do DATABASE_URL para o echo do alvo — die limpo se a URL for inválida. */
const echoTargetHost = () => {
  try {
    return new URL(process.env.DATABASE_URL).host
  } catch {
    die(`DATABASE_URL não é uma connection string válida: ${process.env.DATABASE_URL || '(vazia)'}`)
  }
}

// ---------------------------------------------------------------------------
// Taxonomy (Section 7): the categories + control tag, and the per-article map.
// Keys are the WordPress slugs of the live articles. Every post gets exactly
// one required `category`; `tags` is optional (currently only `eleitoral`).
// The `eleitoral` tag marks pre-candidacy / campaign / PGP / party-event
// content so Francisco can hide it all with one toggle in the electoral period.
// Criterion: content tied to a campaign event or candidacy (convenções,
// plenárias, caravanas, filiações, PGP) gets `eleitoral`; political
// rebuttals/position-taking without a campaign event stay plain `politica`.
// ---------------------------------------------------------------------------

const TAXONOMY_TAGS = [
  { slug: 'saude', name: 'Saúde' },
  { slug: 'cultura', name: 'Cultura' },
  { slug: 'desenvolvimento', name: 'Desenvolvimento' },
  { slug: 'politica', name: 'Política' },
  { slug: 'educacao', name: 'Educação' },
  { slug: 'seguranca', name: 'Segurança' },
  { slug: 'direitos-trabalhistas', name: 'Direitos trabalhistas' },
  { slug: 'eleitoral', name: 'Eleitoral' },
]

const DEFAULT_CATEGORY = 'politica'

/** WP slug -> { category, tags }. See report/plan Section 7. */
const CLASSIFICATION = {
  // Health
  'lula-jeronimo-e-solla-inauguram-hospital-do-litoral-norte-da-bahia': { category: 'saude' },
  'solla-reforca-luta-por-cumprimento-do-piso-da-enfermagem-em-audiencia-na-camara': {
    category: 'saude',
  },
  'emenda-de-solla-garante-maquinas-de-costura-a-associacao-de-fibromialgia': { category: 'saude' },
  'solla-comemora-25-anos-da-politica-nacional-de-sangue-neste-16-de-abril': { category: 'saude' },
  'fora-trump-em-defesa-da-saude-e-da-paz': { category: 'saude' },
  'portaria-autoriza-retorno-de-mais-de-300-servidores-a-funasa': { category: 'saude' },
  'missao-internacional-com-solla-lula-e-jeronimo-fortalece-producao-de-medicamentos-estrategicos-e-projeta-a-bahia-como-polo-de-biofarmacos':
    { category: 'saude' },
  'solla-desembarca-na-india-em-missao-oficial-com-lula-pela-asia': { category: 'saude' },

  // Culture
  'solla-exalta-primeiro-ano-de-salvador-como-capital-do-brasil-no-2-de-julho': {
    category: 'cultura',
  },
  'audiencia-publica-debate-plano-nacional-de-cultura': { category: 'cultura' },

  // Development
  'solla-e-jeronimo-inauguram-mercado-publico-de-ubata': { category: 'desenvolvimento' },
  'governo-da-bahia-anuncia-pacote-de-quase-r-2-bi': { category: 'desenvolvimento' },
  'com-solla-comissao-acompanha-retomada-da-producao-no-enseada-em-maragogipe': {
    category: 'desenvolvimento',
  },
  'recomprar-a-refinaria-de-mataripe-e-defender-a-bahia-e-a-soberania-do-brasil': {
    category: 'desenvolvimento',
  },
  'solla-protocola-pec-para-garantir-controle-estatal-sobre-petroleo-e-derivados-no-brasil': {
    category: 'desenvolvimento',
  },
  'solla-leva-comissao-da-camara-para-nova-visita-tecnica-ao-estaleiro-enseada': {
    category: 'desenvolvimento',
  },
  'entrevista-solla-fala-sobre-a-retomada-dos-investimentos-publicos-no-pais': {
    category: 'desenvolvimento',
  },
  'obra-de-ampliacao-do-sistema-de-abastecimento-do-rio-paraguacu-itirucu-jaguaquara': {
    category: 'desenvolvimento',
  },
  'governo-lula-corrige-erro-de-antecessor-diz-solla-sobre-suspensao-da-importacao-de-cacau': {
    category: 'desenvolvimento',
  },

  // Politics (with electoral control where applicable)
  'programa-de-governo-participativo-reune-multidao-em-periperi': {
    category: 'politica',
    tags: ['eleitoral'],
  },
  'bruno-reis-foi-covarde-detonou-solla-ao-rebater-o-prefeito-sobre-saude-de-salvador': {
    category: 'politica',
  },
  'chapada-diamantina-recebe-caravana-liderada-pelo-deputado-jorge-solla': {
    category: 'politica',
    tags: ['eleitoral'],
  },
  'lula-reforca-o-time-de-jeronimo-wagner-rui-e-jorge-solla-na-convencao-estadual-do-pt': {
    category: 'politica',
    tags: ['eleitoral'],
  },
  'o-pt-tem-que-disputar-o-programa-de-governo-conclamou-jorge-solla-em-plenaria': {
    category: 'politica',
    tags: ['eleitoral'],
  },
  'clube-2004-celebra-a-democracia-com-o-lancamento-da-pre-candidatura-de-jorge-solla-a-deputado-federal':
    { category: 'politica', tags: ['eleitoral'] },
  'articulada-por-solla-filiacao-de-zilar-portela-ao-pt-marca-lancamento-de-pre-candidatura-a-deputada-estadual':
    { category: 'politica', tags: ['eleitoral'] },
  'articulacao-de-solla-fortalece-pt-com-filiacao-da-lideranca-sindical-zilar-portela': {
    category: 'politica',
    tags: ['eleitoral'],
  },
  'federacao-brasil-esperanca-exige-defesa-do-nosso-projeto-politico': {
    category: 'politica',
    tags: ['eleitoral'],
  },
  'com-presenca-de-solla-e-aliados-aniversario-do-pt-de-jacobina-reune-liderancas-e-reafirma-compromisso-o-desenvolvimento-da-bahia':
    { category: 'politica', tags: ['eleitoral'] },
  'pt-de-jacobina-celebra-aniversario-com-presenca-de-jorge-solla-e-do-secretario-do-governo-lula-julio-pinheiro':
    { category: 'politica', tags: ['eleitoral'] },
  'solla-e-indicado-em-estudo-da-arko-advice-como-um-politico-da-elite-parlamentar': {
    category: 'politica',
  },
  'solla-rebate-ataques-de-ze-coca-e-destaca-investimentos-do-mandato-em-itirucu-e-na-regiao-de-jequie':
    { category: 'politica' },

  // Education
  'solla-conduz-cffc-em-visita-tecnica-a-primeira-faculdade-de-medicina-do-brasil': {
    category: 'educacao',
  },
  'ao-lado-de-camilo-santana-jorge-solla-acompanha-avancos-da-educacao-federal-em-barreiras-e-pocoes':
    { category: 'educacao' },
  'solla-articula-no-mec-avancos-para-expansao-da-educacao-superior-e-da-educacao-profissional-na-bahia':
    { category: 'educacao' },
  'solla-comemora-anuncio-de-construcao-de-novo-campus-federal-em-jequie': { category: 'educacao' },
  'apresentacao-do-plano-de-restauracao-arquitetonica-da-famed-ufba': { category: 'educacao' },
  'solla-participa-das-celebracoes-pelos-218-anos-da-faculdade-de-medicina-da-ufba': {
    category: 'educacao',
  },
  'solla-articula-agenda-de-dirigentes-da-ufba-no-ministerio-da-cultura-para-viabilizar-reforma-de-alas-da-faculdade-de-medicina':
    { category: 'educacao' },

  // Security
  'camara-aprova-pec-da-seguranca-publica-e-solla-destaca-avanco-da-proposta-do-governo-lula': {
    category: 'seguranca',
  },

  // Labor rights
  'fim-da-escala-6x1-tambem-e-questao-de-saude': { category: 'direitos-trabalhistas' },
  'jorge-solla-apresenta-pec-que-eleva-pensao-por-morte': { category: 'direitos-trabalhistas' },
  'da-asia-solla-manifesta-apoio-a-servidores-demitidos-por-bruno-reis': {
    category: 'direitos-trabalhistas',
  },
}

// ---------------------------------------------------------------------------
// Live fetch — WordPress REST API (primary; implementation in
// scripts/lib/wpArticles.mjs — shared with the media-recovery tool)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Live fetch — HTML category-archive crawl (fallback)
// Mirrors conteudo-atual-scraping/scrape_jorgesolla.py.
// ---------------------------------------------------------------------------

const FALLBACK_CATEGORIES = ['noticias', 'uncategorized']
const PERMALINK_RE = new RegExp(
  `^${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/\\d{4}/\\d{2}/\\d{2}/[^/]+/?$`,
)

async function fetchViaHtmlArchive() {
  /** @type {Article[]} */
  const articles = []
  const seen = new Set()

  for (const category of FALLBACK_CATEGORIES) {
    let pageNum = 1
    while (pageNum <= 30) {
      const url =
        pageNum === 1
          ? `${BASE_URL}/category/${category}/`
          : `${BASE_URL}/category/${category}/page/${pageNum}/`
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (res.status === 404) break
      if (!res.ok) throw new Error(`archive ${url} returned ${res.status}`)

      const doc = new JSDOM(await res.text()).window.document
      const links = new Set()
      for (const heading of doc.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
        const a = heading.querySelector('a[href]')
        if (!a) continue
        const href = a.href.replace(/\/?$/, '/')
        if (PERMALINK_RE.test(href)) links.add(href)
      }

      const fresh = [...links].filter((href) => !seen.has(href))
      if (fresh.length === 0) break

      for (const href of fresh) {
        seen.add(href)
        const article = await fetchSinglePage(href)
        if (article) articles.push(article)
      }

      pageNum += 1
    }
  }

  return articles
}

async function fetchSinglePage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) return null
  const doc = new JSDOM(await res.text()).window.document

  const slug = url.replace(/\/$/, '').split('/').pop()
  const contentEl = doc.querySelector('.entry-content') || doc.querySelector('article') || doc.body
  const time = doc.querySelector('time[datetime]')
  const firstImg = contentEl.querySelector('img')

  return {
    slug,
    title: stripHtml(doc.querySelector('h1')?.innerHTML || slug),
    date: time?.getAttribute('datetime') || null,
    html: contentEl.innerHTML || '',
    coverUrl: firstImg ? new URL(firstImg.getAttribute('src'), url).href : null,
    coverAlt: firstImg?.getAttribute('alt') || null,
  }
}

// ---------------------------------------------------------------------------
// Content processing: split WP content into { subtitle, coverUrl, bodyHtml }
// ---------------------------------------------------------------------------

/**
 * WordPress articles on this site follow a consistent shape:
 *   <p>dek/subtitle (optional)</p>
 *   <figure class="wp-block-image"><img cover></figure>
 *   ...body...
 * The dek and the cover image are lifted out so they don't render twice, and
 * the remaining HTML becomes the Lexical body.
 */
function processContent(article) {
  const dom = new JSDOM(`<!DOCTYPE html><body><div id="root">${article.html}</div></body>`)
  const doc = dom.window.document
  const root = doc.getElementById('root')

  // Drop empty paragraphs and empty gallery figures (WP leaves placeholders).
  for (const el of root.querySelectorAll('p, figure')) {
    if (el.querySelector('img')) continue
    if (el.textContent.replace(/\u00a0/g, ' ').trim() === '') el.remove()
  }

  // Cover: prefer the REST featured media; else the first inline image
  // (shared resolution — scripts/lib/wpArticles.mjs).
  const coverUrl = resolveCoverSource(article)

  // Subtitle (dek): this site places the dek as a first <p> immediately followed
  // by the cover-image figure. Only treat the first paragraph as the subtitle
  // when that exact shape holds — otherwise the first paragraph is real body.
  let subtitle = null
  const firstBlock = root.firstElementChild
  if (firstBlock && firstBlock.tagName === 'P') {
    const next = firstBlock.nextElementSibling
    const nextIsImage = !!next && (next.tagName === 'IMG' || !!next.querySelector?.('img'))
    const text = firstBlock.textContent.replace(/\s+/g, ' ').trim()
    if (nextIsImage && text && !/^por\s+jorge\s+solla/i.test(text)) {
      subtitle = text
      firstBlock.remove()
    }
  }

  // Strip ALL images (and their figure wrappers): the cover is stored separately
  // on the post, and inline external images can't be resolved to `media` docs, so
  // `convertHTMLToLexical` would emit invalid "pending" upload nodes. Dropping
  // them keeps the body as valid text/heading/list/link/quote content.
  for (const img of root.querySelectorAll('img')) {
    ;(img.closest('figure') || img).remove()
  }
  // Remove any figures/paragraphs left empty by the image removal.
  for (const el of root.querySelectorAll('figure, p')) {
    if (el.querySelector('img')) continue
    if (el.textContent.replace(/\u00a0/g, ' ').trim() === '') el.remove()
  }

  return { subtitle, coverUrl, bodyHtml: root.innerHTML.trim() }
}

// ---------------------------------------------------------------------------
// Media upload (idempotent by filename)
// ---------------------------------------------------------------------------

const EXT_BY_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
}

/** @returns {Promise<{ id: string|number, created: boolean } | null>} */
async function ensureCoverMedia(payload, { slug, coverUrl, alt }) {
  if (!coverUrl) return null

  const res = await fetch(coverUrl, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    console.warn(`[seed:posts]   cover download failed (${res.status}) for ${slug}: ${coverUrl}`)
    return null
  }

  const mimetype = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim()
  const urlExt = new URL(coverUrl).pathname.match(/\.[a-z0-9]+$/i)?.[0]
  const ext = EXT_BY_MIME[mimetype] || urlExt || '.jpg'
  const filename = `${slug}${ext}`

  // Idempotency: reuse an existing media doc with the same (stable) filename
  // if it's already there (e.g. from a previous partial run).
  const existing = await payload.find({
    collection: 'media',
    where: { filename: { equals: filename } },
    limit: 1,
    depth: 0,
  })
  if (existing.docs.length > 0) return { id: existing.docs[0].id, created: false }

  const buffer = Buffer.from(await res.arrayBuffer())

  // The upload goes through the configured media storage plugin: Garage S3
  // when the S3_* envs are set (OPS52), local disk otherwise. The S3 adapter
  // overwrites the deterministic key (`<slug>.<ext>`) natively, so no
  // pre-delete is needed — unlike Vercel Blob, whose `put()` refused
  // overwrites and forced the cleanup dance this script used to do. The
  // DB-side idempotency (lookup by filename above) is unchanged.
  const media = await payload.create({
    collection: 'media',
    data: { alt: alt || slug },
    file: { data: buffer, mimetype, name: filename, size: buffer.length },
  })
  return { id: media.id, created: true }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  assertLocalDatabase(
    'seed:posts',
    'This seed WRITES data (posts/tags/media) and is meant for the local Postgres.\n' +
      '  1. pnpm db:start\n' +
      '  2. set DATABASE_URL=postgresql://teqo:teqo@localhost:5432/teqo in .env.local',
  )

  console.log(
    `\n[seed:posts] Alvo da execução:\n` +
      `  DB     : ${echoTargetHost()}\n` +
      `  Modo   : ${dryRun ? 'dry-run (plan-only — nenhuma escrita)' : 'sync (create-only)'}\n`,
  )

  const payload = await getPayload({ config })
  const editorConfig = await editorConfigFactory.default({ config: payload.config })

  const htmlToLexical = (html) => convertHTMLToLexical({ editorConfig, html: html || '', JSDOM })

  // 1. Ensure taxonomy tags exist (idempotent by slug) -> slug -> id.
  console.log('[seed:posts] Ensuring taxonomy tags...')
  const tagIdBySlug = {}
  let tagsCreated = 0
  let tagsToCreate = 0
  for (const tag of TAXONOMY_TAGS) {
    const found = await payload.find({
      collection: 'tag',
      where: { slug: { equals: tag.slug } },
      limit: 1,
      depth: 0,
    })
    if (found.docs.length > 0) {
      tagIdBySlug[tag.slug] = found.docs[0].id
      continue
    }
    if (dryRun) {
      tagsToCreate += 1
      continue
    }
    const created = await payload.create({
      collection: 'tag',
      data: { name: tag.name, slug: tag.slug, hidden: false },
    })
    tagIdBySlug[tag.slug] = created.id
    tagsCreated += 1
  }
  console.log(
    dryRun
      ? `[seed:posts]   ${tagsToCreate} tag(s) to create, ${TAXONOMY_TAGS.length} total.`
      : `[seed:posts]   ${tagsCreated} tag(s) created, ${TAXONOMY_TAGS.length} total.`,
  )

  // 2. Live fetch (REST API primary, HTML crawl fallback).
  console.log('[seed:posts] Fetching articles from jorgesolla.com.br (WP REST API)...')
  let articles = []
  try {
    articles = await fetchArticlesFromWordPress()
    console.log(`[seed:posts]   REST API returned ${articles.length} article(s).`)
  } catch (err) {
    console.warn(`[seed:posts]   REST API failed (${err.message}). Falling back to HTML crawl...`)
  }
  if (articles.length === 0) {
    articles = await fetchViaHtmlArchive()
    console.log(`[seed:posts]   HTML crawl returned ${articles.length} article(s).`)
  }
  if (articles.length === 0) die('No articles fetched from the live site. Aborting.')

  // 3. Upsert each article.
  let postsCreated = 0
  let postsSkipped = 0
  let postsToCreate = 0
  let mediaCreated = 0
  const unmapped = []

  for (const article of articles) {
    const { slug, title } = article
    const mapping = CLASSIFICATION[slug]
    if (!mapping) unmapped.push(slug)

    const categorySlug = mapping?.category || DEFAULT_CATEGORY
    const tagSlugs = mapping?.tags || []
    const categoryId = tagIdBySlug[categorySlug]
    const tagIds = tagSlugs.map((s) => tagIdBySlug[s]).filter(Boolean)
    const categoryLabel = `[${categorySlug}${tagSlugs.length ? ' | ' + tagSlugs.join(',') : ''}]`

    const existing = await payload.find({
      collection: 'post',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
    })
    if (existing.docs.length > 0) {
      postsSkipped += 1
      continue
    }

    if (dryRun) {
      const cover = resolveCoverSource(article)
      postsToCreate += 1
      console.log(
        `[seed:posts]   would-create ${slug} ${categoryLabel} (cover: ${cover ? 'url' : 'sem-cover'})`,
      )
      continue
    }

    const { subtitle, coverUrl, bodyHtml } = processContent(article)

    const cover = await ensureCoverMedia(payload, {
      slug,
      coverUrl,
      alt: article.coverAlt || title,
    })
    if (cover?.created) mediaCreated += 1

    await payload.create({
      collection: 'post',
      data: {
        title,
        slug,
        type: 'noticia',
        category: categoryId,
        tags: tagIds,
        subtitle: subtitle || undefined,
        coverImage: cover?.id || undefined,
        publishedDate: article.date || undefined,
        body: htmlToLexical(bodyHtml),
        _status: 'published',
      },
    })
    postsCreated += 1
    console.log(`[seed:posts]   + ${slug} ${categoryLabel}`)
  }

  // 4. Report.
  const summaryLines = [
    `Articles fetched : ${articles.length}`,
    ...(dryRun
      ? [
          `Posts to create : ${postsToCreate}`,
          `Posts skipped    : ${postsSkipped} (already existed)`,
          `Tags to create   : ${tagsToCreate}`,
        ]
      : [
          `Posts created    : ${postsCreated}`,
          `Posts skipped    : ${postsSkipped} (already existed)`,
          `Media created    : ${mediaCreated}`,
          `Tags created     : ${tagsCreated} (of ${TAXONOMY_TAGS.length})`,
        ]),
  ]
  console.log('\n[seed:posts] ==================== SUMMARY ====================')
  for (const line of summaryLines) console.log(`[seed:posts] ${line}`)
  if (unmapped.length > 0) {
    console.warn(
      `\n[seed:posts] WARNING: ${unmapped.length} live slug(s) not in the taxonomy map ` +
        `(defaulted to "${DEFAULT_CATEGORY}"):`,
    )
    for (const slug of unmapped) console.warn(`[seed:posts]   - ${slug}`)
  } else {
    console.log('[seed:posts] All fetched slugs were mapped in the taxonomy.')
  }
  console.log('[seed:posts] =================================================\n')

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
