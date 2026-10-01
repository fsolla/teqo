import config from '@payload-config'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { ConsentText } from '@/components/campaign/shared/ConsentText'
import { ARCHIVE_PHOTO_FOCUS } from '@/components/fotos/archivePhotoClasses'
import { ArchivePhotoPageHeader } from '@/components/fotos/ArchivePhotoPageHeader'
import { SelfieSearchClosed } from '@/components/fotos/SelfieSearchClosed'
import { SelfieSearchFlow } from '@/components/fotos/SelfieSearchFlow'
import { isArchivePhotoRemovalChannelUrl } from '@/lib/archivePhotoCatalog'
import {
  ARCHIVE_PHOTO_ALBUM_ENTRY_PATH,
  ARCHIVE_PHOTO_ALBUM_PATH,
} from '@/lib/archivePhotoPublicCatalog'
import { FACE_INDEX_CONSENT_KEY, FACE_SEARCH_CONSENT_KEY } from '@/lib/campaignConsentKeys'
import { getConsentByKey } from '@/utilities/campaignConsent'
import { hasPublishedContentPieces } from '@/utilities/content/contentPieceReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { absoluteSitePath, resolveSiteMetadata } from '@/utilities/seo'

export const dynamic = 'force-dynamic'

const ENTRY_TITLE = 'Encontre você nas fotos — Jorge Solla 1313'
const ENTRY_DESCRIPTION =
  'Busque por uma selfie sua as fotos públicas aprovadas em que você aparece. A imagem não sai do seu dispositivo.'

const getCachedPhotoAlbum = getCachedGlobal('photoAlbum')

/**
 * C234 — the selfie search page (`/fotos/encontre`), a surface of the album:
 * the same album kill switch (`photoAlbum.published`) and the feature flag
 * (`selfieSearchEnabled`, default off) gate the route with the album's 404; the
 * query Consent resolved by stable key is the legal gate — without it the page
 * still exists but renders only the fail-closed state, and the API refuses
 * independently. Noindex on purpose: the canonical surface is the album.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [album, globalMetadata] = await Promise.all([
    getCachedPhotoAlbum(),
    getCachedGlobal('metadata')(),
  ])
  if (album.published === false || album.selfieSearchEnabled !== true) notFound()

  const { siteUrl, siteName, twitterCreator } = resolveSiteMetadata(globalMetadata)
  const canonicalUrl = absoluteSitePath(siteUrl, ARCHIVE_PHOTO_ALBUM_ENTRY_PATH)
  const title = `${ENTRY_TITLE} | ${siteName}`

  return {
    title,
    description: ENTRY_DESCRIPTION,
    robots: { index: false, follow: false },
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      siteName,
      title,
      description: ENTRY_DESCRIPTION,
      images: [],
    },
    twitter: {
      card: 'summary',
      title,
      description: ENTRY_DESCRIPTION,
      creator: twitterCreator,
      images: [],
    },
  }
}

export default async function FotosEncontrePage() {
  const [album, showConteudos] = await Promise.all([
    getCachedPhotoAlbum(),
    hasPublishedContentPieces(),
  ])
  if (album.published === false || album.selfieSearchEnabled !== true) notFound()

  const payload = await getPayload({ config })
  const [consent, indexNotice] = await Promise.all([
    getConsentByKey(payload, FACE_SEARCH_CONSENT_KEY),
    getConsentByKey(payload, FACE_INDEX_CONSENT_KEY),
  ])
  const removalChannelUrl = isArchivePhotoRemovalChannelUrl(album.removalChannelUrl)
    ? album.removalChannelUrl.trim()
    : null

  return (
    <>
      <ArchivePhotoPageHeader showConteudos={showConteudos} />
      <main className="w-full">
        <div className="mx-auto w-full max-w-6xl px-5 pt-5 sm:px-8 sm:pt-7">
          <nav className="text-sm text-(--campaign-muted)">
            <Link
              href={ARCHIVE_PHOTO_ALBUM_PATH}
              className={`inline-flex min-h-11 items-center font-bold text-[#184e92] underline underline-offset-4 hover:text-[#143c70] ${ARCHIVE_PHOTO_FOCUS}`}
            >
              ← Voltar ao álbum
            </Link>
          </nav>
        </div>
        {consent && indexNotice ? (
          <SelfieSearchFlow
            consentText={<ConsentText data={consent.text} />}
            noticeText={<ConsentText data={indexNotice.text} />}
            removalChannelUrl={removalChannelUrl}
          />
        ) : (
          <div className="px-5 py-8 sm:px-8 sm:py-10">
            <SelfieSearchClosed />
          </div>
        )}
      </main>
    </>
  )
}
