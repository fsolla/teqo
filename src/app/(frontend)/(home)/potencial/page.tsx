import type { Metadata } from 'next'
import Link from 'next/link'

import { campaignTextFont } from '@/app/(frontend)/fonts'
import { CampaignFooter } from '@/components/CampaignFooter'
import { CampaignPageHeader } from '@/components/CampaignPageHeader'
import { SectionPotentialStudio } from '@/components/potencial/SectionPotentialStudio'
import {
  POTENTIAL_HEADLINE,
  POTENTIAL_INTRO,
  POTENTIAL_PATH,
} from '@/components/potencial/sectionPotentialCopy'
import { hasPublishedArchivePhotos } from '@/utilities/archivePhotos/archivePhotoReads'
import { hasPublishedContentPieces } from '@/utilities/content/contentPieceReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { hasPublishedJingles } from '@/utilities/jingleReads'
import { resolveOgImage } from '@/utilities/ogImageReads'
import { absoluteSitePath, resolveSiteMetadata } from '@/utilities/seo'

/**
 * S46 — a página pública do "potencial da sua seção": informa UF, município,
 * zona e seção do título e sai com o story 1080×1920. Sem login, sem cadastro
 * e sem coleta de contato; os números vêm do artefato TSE commitado, servido
 * pelas rotas `/api/potencial/*`. Indexável com título e descrição próprios.
 */
export async function generateMetadata(): Promise<Metadata> {
  const globalMetadata = await getCachedGlobal('metadata')()
  const { siteUrl, siteName, twitterCreator } = resolveSiteMetadata(globalMetadata)
  const canonicalUrl = absoluteSitePath(siteUrl, POTENTIAL_PATH)
  const { url: imageUrl } = await resolveOgImage(null)

  const title = `${POTENTIAL_HEADLINE} | ${siteName}`
  const images = imageUrl ? [{ url: imageUrl, alt: POTENTIAL_HEADLINE }] : []

  return {
    title,
    description: POTENTIAL_INTRO,
    ...(canonicalUrl ? { alternates: { canonical: canonicalUrl } } : {}),
    openGraph: {
      type: 'website',
      locale: 'pt-BR',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      siteName,
      title,
      description: POTENTIAL_INTRO,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: POTENTIAL_INTRO,
      creator: twitterCreator,
      images: images.map((image) => image.url),
    },
  }
}

export default async function PotencialPage() {
  const [showJingles, showConteudos, showFotos] = await Promise.all([
    hasPublishedJingles(),
    hasPublishedContentPieces(),
    hasPublishedArchivePhotos(),
  ])

  return (
    <>
      <CampaignPageHeader />
      <div className="border-b border-(--campaign-line) bg-white">
        <div className="mx-auto w-full max-w-6xl px-5 py-2.5 text-sm text-(--campaign-muted) sm:px-8">
          <Link
            href="/"
            className="rounded-sm font-bold text-(--pt-red) no-underline underline-offset-4 hover:underline"
          >
            Início
          </Link>
          <span className="px-1 text-[#c9c2bd]">/</span> Potencial da sua seção
        </div>
      </div>
      <main className="w-full bg-white text-black">
        <SectionPotentialStudio fontFamily={campaignTextFont.style.fontFamily} />
      </main>
      <CampaignFooter
        showJingles={showJingles}
        showConteudos={showConteudos}
        showFotos={showFotos}
      />
    </>
  )
}
