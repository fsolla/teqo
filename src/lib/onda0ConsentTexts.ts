import {
  CAMPAIGN_INVITE_CONSENT_KEY,
  SUPPORTER_REGISTRATION_CONSENT_KEY,
  SUPPORTER_VOTE_INTENTION_CONSENT_KEY,
} from '@/lib/campaignConsentKeys'
import type { Consent } from '@/payload-types'

export const ONDA0_PROVISIONAL_BANNER =
  'Texto provisório para MVP e testes internos da plataforma Teqo (campanha Jorge Solla). Não constitui parecer jurídico. Deve ser substituído por texto aprovado pela assessoria jurídica eleitoral antes de coleta de dados de titulares reais em produção.'

const ONDA0_CONSENT_KEYS = {
  leadershipAutofill: CAMPAIGN_INVITE_CONSENT_KEY,
  supporterRegistration: SUPPORTER_REGISTRATION_CONSENT_KEY,
  supporterVoteIntention: SUPPORTER_VOTE_INTENTION_CONSENT_KEY,
  campaignPush: 'campanha-notificacoes-push',
} as const

export type Onda0ConsentKey = (typeof ONDA0_CONSENT_KEYS)[keyof typeof ONDA0_CONSENT_KEYS]

export const ONDA0_CONSENT_KEY_LIST: Onda0ConsentKey[] = [
  ONDA0_CONSENT_KEYS.leadershipAutofill,
  ONDA0_CONSENT_KEYS.supporterRegistration,
  ONDA0_CONSENT_KEYS.supporterVoteIntention,
  ONDA0_CONSENT_KEYS.campaignPush,
]

type LexicalRoot = NonNullable<Consent['text']>

const paragraph = (text: string) => ({
  type: 'paragraph' as const,
  children: [{ type: 'text' as const, text, version: 1 as const }],
  direction: null,
  format: '',
  indent: 0,
  version: 1 as const,
})

const buildLexicalFromParagraphs = (paragraphs: string[]): LexicalRoot => ({
  root: {
    type: 'root',
    children: paragraphs.map(paragraph),
    direction: null,
    format: '',
    indent: 0,
    version: 1,
  },
})

const contactChannel =
  'Para exercer seus direitos previstos no art. 18 da LGPD (acesso, correção, eliminação, portabilidade, revogação do consentimento), entre em contato pelo e-mail privacidade@jorgesolla.com.br.'

const consentFooter = `Mais informações: ${contactChannel} Consulte também a Política de Privacidade em /privacidade.`

const consentDefinitions: Record<Onda0ConsentKey, string[]> = {
  [ONDA0_CONSENT_KEYS.leadershipAutofill]: [
    ONDA0_PROVISIONAL_BANNER,
    'Finalidade: registrar e atualizar seus dados de contato (nome, telefone, e-mail, setor) para participação como liderança de campanha vinculada às Praças em que atua, incluindo acesso à área interna /campanha quando aplicável.',
    'Dados tratados: nome, telefone, e-mail, setor e vínculo com as Praças e organizações em que atua. Não coletamos dados sensíveis neste fluxo.',
    'Base legal: consentimento do titular (art. 7º, I, e art. 8º da Lei nº 13.709/2018 — LGPD).',
    'Compartilhamento: equipe autorizada da campanha e prestadores de hospedagem/processamento necessários à operação da plataforma, sem comercialização dos dados.',
    'Prazo de retenção: enquanto durar o vínculo de liderança e pelos prazos legais aplicáveis após o encerramento.',
    consentFooter,
  ],
  [ONDA0_CONSENT_KEYS.supporterRegistration]: [
    ONDA0_PROVISIONAL_BANNER,
    'Finalidade: registrar seu apoio declarado à campanha de Jorge Solla, permitindo contato organizado pela equipe de campanha e eventual vinculação a uma Praça.',
    'Dados tratados: nome, telefone, e-mail (quando informado), município/território e observações operacionais inseridas pela equipe.',
    'Base legal: consentimento do titular (art. 7º, I, e art. 8º da LGPD).',
    'Compartilhamento: equipe autorizada da campanha; não há venda ou cessão a terceiros para fins comerciais.',
    'Prazo de retenção: durante a campanha e pelos prazos legais aplicáveis; você pode solicitar eliminação conforme a Política de Privacidade.',
    consentFooter,
  ],
  [ONDA0_CONSENT_KEYS.supporterVoteIntention]: [
    ONDA0_PROVISIONAL_BANNER,
    'Atenção: este consentimento é destacado e separado do cadastro de apoio. A intenção de voto é dado pessoal sensível nos termos do art. 11 da LGPD.',
    'Finalidade: registrar, de forma opcional e separada, sua declaração de intenção de voto relativa à candidatura de Jorge Solla, para planejamento interno da campanha.',
    'Dados tratados: categoria de intenção de voto selecionada (por exemplo: certo, tende a certo, indeciso, outro).',
    'Base legal: consentimento específico e destacado do titular para dado sensível (art. 11, I, da LGPD).',
    'Você pode recusar ou revogar este consentimento sem prejuízo do cadastro de apoio, quando o cadastro base já existir.',
    consentFooter,
  ],
  [ONDA0_CONSENT_KEYS.campaignPush]: [
    ONDA0_PROVISIONAL_BANNER,
    'Finalidade: enviar notificações push no aplicativo instalável da área /campanha (alertas operacionais, lembretes de agenda e atualizações da coordenação).',
    'Dados tratados: identificador técnico de inscrição push no dispositivo e preferências de notificação; não inclui conteúdo de mensagens de terceiros.',
    'Base legal: consentimento do titular (art. 7º, I, e art. 8º da LGPD).',
    'Você pode revogar o consentimento e desativar notificações nas configurações do dispositivo ou do app.',
    consentFooter,
  ],
}

export const ONDA0_CONSENT_ENTRIES: Array<{ key: Onda0ConsentKey; text: LexicalRoot }> =
  ONDA0_CONSENT_KEY_LIST.map((key) => ({
    key,
    text: buildLexicalFromParagraphs(consentDefinitions[key]),
  }))

export const ONDA0_PRIVACY_POLICY_BODY: LexicalRoot = buildLexicalFromParagraphs([
  ONDA0_PROVISIONAL_BANNER,
  'Esta Política de Privacidade descreve como a campanha de Jorge Solla (controlador) trata dados pessoais por meio do site público e da ferramenta interna /campanha (plataforma Teqo).',
  'Dados que podemos tratar: identificação e contato (nome, telefone, e-mail), dados territoriais de apoio, registros de consentimento, dados operacionais de campanha e, quando separadamente consentido, intenção de voto (dado sensível — art. 11 da LGPD).',
  'Finalidades: organização das Praças da campanha, cadastro de apoiadores, comunicação com lideranças e equipe, operação de agenda e inteligência eleitoral interna, sempre conforme a finalidade informada no momento da coleta.',
  'Bases legais: consentimento (arts. 7º e 8º da LGPD) e, para dado sensível de intenção de voto, consentimento específico e destacado (art. 11, I).',
  'Compartilhamento: não vendemos dados. Prestadores de tecnologia (hospedagem, banco de dados) atuam como operadores sob nossas instruções.',
  'Direitos do titular (art. 18 LGPD): confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e revogação de consentimento, mediante solicitação.',
  contactChannel,
  'Segurança: adotamos medidas técnicas e administrativas proporcionais ao risco, incluindo controle de acesso na ferramenta /campanha.',
  'Atualizações: esta política pode ser revisada; a versão publicada nesta página prevalece. Textos de consentimento específicos são versionados e registrados no aceite.',
])
