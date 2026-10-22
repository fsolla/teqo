import Image from 'next/image'
import Link from 'next/link'

import { PUBLIC_FOCUS, PUBLIC_PATHS } from '@/lib/publicSite'

/**
 * S47 — the post-election hero (design scene 01/02): "Obrigado, Bahia" over the
 * TSE literal 152.049. The number is the only data on the fold — no ranking,
 * percentage or counter — and the single primary CTA hands the visitor to the
 * mandate (`/artigos`). The campaign request ("Quero apoiar", the number, the
 * running-mate portraits) is intentionally gone from this surface.
 */
const THANK_YOU_VOTE_TOTAL = '152.049'

const ArrowIcon = () => (
  <svg
    aria-hidden="true"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="m13 6 6 6-6 6" />
  </svg>
)

export const CampaignHero = () => (
  <section
    aria-labelledby="campaign-title"
    data-home-section="hero"
    className="campaign-hero-field relative isolate overflow-hidden text-white"
  >
    <div
      aria-hidden="true"
      className="campaign-noise pointer-events-none absolute inset-0 opacity-[0.055]"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -right-32 bottom-[-120px] size-[390px] rounded-full border-[56px] border-(--pt-yellow) lg:-right-20 lg:-bottom-40 lg:size-[520px] lg:border-[74px] lg:opacity-90"
    />
    <span
      aria-hidden="true"
      className="pointer-events-none absolute right-[430px] bottom-0 hidden h-px w-56 bg-white/25 lg:block"
    />

    <div className="relative mx-auto grid min-h-[760px] w-full max-w-[1152px] grid-cols-1 px-5 pt-10 pb-16 lg:min-h-[668px] lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pt-0 lg:pb-0">
      <div className="relative z-10 flex flex-col justify-start pt-0 lg:justify-center lg:pt-2 lg:pb-16">
        <p className="m-0 font-[family-name:var(--font-exo2)] text-[13px] font-extrabold tracking-[0.13em] text-(--pt-yellow) uppercase lg:text-[15px] lg:tracking-[0.14em]">
          Obrigado, Bahia
        </p>

        <h1
          id="campaign-title"
          aria-label="152.049 votos de confiança"
          className="mt-4 max-w-[690px] border-0 p-0 text-left font-[family-name:var(--font-exo2)] text-[55px] leading-[0.92] font-black tracking-[-0.06em] text-balance lg:mt-5 lg:text-[76px] lg:leading-[0.91]"
        >
          <span className="block tabular-nums">{THANK_YOU_VOTE_TOTAL}</span>
          <span className="mt-1 block text-[36px] leading-[1.02] tracking-[-0.045em] lg:text-[57px] lg:leading-[1.03]">
            votos de confiança
          </span>
        </h1>

        <p className="mt-5 max-w-[590px] text-[17px] leading-[1.45] text-white/87 lg:mt-7 lg:text-[19px] lg:leading-[1.5]">
          Obrigado a quem votou, a quem caminhou, a quem compartilhou e a quem acreditou. A eleição
          terminou; o trabalho continua.
        </p>

        <div className="mt-6 lg:mt-8">
          <Link
            href={PUBLIC_PATHS.artigos}
            className={`inline-flex min-h-[50px] items-center gap-3 rounded-[10px] bg-(--pt-yellow) px-5 font-[family-name:var(--font-exo2)] text-[15px] font-extrabold text-[#261f00] no-underline transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#fff02e] active:translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0 lg:min-h-12 ${PUBLIC_FOCUS}`}
          >
            Acompanhe o mandato
            <ArrowIcon />
          </Link>
        </div>

        <p className="mt-9 hidden text-sm font-semibold text-white/65 lg:block">
          Jorge Solla · Deputado Federal · PT · Bahia
        </p>
      </div>

      <div className="relative z-0 min-h-[360px] lg:min-h-0 lg:self-stretch">
        <div className="pointer-events-none absolute right-[-18px] bottom-[-38px] h-[370px] w-[278px] lg:pointer-events-auto lg:right-0 lg:bottom-0 lg:h-[620px] lg:w-[505px] lg:overflow-hidden">
          <Image
            src="/JOA00162.webp"
            alt="Jorge Solla sorrindo, com blazer azul e camisa do PT"
            width={495}
            height={742}
            sizes="(min-width: 1024px) 505px, 278px"
            priority
            className="absolute right-0 bottom-0 h-[370px] w-auto max-w-none object-contain lg:right-[-32px] lg:bottom-[-35px] lg:h-[650px]"
          />
        </div>
      </div>

      <p className="absolute bottom-5 left-5 z-10 text-[11px] font-semibold text-white/68 [text-shadow:0_1px_3px_rgb(0_0_0/55%)] lg:hidden">
        Deputado Federal · PT · Bahia
      </p>
    </div>
  </section>
)
