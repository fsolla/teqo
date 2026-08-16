import { CampaignCarousel, type CampaignCarouselItem } from '@/components/CampaignCarousel'
import { CampaignFooter } from '@/components/CampaignFooter'
import { CampaignHero } from '@/components/CampaignHero'

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
          className="flex h-[88px] justify-center bg-white lg:h-[148px]"
        >
          <ul className="m-0 grid h-full w-[calc(100%_-_22px)] max-w-[712px] list-none grid-cols-3 items-center gap-[23px] p-0 lg:grid-cols-[147px_178px_183px] lg:items-start lg:justify-between lg:gap-0 lg:pt-[23px]">
            {proofItems.map((item) => (
              <li key={item.value} className="m-0 text-center">
                <strong className="block font-[family-name:var(--font-exo2)] text-[24px] leading-none font-black text-(--pt-red) lg:text-[36px] lg:leading-[1.1]">
                  {item.value}
                </strong>
                <span className="mt-1 block text-[10px] leading-[1.08] font-medium text-[#242124] lg:text-[18px] lg:leading-[1.25]">
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="problem-title"
          data-home-section="problem"
          className="relative h-[730px] bg-(--pt-red-dark) text-white lg:h-[659px]"
        >
          <div className="relative h-full w-full">
            <p className="absolute top-[35px] left-5 m-0 font-[family-name:var(--font-exo2)] text-[10px] leading-3 font-black tracking-[0.1em] text-(--pt-yellow) uppercase lg:left-[var(--campaign-content-inset)] lg:text-[12px] lg:leading-[15px]">
              Por que essa eleição importa
            </p>
            <h2
              id="problem-title"
              aria-label="Eleger deputado é coisa séria. O Congresso tem nas mãos vidas reais e o SUS"
              className="absolute top-[59px] left-5 m-0 w-[331px] border-0 p-0 text-[22px] leading-[1.08] font-black tracking-[-0.02em] text-balance lg:top-[66px] lg:left-[var(--campaign-content-inset)] lg:w-[616px] lg:text-[24px] lg:leading-[1.06]"
            >
              <span className="block">Eleger deputado é coisa séria</span>
              <span className="block text-(--pt-yellow)">
                O Congresso tem nas mãos vidas reais e o SUS
              </span>
            </h2>
            <p className="absolute top-[146px] left-5 m-0 w-[327px] font-[family-name:var(--font-exo2)] text-[14px] leading-[1.2] text-white/85 lg:top-[127px] lg:left-[var(--campaign-content-inset)] lg:w-[716px] lg:text-[16px]">
              É no Congresso que se define o orçamento do SUS, o piso da enfermagem, a recompra de
              Mataripe e o fim da escala 6×1.{' '}
              <strong className="font-extrabold text-white">
                Reeleger Lula não basta: é preciso eleger uma bancada aliada.
              </strong>
            </p>
            <div className="absolute top-[245px] right-0 left-0 lg:top-[191px]">
              <CampaignCarousel
                ariaLabel="Bandeiras que tornam esta eleição decisiva"
                items={problemItems}
                variant="problem"
              />
            </div>
          </div>
        </section>

        <section
          id="bandeiras"
          aria-labelledby="flags-title"
          data-home-section="flags"
          className="relative h-[400px] scroll-mt-4 bg-(--campaign-band) text-black lg:h-[368px]"
        >
          <div className="relative h-full w-full">
            <p className="absolute top-[37px] left-5 m-0 font-[family-name:var(--font-exo2)] text-[10px] leading-3 font-black tracking-[0.1em] text-(--pt-red) uppercase lg:top-[33px] lg:left-[var(--campaign-content-inset)] lg:text-[12px] lg:leading-[15px]">
              Nossa caminhada
            </p>
            <h2
              id="flags-title"
              aria-label="Junto com o trabalhador e do lado de quem mais precisa, sempre."
              className="absolute top-[66px] left-5 m-0 w-[331px] border-0 p-0 text-[22px] leading-[1.08] font-black tracking-[-0.02em] text-balance lg:top-[62px] lg:left-[var(--campaign-content-inset)] lg:w-[664px] lg:text-[24px] lg:leading-[1.06]"
            >
              <span className="block">Junto com o trabalhador e</span>
              <span className="block text-(--pt-red)">do lado de quem mais precisa, sempre.</span>
            </h2>
            <p className="absolute top-[149px] left-5 m-0 w-[327px] font-sans text-[14px] leading-[1.2] text-black/80 lg:top-[130px] lg:left-[var(--campaign-content-inset)] lg:w-[730px] lg:text-[16px]">
              Não é promessa de palanque, é a experiência de quem já fez na gestão do SUS, do
              Ministério da Saúde e da saúde da Bahia.
            </p>
            <div className="absolute top-[215px] right-0 left-0 lg:top-[184px]">
              <CampaignCarousel
                ariaLabel="Bandeiras da campanha"
                items={flagItems}
                variant="flags"
              />
            </div>
          </div>
        </section>
      </main>

      <CampaignFooter />
    </>
  )
}
