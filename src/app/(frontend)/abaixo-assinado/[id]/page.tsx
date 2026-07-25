import { getSignatureCount } from '@/app/(frontend)/actions/getSignatureCount'
import { MetaPixel } from '@/components/MetaPixel'
import { PetitionForm } from '@/components/PetitionForm'
import { SignatureCounter } from '@/components/SignatureCounter'
import { normalizeFacebookPixelId } from '@/lib/facebookPixel'
import type { Media } from '@/payload-types'
import { getCachedDocumentById, getPetitionIds } from '@/utilities/documentReads'
import { extractFirstImageFromLexical } from '@/utilities/extractFirstImageFromLexical'
import { getCachedGlobal } from '@/utilities/globalReads'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Article, WithContext } from 'schema-dts'

const MAX_DESCRIPTION_LENGTH = 200

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, '')

const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`

const toAbsoluteUrl = (url: string, siteUrl: string) =>
  /^https?:\/\//i.test(url)
    ? url
    : `${stripTrailingSlash(siteUrl)}${url.startsWith('/') ? '' : '/'}${url}`

export async function generateStaticParams() {
  // Build-time enumeration only needs the ids — skip relationship population.
  const ids = await getPetitionIds()

  return ids.map((id) => ({ id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const petition = await getCachedDocumentById('petition', id)()

  if (!petition || !petition.enabled) {
    return {}
  }

  const globalMetadata = await getCachedGlobal('metadata')()
  const siteUrl = stripTrailingSlash(globalMetadata.URL)
  const canonicalUrl = `${siteUrl}/abaixo-assinado/${petition.id}`

  const bodyImage = extractFirstImageFromLexical(petition.body)
  let fallbackImage: Media | null = null
  if (!bodyImage && globalMetadata.image) {
    fallbackImage =
      typeof globalMetadata.image === 'number'
        ? await getCachedDocumentById('media', String(globalMetadata.image))()
        : globalMetadata.image
  }
  const image = bodyImage ?? fallbackImage

  const description = truncate(petition.subtitle, MAX_DESCRIPTION_LENGTH)
  const title = `${petition.title} | ${globalMetadata.openGraph.siteName}`

  const keywords = [
    ...globalMetadata.keywords
      .map((k) => (typeof k === 'string' ? k : k.keyword))
      .filter((k): k is string => typeof k === 'string'),
    'abaixo-assinado',
    'petição',
    petition.title,
  ]

  const imageUrl = image?.url ? toAbsoluteUrl(image.url, siteUrl) : undefined

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
      publishedTime: petition.createdAt,
      modifiedTime: petition.updatedAt,
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

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const petition = await getCachedDocumentById('petition', id)()

  if (!petition || !petition.enabled) {
    return notFound()
  }

  const globalMetadata = await getCachedGlobal('metadata')()
  const siteUrl = stripTrailingSlash(globalMetadata.URL)
  const canonicalUrl = `${siteUrl}/abaixo-assinado/${petition.id}`

  const bodyImage = extractFirstImageFromLexical(petition.body)
  let fallbackImage: Media | null = null
  if (!bodyImage && globalMetadata.image) {
    fallbackImage =
      typeof globalMetadata.image === 'number'
        ? await getCachedDocumentById('media', String(globalMetadata.image))()
        : globalMetadata.image
  }
  const ogImage = bodyImage ?? fallbackImage
  const ogImageUrl = ogImage?.url ? toAbsoluteUrl(ogImage.url, siteUrl) : undefined

  const jsonLd: WithContext<Article> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: petition.title,
    description: truncate(petition.subtitle, MAX_DESCRIPTION_LENGTH),
    inLanguage: 'pt-BR',
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    datePublished: petition.createdAt,
    dateModified: petition.updatedAt,
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

  const consentHTML =
    typeof petition.form.consent !== 'number'
      ? convertLexicalToHTML({ data: petition.form.consent.text })
      : ''

  const signatureCount = await getSignatureCount(petition.id)
  const facebookPixelId = normalizeFacebookPixelId(petition.tracking?.facebookPixelId)

  return (
    <main
      data-theme="petition"
      className="h-screen w-screen overflow-y-auto bg-background text-foreground"
    >
      {facebookPixelId ? <MetaPixel pixelId={facebookPixelId} /> : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="relative overflow-hidden border-b border-border bg-[var(--petition-hero)] text-[var(--petition-hero-foreground)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--petition-hero-glow),transparent_40%),radial-gradient(circle_at_bottom_left,var(--petition-hero-depth),transparent_46%)]" />
        <div className="relative mx-auto flex min-h-[72vh] w-full max-w-5xl items-center justify-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center space-y-6 text-center">
            <span className="inline-flex w-fit rounded-full border border-white/20 bg-[var(--petition-hero-chip)] px-3 py-1 text-xs font-medium uppercase tracking-wider text-[var(--petition-hero-chip-foreground)]">
              Abaixo-assinado
            </span>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {petition.title}
            </h1>
            <h2 className="max-w-2xl border-none text-lg leading-relaxed text-[var(--petition-hero-muted)] sm:text-xl">
              {petition.subtitle}
            </h2>
            <SignatureCounter
              petitionId={petition.id}
              initialCount={signatureCount}
              variant="hero"
            />
            <div className="flex flex-wrap justify-center gap-3 border-t border-white/15 pt-6">
              <Link
                href="#formulario"
                className="inline-flex items-center justify-center rounded-md bg-[var(--petition-hero-cta)] px-5 py-2.5 text-sm font-semibold text-[var(--petition-hero-cta-foreground)] transition-colors hover:bg-[color-mix(in_oklab,var(--petition-hero-cta)_90%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Assinar agora
              </Link>
              <Link
                href="#detalhes"
                className="inline-flex items-center justify-center rounded-md border border-white/30 bg-transparent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              >
                Ler detalhes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section
        id="detalhes"
        className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16"
      >
        <article
          className="space-y-6 text-lg leading-8 text-foreground/90 [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline [&_blockquote]:border-l [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:border-none [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-primary [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-lg [&_strong]:font-semibold [&_strong]:text-foreground"
          dangerouslySetInnerHTML={{ __html: convertLexicalToHTML({ data: petition.body }) }}
        />
      </section>

      <section className="border-t border-border bg-[var(--petition-form-section)]">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8 lg:py-16">
          <div className="space-y-4 self-start">
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Participe da mobilização
            </span>
            <h2 className="border-none text-left text-3xl font-bold leading-tight text-foreground sm:text-4xl">
              Sua assinatura fortalece a luta dos trabalhadores.
            </h2>
            <p className="text-base leading-7 text-muted-foreground">
              Preencha o formulário para somar apoio público à proposta. Os dados serão usados
              apenas para registrar sua participação nesta campanha, e comunicação de conteúdos
              relacionados.
            </p>
            <SignatureCounter
              petitionId={petition.id}
              initialCount={signatureCount}
              variant="card"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-[0_24px_60px_rgb(122_25_18/0.12)] sm:p-7">
            <PetitionForm
              id="formulario"
              petition={petition}
              consentHTML={consentHTML}
              facebookPixelId={facebookPixelId ?? undefined}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
