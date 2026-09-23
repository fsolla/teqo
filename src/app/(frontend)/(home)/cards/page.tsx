import type { Metadata } from 'next'
import Link from 'next/link'

import { brexterBold } from '@/app/(frontend)/fonts'
import { CampaignFooter } from '@/components/CampaignFooter'
import { CARD_PRIVACY_NOTE } from '@/components/cards/cardCopy'
import { CardsStudio } from '@/components/cards/CardsStudio'
import { isCardModelId } from '@/lib/cardModels'
import { hasPublishedJingles } from '@/utilities/jingleReads'

const intro =
  'Escolha um dos cinco modelos, personalize com seu nome ou sua foto e baixe para compartilhar.'

export const metadata: Metadata = {
  title: 'Crie seu card de apoio | Jorge Solla',
  description: intro,
}

type CardsPageProps = {
  searchParams: Promise<{ model?: string | string[] }>
}

export default async function CardsPage({ searchParams }: CardsPageProps) {
  const params = await searchParams
  const rawModel = Array.isArray(params.model) ? params.model[0] : params.model
  const initialModelId = isCardModelId(rawModel) ? rawModel : undefined
  const showJingles = await hasPublishedJingles()

  return (
    <>
      <main className={`w-full bg-white text-black ${brexterBold.variable}`}>
        <div className="mx-auto w-full max-w-[1160px] px-5 pt-6 sm:px-8 lg:px-10">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-sm font-bold text-(--pt-red) underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
          >
            ← Voltar para a campanha
          </Link>
        </div>

        <section
          aria-labelledby="cards-page-title"
          className="mx-auto w-full max-w-[1160px] px-5 pt-6 pb-12 sm:px-8 lg:px-10 lg:pt-10 lg:pb-16"
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="campaign-section-eyebrow m-0 font-black tracking-[0.1em] text-(--pt-red) uppercase">
              Faça parte
            </p>
            <h1
              id="cards-page-title"
              className="campaign-section-title m-0 mt-1 border-0 p-0 font-black tracking-[-0.02em] text-balance"
            >
              Crie seu card de apoio
            </h1>
            <p className="campaign-section-copy m-0 mt-1 text-(--campaign-muted)">{intro}</p>
            <p className="mt-2 text-xs text-(--campaign-muted)">{CARD_PRIVACY_NOTE}</p>
          </div>

          <CardsStudio initialModelId={initialModelId} fontFamily={brexterBold.style.fontFamily} />
        </section>
      </main>
      <CampaignFooter showJingles={showJingles} />
    </>
  )
}
