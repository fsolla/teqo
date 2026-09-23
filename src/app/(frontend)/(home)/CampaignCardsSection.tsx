import { brexterBold } from '@/app/(frontend)/fonts'
import { CardsStudio } from '@/components/cards/CardsStudio'

/**
 * S14/S30 — the home invitation to the card funnel: short copy + the five model
 * tiles, positioned right before the newsletter capture (which stays the last
 * conversion block). Tapping a tile opens the SAME composer island used by
 * `/cards` right here (dialog on desktop, drawer on mobile) — no navigation and
 * no separate CTA. `brexterBold.variable` includes the display face in the page
 * so the name-tile canvas (family passed as a prop) can load it.
 */
export const CampaignCardsSection = () => (
  <section
    id="cards"
    aria-labelledby="cards-title"
    data-home-section="cards"
    className={`border-b border-(--campaign-line) bg-(--campaign-cream) ${brexterBold.variable}`}
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

      <CardsStudio fontFamily={brexterBold.style.fontFamily} />
    </div>
  </section>
)
