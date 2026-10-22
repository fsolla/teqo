import Link from 'next/link'

import { CampaignLogoLink } from '@/components/CampaignLogoLink'
import { PUBLIC_FOCUS, PUBLIC_PATHS, PUBLIC_SOCIAL_LINK_LIST } from '@/lib/publicSite'
import { cn } from '@/lib/utils'

type CampaignFooterProps = {
  current?: 'artigos' | 'fotos'
}

const FOOTER_LINK = cn(
  // C233 — every footer link is a 44px-tall target on mobile.
  'inline-flex min-h-11 items-center rounded-sm text-[rgb(255_248_242/75%)] no-underline hover:text-white',
  PUBLIC_FOCUS,
)

const NAV_ITEMS = [
  { label: 'Artigos', href: PUBLIC_PATHS.artigos, key: 'artigos' },
  { label: 'Fotos', href: PUBLIC_PATHS.fotos, key: 'fotos' },
  { label: 'Privacidade', href: PUBLIC_PATHS.privacidade },
] as const

/**
 * S47 — the institutional footer (design scene 03): the name lockup, the
 * mandate identity and the two link columns. The electoral block is gone —
 * no "Quero apoiar", campaign number, CNPJ or turn date — and "Fotos" is a
 * permanent destination (the album has an honest empty state of its own).
 * `current` marks the active section for assistive tech and the highlight.
 */
export const CampaignFooter = ({ current }: CampaignFooterProps = {}) => (
  <footer className="bg-[#180a09] text-[#fff8f2]">
    <div className="mx-auto grid w-full max-w-[1152px] gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.7fr_.8fr_.8fr] md:gap-12 lg:py-14">
      <div>
        <CampaignLogoLink tone="negative" priority={false} className={PUBLIC_FOCUS} />
        <p className="mt-5 text-sm leading-6 text-white/68">
          Deputado Federal · PT · Bahia
          <br />
          <strong className="font-semibold text-white">Mais Saúde, Mais Futuro.</strong>
        </p>
      </div>

      <div>
        <h2 className="border-0 p-0 font-[family-name:var(--font-exo2)] text-sm font-extrabold">
          Navegue
        </h2>
        <ul className="mt-4 ml-0 grid list-none gap-1 p-0 text-sm text-white/70">
          {NAV_ITEMS.map((item) => {
            const isCurrent = 'key' in item && item.key === current
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={cn(FOOTER_LINK, isCurrent && 'font-bold text-white')}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      <div>
        <h2 className="border-0 p-0 font-[family-name:var(--font-exo2)] text-sm font-extrabold">
          Redes
        </h2>
        <ul className="mt-4 ml-0 grid list-none gap-1 p-0 text-sm text-white/70">
          {PUBLIC_SOCIAL_LINK_LIST.map((social) => (
            <li key={social.label}>
              <a href={social.href} target="_blank" rel="noopener" className={FOOTER_LINK}>
                {social.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>

    <div className="border-t border-white/10">
      <p className="mx-auto my-0 w-full max-w-[1152px] px-5 py-5 text-xs leading-5 text-white/55 sm:px-8">
        Jorge José Santos Pereira Solla · Deputado Federal · Partido dos Trabalhadores · Bahia
      </p>
    </div>
  </footer>
)
