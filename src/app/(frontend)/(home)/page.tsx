import { CampaignCarousel, type CampaignCarouselItem } from '@/components/CampaignCarousel'
import { CampaignContentSection } from '@/components/CampaignContentSection'
import { CampaignFlagCard } from '@/components/CampaignFlagCard'
import { CampaignFooter } from '@/components/CampaignFooter'
import { CampaignHero } from '@/components/CampaignHero'
import { CampaignProblemCard } from '@/components/CampaignProblemCard'
import type { ReactNode } from 'react'
import { CampaignNewsletterSection } from './CampaignNewsletterSection'

/**
 * S6 — desktop sibling of the mobile carousel: the same cards as a static
 * grid (3 columns), visible only from the `lg` breakpoint the carousel
 * geometry used to interpolate at. Kept here with the sections it serves.
 */
const CampaignCardGrid = ({
  gridKey,
  ariaLabel,
  gapClassName,
  children,
}: {
  gridKey: 'problem' | 'flags'
  ariaLabel: string
  gapClassName: string
  children: ReactNode
}) => (
  <div className="hidden px-(--campaign-content-inset) lg:block">
    <ol
      data-grid={gridKey}
      aria-label={ariaLabel}
      className={`m-0 grid list-none grid-cols-3 p-0 ${gapClassName}`}
    >
      {children}
    </ol>
  </div>
)

const problemItems: CampaignCarouselItem[] = [
  {
    id: 'escala-6x1',
    title: 'Pelo fim da escala 6x1!',
    body: 'Jornadas longas aumentam o risco de AVC e infarto. Descanso é saúde pública. A bancada de Lula derrotou a direita na Câmara: o fim da 6×1 avançou. Mas a briga continua no Senado, onde a direita tenta barrar o avanço. No dia 4 de outubro, o 1313 é o seu sim ao descanso.',
    image: '/fundo.avif',
    imageAlt: 'Jorge Solla defendendo direitos dos trabalhadores na Câmara dos Deputados',
  },
  {
    id: 'sus',
    title: 'Pra valorizar o SUS',
    body: 'O SUS é o sistema de saúde de todo brasileiro. Com Lula, a saúde voltou a receber recursos: Nova PAC de R$ 30,5 bilhões e Mais Médicos retomado. Mas o teto de gastos da direita ainda trava o orçamento. O 1313 é seu voto em defesa do SUS no Congresso!',
    image: '/53569851134_02afc18fb4_o.avif',
    imageAlt: 'Jorge Solla em agenda pública de defesa do SUS',
    imageFrame: {
      width: 1024,
      height: 682,
      className: 'absolute top-0 left-[-21.97%] h-auto w-[136.62%] max-w-none',
    },
  },
  {
    id: 'mataripe',
    title: 'Pra defender os baianos',
    body: 'A Refinaria de Mataripe foi vendida no governo Bolsonaro e segue nas mãos de estrangeiros. Com Lula e Jerônimo, a Bahia voltou a andar pra frente; mas recomprar Mataripe exige bancada forte no Congresso. Votar 1313 é devolver à Bahia o que é seu.',
    image: '/52396285023_561ffc0ff6_o.avif',
    imageAlt: 'Vista da Bahia durante mobilização popular',
  },
]

const flagItems: CampaignCarouselItem[] = [
  {
    id: 'saude',
    label: 'Saúde',
    title: 'Defender o SUS e valorizar quem cuida',
    body: 'Saúde é direito, não mercadoria. Fim do subfinanciamento, piso da enfermagem e dos agentes pagos, concursos públicos, vacinação e ciência.',
  },
  {
    id: 'educacao',
    label: 'Educação',
    title: 'Educação em tempo integral e federais no interior',
    body: 'IFs, campus federal, escola de tempo integral: o interior não pode ficar para trás no conhecimento.',
  },
  {
    id: 'renda',
    label: 'Renda',
    title: 'Salário mínimo forte, emprego e moradia',
    body: 'Valorização do mínimo, Bolsa Família, Minha Casa Minha Vida e agricultura familiar como motor do interior.',
  },
  {
    id: 'democracia',
    label: 'Democracia',
    title: 'Defesa intransigente da democracia',
    body: 'Participação popular, instituições fortes e combate à desinformação. Eleger o parlamento é coisa séria.',
  },
  {
    id: 'bahia',
    label: 'Bahia',
    title: 'Recomprar a Refinaria de Mataripe',
    body: 'Recomprar a refinaria é defender a Bahia e a soberania do Brasil. Preço justo de combustível é política de saúde e de renda.',
  },
  {
    id: 'trabalho',
    label: 'Trabalho',
    title: 'Fim da escala 6×1 e jornada de 40h',
    body: 'Sem redução de salário. Jornada longa é questão de saúde pública: quem trabalha demais adoece. O SUS paga a conta.',
  },
]

const proofItems = [
  { value: '3.333', label: 'proposições apresentadas' },
  { value: '1.031', label: 'discursos em Plenário' },
  { value: '3º', label: 'mandato de deputado federal' },
]

export default async function HomePage() {
  return (
    <>
      <main className="w-full bg-white text-black">
        <CampaignHero />

        <section
          aria-label="Experiência e atuação parlamentar"
          data-home-section="proof"
          className="campaign-proof flex justify-center bg-white"
        >
          <ul className="campaign-proof-list m-0 grid h-full w-[calc(100%_-_22px)] max-w-[712px] list-none grid-cols-3 p-0">
            {proofItems.map((item) => (
              <li key={item.value} className="m-0 text-center">
                <strong className="campaign-proof-value block font-[family-name:var(--font-exo2)] leading-none font-black text-(--pt-red)">
                  {item.value}
                </strong>
                <span className="campaign-proof-label mt-1 block font-medium text-[#242124]">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <CampaignContentSection />

        <section
          aria-labelledby="problem-title"
          data-home-section="problem"
          className="campaign-problem relative bg-(--pt-red-dark) text-white"
        >
          <div className="relative h-full w-full">
            <p className="campaign-section-eyebrow campaign-problem-eyebrow absolute m-0 font-[family-name:var(--font-exo2)] font-black tracking-[0.1em] text-(--pt-yellow) uppercase">
              Por que essa eleição importa
            </p>
            <h2
              id="problem-title"
              aria-label="Eleger deputado é coisa séria. O Congresso tem nas mãos vidas reais e o SUS"
              className="campaign-section-title campaign-problem-title absolute m-0 border-0 p-0 font-black tracking-[-0.02em] text-balance"
            >
              <span className="block">Eleger deputado é coisa séria</span>
              <span className="block text-(--pt-yellow)">
                O Congresso tem nas mãos vidas reais e o SUS
              </span>
            </h2>
            <p className="campaign-section-copy campaign-problem-copy absolute m-0 font-[family-name:var(--font-exo2)] leading-[1.2] text-white/85">
              É no Congresso que se define o orçamento do SUS, o piso da enfermagem, a recompra de
              Mataripe e o fim da escala 6×1.{' '}
              <strong className="font-extrabold text-white">
                Reeleger Lula não basta: é preciso eleger uma bancada aliada.
              </strong>
            </p>
            <div className="campaign-problem-carousel absolute right-0 left-0">
              <CampaignCardGrid
                gridKey="problem"
                ariaLabel="Bandeiras que tornam esta eleição decisiva"
                gapClassName="gap-[21px]"
              >
                {problemItems.map((item) => (
                  <li key={item.id} className="m-0 h-[437px]">
                    <CampaignProblemCard item={item} />
                  </li>
                ))}
              </CampaignCardGrid>
              <div className="lg:hidden">
                <CampaignCarousel
                  ariaLabel="Bandeiras que tornam esta eleição decisiva"
                  items={problemItems}
                  variant="problem"
                />
              </div>
            </div>
          </div>
        </section>

        <section
          id="bandeiras"
          aria-labelledby="flags-title"
          data-home-section="flags"
          className="campaign-flags relative scroll-mt-4 bg-(--campaign-band) text-black"
        >
          <div className="relative h-full w-full">
            <p className="campaign-section-eyebrow campaign-flags-eyebrow absolute m-0 font-[family-name:var(--font-exo2)] font-black tracking-[0.1em] text-(--pt-red) uppercase">
              Nossa caminhada
            </p>
            <h2
              id="flags-title"
              aria-label="Junto com o trabalhador e do lado de quem mais precisa, sempre."
              className="campaign-section-title campaign-flags-title absolute m-0 border-0 p-0 font-black tracking-[-0.02em] text-balance"
            >
              <span className="block">Junto com o trabalhador e</span>
              <span className="block text-(--pt-red)">do lado de quem mais precisa, sempre.</span>
            </h2>
            <p className="campaign-section-copy campaign-flags-copy absolute m-0 font-sans leading-[1.2] text-black/80">
              Não é promessa de palanque, é a experiência de quem já fez na gestão do SUS, do
              Ministério da Saúde e da saúde da Bahia.
            </p>
            <div className="campaign-flags-carousel absolute right-0 left-0">
              <CampaignCardGrid
                gridKey="flags"
                ariaLabel="Bandeiras da campanha"
                gapClassName="gap-[14px]"
              >
                {flagItems.map((item) => (
                  <li key={item.id} className="m-0">
                    <CampaignFlagCard item={item} size="spacious" />
                  </li>
                ))}
              </CampaignCardGrid>
              <div className="lg:hidden">
                <CampaignCarousel
                  ariaLabel="Bandeiras da campanha"
                  items={flagItems}
                  variant="flags"
                />
              </div>
            </div>
          </div>
        </section>

        <CampaignNewsletterSection />
      </main>

      <CampaignFooter />
    </>
  )
}
