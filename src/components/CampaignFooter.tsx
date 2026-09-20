import Link from 'next/link'

import { cn } from '@/lib/utils'

const APOIAR_URL = 'https://apoiar.me/jorgesolla'

const FOOTER_LINK = cn(
  'text-[rgb(255_248_242/75%)] no-underline hover:text-white',
  'focus-visible:rounded-[2px] focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-(--pt-yellow)',
)

const REDES = [
  { label: 'Instagram', href: 'https://instagram.com/depjorgesolla' },
  { label: 'YouTube', href: 'https://youtube.com/@JorgeSollaDep' },
  { label: 'Facebook', href: 'https://facebook.com/depjorgesolla' },
]

/**
 * Rodapé eleitoral da campanha: identificação, navegação e redes oficiais.
 * S21 — the "Jingles" discovery link only appears while something is published;
 * the caller resolves the cached flag (`hasPublishedJingles`, or the page's own
 * list) and passes it, so this stays a synchronous presentational leaf.
 * `current` marks the page as the current one for assistive tech and the
 * artefato's highlight.
 */
export const CampaignFooter = ({
  showJingles = false,
  current,
}: {
  showJingles?: boolean
  current?: 'jingles'
} = {}) => {
  const jinglesLinkClass = cn(FOOTER_LINK, current === 'jingles' && 'font-bold text-white')

  return (
    <footer className="bg-[#180a09] text-[rgb(255_248_242/75%)]">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 text-sm sm:px-6 md:grid-cols-[2fr_1fr_1fr] lg:px-8">
        <div>
          <h4 className="mb-2 font-[family-name:var(--font-exo2)] text-base font-extrabold text-white">
            Jorge Solla 1313
          </h4>
          <p className="m-0 text-[rgb(255_248_242/75%)]">
            Deputado Federal · PT · Bahia
            <br />
            Mais saúde mais futuro.
          </p>
        </div>
        <div>
          <h4 className="mb-2 font-[family-name:var(--font-exo2)] text-sm font-bold text-white">
            Navegue
          </h4>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            <li>
              <a href="#bandeiras" className={FOOTER_LINK}>
                Bandeiras
              </a>
            </li>
            {showJingles ? (
              <li>
                <Link
                  href="/jingles"
                  aria-current={current === 'jingles' ? 'page' : undefined}
                  className={jinglesLinkClass}
                >
                  Jingles
                </Link>
              </li>
            ) : null}
            <li>
              <a href={APOIAR_URL} target="_blank" rel="noopener" className={FOOTER_LINK}>
                Quero apoiar
              </a>
            </li>
            <li>
              <Link href="/privacidade" className={FOOTER_LINK}>
                Privacidade
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-2 font-[family-name:var(--font-exo2)] text-sm font-bold text-white">
            Redes
          </h4>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {REDES.map((rede) => (
              <li key={rede.label}>
                <a href={rede.href} target="_blank" rel="noopener" className={FOOTER_LINK}>
                  {rede.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto my-0 w-full max-w-6xl px-4 py-5 text-xs leading-relaxed text-[rgb(255_248_242/65%)] sm:px-6 lg:px-8">
          Jorge José Santos Pereira Solla · Candidato a Deputado Federal · Nº 1313 · Federação
          Brasil da Esperança (PT/PCdoB/PV) · CNPJ: 68.430.467/0001-05 · Propaganda eleitoral
          gratuita. Site de campanha — conteúdo sob responsabilidade do candidato. Eleições 2026 ·
          1º turno: 04/10/2026.
        </p>
      </div>
    </footer>
  )
}
