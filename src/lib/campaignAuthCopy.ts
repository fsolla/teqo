/** Client-safe copy and shared auth UI class tokens (not `server-only`). */

export const CAMPAIGN_LEADERSHIP_PHONE_ACCESS_HINT =
  'Se você acessa só com celular, peça um novo convite ao coordenador.'

export const CAMPAIGN_LEADERSHIP_LOGIN_RECOVERY_HINT =
  'Conta só com celular? Peça um novo convite ao coordenador — a recuperação por e-mail não funciona sem e-mail cadastrado.'

export const CAMPAIGN_FIRST_ACCESS_HINT =
  'Peça um convite no WhatsApp ao coordenador do seu núcleo.'

export const CAMPAIGN_LOGIN_SUBTITLE = 'Use o e-mail ou o celular cadastrado na sua conta.'

/**
 * Card titles on public campaign auth screens (login / forgot / reset).
 * `!text-center` beats `[data-theme='campaign'] h1 { text-align: left }` (app shell).
 */
export const campaignAuthHeadingClassName =
  '!text-center text-balance text-xl leading-snug font-medium'

export const campaignAuthDescriptionClassName = 'leading-snug text-pretty'

export const campaignAuthMutedTextClassName =
  'text-sm text-muted-foreground leading-snug text-pretty'

export const campaignAuthTextLinkClassName = 'text-primary underline-offset-4 hover:underline'

export const campaignAuthCardHeaderClassName = 'gap-2 text-center'
