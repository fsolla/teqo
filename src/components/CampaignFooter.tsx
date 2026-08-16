import Link from 'next/link'

const APOIAR_URL = 'https://apoiar.me/jorgesolla'

const REDES = [
  { label: 'Instagram', href: 'https://instagram.com/depjorgesolla' },
  { label: 'YouTube', href: 'https://youtube.com/@JorgeSollaDep' },
  { label: 'Facebook', href: 'https://facebook.com/depjorgesolla' },
]

/** Rodapé eleitoral da campanha: identificação, navegação e redes oficiais. */
export const CampaignFooter = () => (
  <footer className="bg-[#180a09] text-[rgb(255_248_242/75%)]">
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 text-sm sm:px-6 md:grid-cols-[2fr_1fr_1fr] lg:px-8">
      <div>
        <h4 className="mb-2 font-[family-name:var(--font-exo2)] text-base font-extrabold text-white">
          Jorge Solla 1313
        </h4>
        <p className="m-0 text-[rgb(255_248_242/75%)]">
          Deputado Federal · PT · Bahia
          <br />
          Um mandato do tamanho da Bahia.
        </p>
      </div>
      <div>
        <h4 className="mb-2 font-[family-name:var(--font-exo2)] text-sm font-bold text-white">
          Navegue
        </h4>
        <ul className="m-0 grid list-none gap-1.5 p-0">
          <li>
            <a
              href="#bandeiras"
              className="text-[rgb(255_248_242/75%)] no-underline hover:text-white"
            >
              Bandeiras
            </a>
          </li>
          <li>
            <a
              href={APOIAR_URL}
              target="_blank"
              rel="noopener"
              className="text-[rgb(255_248_242/75%)] no-underline hover:text-white"
            >
              Quero apoiar
            </a>
          </li>
          <li>
            <Link
              href="/privacidade"
              className="text-[rgb(255_248_242/75%)] no-underline hover:text-white"
            >
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
              <a
                href={rede.href}
                target="_blank"
                rel="noopener"
                className="text-[rgb(255_248_242/75%)] no-underline hover:text-white"
              >
                {rede.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
    <div className="border-t border-white/10">
      <p className="mx-auto my-0 w-full max-w-6xl px-4 py-5 text-xs leading-relaxed text-[rgb(255_248_242/65%)] sm:px-6 lg:px-8">
        Jorge José Santos Pereira Solla · Candidato a Deputado Federal · Nº 1313 · Federação Brasil
        da Esperança (PT/PCdoB/PV) · CNPJ: 68.430.467/0001-05 · Propaganda eleitoral gratuita. Site
        de campanha — conteúdo sob responsabilidade do candidato. Eleições 2026 · 1º turno:
        04/10/2026.
      </p>
    </div>
  </footer>
)
