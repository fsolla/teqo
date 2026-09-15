import { SiteHeader } from '@/components/SiteHeader'
import { SpeechCutShareActions } from '@/components/SpeechCutShareActions'
import { formatSpeechDate, formatSpeechSpan } from '@/lib/speechClock'
import { speechCutPublicPath } from '@/lib/speechCut'
import { parseYoutubeVideoId } from '@/lib/speechVod'
import type { Media, Speech, SpeechCut } from '@/payload-types'
import { getCachedDocumentById } from '@/utilities/documentReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { absoluteSitePath, resolveSiteMetadata, toAbsoluteUrl, truncate } from '@/utilities/seo'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

const MAX_DESCRIPTION_LENGTH = 200
const CREDIT = 'Fonte: Câmara dos Deputados · CC BY 4.0'

/**
 * `findByID` answers 404 for an unknown id; on the production (bundled) server
 * that error can cross a module boundary where `instanceof APIError` is false,
 * so the status is the contract — an unknown id is "not found" (renders 404),
 * anything else keeps failing loudly.
 */
const isNotFoundError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 404

const parseCutId = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const mediaOf = (cut: SpeechCut): Media | null =>
  typeof cut.media === 'object' && cut.media !== null ? cut.media : null

const speechOf = (cut: SpeechCut): Speech | null =>
  typeof cut.speech === 'object' && cut.speech !== null ? cut.speech : null

const youtubeCoverUrl = (cut: SpeechCut): string | null => {
  const speech = speechOf(cut)
  const videoId = parseYoutubeVideoId(speech?.youtubeUrl)
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null
}

const loadPublishedCut = async (id: string): Promise<SpeechCut | null> => {
  const cutId = parseCutId(id)
  if (cutId === null) return null

  try {
    const cut = await getCachedDocumentById('speechCut', cutId, 1)()
    if (!cut || cut.status !== 'published' || !mediaOf(cut)?.url) return null
    return cut
  } catch (error) {
    // Both an unknown id (404) and an unpublished cut resolve to the same
    // not-found screen (never reveal whether it existed). A real read failure
    // keeps failing loudly.
    if (isNotFoundError(error)) return null
    throw error
  }
}

/**
 * C167 — the unlisted public page of a cut: the stored MP4 (never the
 * YouTube/VOD source), the AI/human title and description, the credit and the
 * share kit. `noindex` on purpose: the link circulates, the page is not listed.
 * An unpublished or unknown id resolves to the same not-found screen, so the
 * kill switch does not reveal whether the cut existed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const cut = await loadPublishedCut(id)
  if (!cut) {
    return { title: 'Este corte não está disponível', robots: { index: false, follow: false } }
  }

  const globalMetadata = await getCachedGlobal('metadata')()
  const { siteUrl, siteName, twitterCreator } = resolveSiteMetadata(globalMetadata)
  const canonicalUrl = absoluteSitePath(siteUrl, speechCutPublicPath(cut.id))
  const youtubeCover = youtubeCoverUrl(cut)

  let fallbackImage: Media | null = null
  if (!youtubeCover && globalMetadata.image) {
    fallbackImage =
      typeof globalMetadata.image === 'number'
        ? await getCachedDocumentById('media', String(globalMetadata.image))()
        : globalMetadata.image
  }
  const imageUrl =
    youtubeCover ??
    (fallbackImage?.url && siteUrl ? toAbsoluteUrl(fallbackImage.url, siteUrl) : undefined)
  const title = `${cut.title} | ${siteName}`
  const description = truncate(cut.description, MAX_DESCRIPTION_LENGTH)
  const images = imageUrl ? [{ url: imageUrl, alt: cut.title }] : []

  return {
    title,
    description,
    robots: { index: false, follow: false },
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      type: 'video.other',
      locale: 'pt-BR',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      siteName,
      title,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      creator: twitterCreator,
      images: images.map((image) => image.url),
    },
  }
}

export default async function SpeechCutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cut = await loadPublishedCut(id)
  if (!cut) notFound()

  const media = mediaOf(cut)
  const speech = speechOf(cut)
  const videoUrl = media?.url ?? null
  const poster = youtubeCoverUrl(cut)
  const globalMetadata = await getCachedGlobal('metadata')()
  const { siteUrl } = resolveSiteMetadata(globalMetadata)
  const publicUrl =
    absoluteSitePath(siteUrl, speechCutPublicPath(cut.id)) ?? speechCutPublicPath(cut.id)
  const durationLabel = formatSpeechSpan(
    cut.durationSeconds ?? Math.max(0, cut.endSeconds - cut.startSeconds),
  )

  return (
    <>
      <SiteHeader />
      <main className="w-full">
        <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {videoUrl ? (
            <video
              controls
              preload="metadata"
              playsInline
              poster={poster ?? undefined}
              src={videoUrl}
              className="aspect-video w-full rounded-xl border bg-black"
            />
          ) : null}

          <h1 className="mt-6 text-2xl font-bold leading-tight tracking-tight text-balance sm:text-3xl">
            {cut.title}
          </h1>

          <p className="mt-2 text-sm text-muted-foreground">
            {speech?.type ?? 'Fala'}
            {speech ? <> · {formatSpeechDate(speech.speechAt)}</> : null} · {durationLabel}
            {speech?.youtubeUrl ? (
              <>
                {' · '}
                <a
                  href={speech.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  Ver sessão no YouTube ↗
                </a>
              </>
            ) : null}
          </p>

          <p className="mt-5 text-base leading-relaxed text-foreground/90">{cut.description}</p>

          <SpeechCutShareActions
            className="mt-7"
            url={publicUrl}
            title={cut.title}
            downloadUrl={videoUrl}
            downloadFilename={media?.filename}
            primary="whatsapp"
          />

          <div className="mt-10 border-t pt-4">
            <p className="text-xs text-muted-foreground">{CREDIT}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Página não listada — o link circula, mas não é indexada nem aparece em buscas.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
