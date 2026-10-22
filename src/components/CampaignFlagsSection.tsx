/**
 * S47 — "Bandeiras do mandato" (design scene 01/02): the six positions of the
 * new mandate in an editorial hairline grid — 3×2 on desktop, one column on
 * mobile. The electoral copy of the old campaign cards is gone; these are the
 * commitments that orient the work, not a vote request.
 */
const FLAGS = [
  {
    id: 'saude',
    label: 'Saúde',
    title: 'Defender o SUS e valorizar quem cuida',
    body: 'Financiamento público, piso da enfermagem, vacinação, ciência e atendimento digno.',
  },
  {
    id: 'educacao',
    label: 'Educação',
    title: 'Mais oportunidades no interior',
    body: 'Institutos federais, universidades e escola pública de qualidade em toda a Bahia.',
  },
  {
    id: 'renda',
    label: 'Renda',
    title: 'Crescimento com dignidade',
    body: 'Salário mínimo valorizado, moradia, agricultura familiar e comida na mesa.',
  },
  {
    id: 'democracia',
    label: 'Democracia',
    title: 'Participação e direitos',
    body: 'Instituições fortes, liberdade, respeito e combate permanente à desinformação.',
  },
  {
    id: 'bahia',
    label: 'Bahia',
    title: 'A Bahia no centro das decisões',
    body: 'Investimento federal e presença do mandato nos municípios e territórios.',
  },
  {
    id: 'trabalho',
    label: 'Trabalho',
    title: 'Tempo para viver, renda para cuidar',
    body: 'Jornada justa, direitos protegidos e trabalho que não adoece.',
  },
] as const

export const CampaignFlagsSection = () => (
  <section
    id="bandeiras"
    aria-labelledby="flags-title"
    data-home-section="flags"
    className="scroll-mt-4 bg-(--campaign-band)"
  >
    <div className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 lg:px-16 lg:py-24">
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <p className="m-0 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-red)">
            Bandeiras do mandato
          </p>
          <h2
            id="flags-title"
            className="mt-3 border-0 p-0 font-[family-name:var(--font-exo2)] text-[34px] leading-[1.03] font-black tracking-[-0.04em] text-balance lg:text-[46px] lg:leading-[1.02] lg:tracking-[-0.045em]"
          >
            Compromissos que orientam o trabalho
          </h2>
        </div>
        <p className="m-0 self-end text-[15px] leading-6 text-(--campaign-muted) lg:col-span-5 lg:text-base lg:leading-7">
          Posições construídas em décadas de vida pública, agora renovadas para o quarto mandato.
        </p>
      </div>

      <ol className="mt-8 grid list-none border-t border-l border-black/15 p-0 lg:mt-12 lg:grid-cols-3">
        {FLAGS.map((flag) => (
          <li key={flag.id} className="min-h-[210px] border-r border-b border-black/15 p-6 lg:p-7">
            <span className="font-[family-name:var(--font-exo2)] text-xs font-extrabold text-(--pt-red)">
              {flag.label}
            </span>
            <h3 className="mt-3 font-[family-name:var(--font-exo2)] text-[22px] font-extrabold tracking-[-0.02em] text-balance lg:mt-5 lg:text-2xl">
              {flag.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-(--campaign-muted) lg:mt-3">{flag.body}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
)
