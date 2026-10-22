/**
 * S48 — the PL 5594/2026 petition (transparency of presidential candidates).
 *
 * The petition is editorial content, but production only carries the three
 * legacy petitions restored from the old platform: there is no admin-free path
 * to reproduce it in a worktree, staging or a fresh database. This module
 * versions the content as the single source the seed writes and the unit
 * invariants check (`tests/unit/petitionPl5594Content.unit.spec.ts`).
 *
 * Facts come from the official bill text (Câmara, codteor=3184912) and the
 * product plan `docs/plans/abaixo-assinado-pl-5594-2026.md`. Guardrails: the
 * motivation mentions the 18/10/2026 debate without accusing anyone of a
 * crime, and the request asks for support without promising approval.
 *
 * The body is HTML (readable/reviewable) and the seed converts it to Lexical
 * with the project editor config, the same round-trip as `seed-posts.mjs`.
 */
import { WHATSAPP_SUBSCRIPTION_CONSENT_KEY } from '../../src/lib/campaignConsentKeys.ts'

export const PETITION_ID = 'pl-5594-2026'

export const PETITION_TITLE = 'Quem quer ser presidente deve abrir os sigilos'

export const PETITION_SUBTITLE =
  'Apoie o PL 5594/2026: candidatos à Presidência e à Vice-Presidência devem autorizar o acesso aos sigilos bancário, fiscal, telefônico e de internet.'

export const PETITION_FORM_TITLE = 'Assine o abaixo-assinado'

export const PETITION_FORM_SUBTITLE = 'Preencha seus dados para apoiar o PL 5594/2026.'

/**
 * The existing petition Consent (`form.consent` of the three production
 * petitions). Resolved by stable key — never by a hardcoded id; the seed is
 * fail-closed when the key is missing.
 */
export const PETITION_CONSENT_KEY = WHATSAPP_SUBSCRIPTION_CONSENT_KEY

export const PETITION_BODY_SECTIONS = [
  {
    heading: 'O que o PL 5594/2026 propõe',
    html: [
      '<p>O projeto de lei do deputado Jorge Solla (PT/BA), apresentado em 19/10/2026, torna a transparência uma condição do registro da candidatura à Presidência e à Vice-Presidência da República. Quem disputa o cargo passa a apresentar, no pedido de registro, uma declaração expressa, individual, específica e informada de autorização de acesso a:</p>',
      '<ul>',
      '<li>informações bancárias e financeiras — contas, aplicações, investimentos, operações de crédito, empréstimos, financiamentos, participações societárias, ativos e passivos;</li>',
      '<li>declarações de Imposto de Renda, rendimentos, patrimônio declarado, ganhos de capital e obrigações tributárias dos <strong>cinco exercícios fiscais anteriores</strong> ao pedido de registro;</li>',
      '<li>registros telefônicos — origem, destino, data, horário, duração e faturamento —, <strong>excluído o conteúdo das comunicações</strong>;</li>',
      '<li>registros de conexão e de acesso a aplicações de internet — data, horário, endereço IP e demais metadados legalmente disponíveis —, <strong>excluído o conteúdo de mensagens, arquivos, correspondências eletrônicas e comunicações privadas</strong>.</li>',
      '</ul>',
      '<p>A ementa oficial resume: o PL dispõe sobre a transparência patrimonial, fiscal e financeira dos candidatos à Presidência da República, estabelece mecanismos de autorização de acesso a informações protegidas por sigilo e altera a Lei nº 9.504, de 30 de setembro de 1997.</p>',
    ].join('\n'),
  },
  {
    heading: 'Por que isso importa agora',
    html: [
      '<p>Em 18/10/2026, durante o debate eleitoral, Lula desafiou Flávio Bolsonaro a abrir seus sigilos. No dia seguinte, Solla protocolou o PL 5594/2026 na Câmara dos Deputados. O projeto não trata de um caso isolado: cria uma regra geral de transparência para quem disputa a Presidência.</p>',
      '<p>Hoje o eleitor recebe declarações de bens, mas não tem instrumentos equivalentes para verificar a coerência entre patrimônio, rendimentos e movimentação financeira dos candidatos. O PL busca fechar essa lacuna com critérios objetivos e fiscalização por órgãos competentes.</p>',
    ].join('\n'),
  },
  {
    heading: 'O que o PL não faz',
    html: [
      '<ul>',
      '<li><strong>Não abre o conteúdo das conversas.</strong> Telefonia e internet entram apenas como registros e metadados; o conteúdo de comunicações telefônicas e telemáticas permanece sujeito às garantias constitucionais e só pode ser acessado com ordem judicial quando exigida.</li>',
      '<li><strong>Não permite acesso livre.</strong> O acesso fica restrito a autoridades e órgãos públicos legalmente competentes, para fiscalização eleitoral, verificação patrimonial e apuração de indícios concretos de ilícitos, respeitadas as competências e garantias legais.</li>',
      '<li><strong>Não autoriza uso para outra finalidade.</strong> Toda consulta é registrada em sistema de auditoria com identificação do responsável, da finalidade, da data e das categorias de informações consultadas; as informações ficam protegidas por dever de confidencialidade.</li>',
      '<li><strong>Não expõe dados de terceiros.</strong> A Justiça Eleitoral divulga ao público apenas o que a lei autoriza, resguardando dados pessoais de terceiros, credenciais de acesso e números completos de contas.</li>',
      '<li><strong>Não substitui a LGPD.</strong> O tratamento das informações observa a legislação de proteção de dados pessoais e as medidas técnicas e administrativas para prevenir acessos não autorizados, vazamentos e uso indevido.</li>',
      '</ul>',
    ].join('\n'),
  },
  {
    heading: 'O pedido',
    html: [
      '<p>Assine para pedir que a Câmara dos Deputados dê tramitação e aprove o PL 5594/2026. A transparência não substitui a apuração de responsabilidades nem presume irregularidade: ela dá ao eleitor e aos órgãos de fiscalização os meios para verificar.</p>',
      '<p>Quem quer governar o país deve aceitar o mesmo padrão de transparência que cobra dos outros. Assine e compartilhe.</p>',
    ].join('\n'),
  },
  {
    heading: 'Texto oficial e tramitação',
    html: [
      '<p>Leia a íntegra e acompanhe a tramitação na Câmara dos Deputados:</p>',
      '<ul>',
      '<li><a href="https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=2648344">Ficha de tramitação do PL 5594/2026</a></li>',
      '<li><a href="https://www.camara.leg.br/proposicoesWeb/prop_mostrarintegra?codteor=3184912">Inteiro teor do PL 5594/2026</a></li>',
      '</ul>',
      '<p>Status em 21/10/2026: o projeto foi apresentado à Mesa da Câmara dos Deputados; não havia tramitação posterior registrada nesta data.</p>',
    ].join('\n'),
  },
]

export const PETITION_BODY_HTML = PETITION_BODY_SECTIONS.map(
  (section) => `<h2>${section.heading}</h2>\n${section.html}`,
).join('\n')
