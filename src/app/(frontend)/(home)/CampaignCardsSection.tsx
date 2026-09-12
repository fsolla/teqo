import Link from 'next/link'

import { CardModelGallery } from '@/components/cards/CardModelGallery'

/**
 * S13 — the home invitation to the card funnel: short copy + the three model
 * tiles, positioned after the newsletter capture (which stays the first
 * conversion of the page end) and before the footer. Each tile deep-links into
 * `/cards` with its model selected; the general CTA opens the plain catalog.
 */
export const CampaignCardsSection = () => (
  <section
    id="cards"
    aria-labelledby="cards-title"
    data-home-section="cards"
    className="border-b border-(--campaign-line) bg-(--campaign-cream)"
  >
    <div className="mx-auto w-full max-w-[1160px] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="campaign-section-eyebrow m-0 font-black tracking-[0.1em] text-(--pt-red) uppercase">
          Faça parte
        </p>
        <h2
          id="cards-title"
          className="campaign-section-title m-0 mt-1 border-0 p-0 font-black tracking-[-0.02em] text-balance"
        >
          Mostre que você está com Solla
        </h2>
        <p className="campaign-section-copy m-0 mt-1 text-(--campaign-muted)">
          Escolha um modelo, coloque seu nome ou sua foto e baixe seu card. Compartilhe com sua
          gente e fortaleça nossa caminhada.
        </p>
      </div>

      <CardModelGallery variant="link" ariaLabel="Modelos de card" />

      <div className="mt-8 text-center">
        <Link
          href="/cards"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-(--pt-red) px-6 text-sm font-extrabold text-white transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:outline-none sm:w-auto"
        >
          Criar meu card
        </Link>
      </div>
    </div>
  </section>
)
