/** Client-safe copy and shared auth UI class tokens (not `server-only`). */

export const CAMPAIGN_LEADERSHIP_PHONE_ACCESS_HINT =
  'Se você acessa só com celular, peça um novo convite ao coordenador.'

export const CAMPAIGN_LEADERSHIP_LOGIN_RECOVERY_HINT =
  'Conta só com celular? Peça um novo convite ao coordenador — a recuperação por e-mail não funciona sem e-mail cadastrado.'

export const CAMPAIGN_FIRST_ACCESS_HINT =
  'Peça um convite no WhatsApp ao assessor do seu município.'

export const CAMPAIGN_LOGIN_SUBTITLE = 'Use o e-mail ou o celular cadastrado na sua conta.'

export const CAMPAIGN_REMEMBER_ME_DESCRIPTION =
  'Em aparelho pessoal, fique conectado por 14 dias. Desmarcado, o acesso dura 8 horas.'

/** Shown when Payload locks the account after maxLoginAttempts (default: 5 / 10 min). */
export const CAMPAIGN_ACCOUNT_LOCKED_MESSAGE =
  'Conta temporariamente bloqueada após várias tentativas. Aguarde alguns minutos e tente de novo.'

export const CAMPAIGN_LOGIN_INVALID_CREDENTIALS_MESSAGE = 'E-mail, celular ou senha inválidos.'

// ---------------------------------------------------------------------------
// Biometric login (B40)
// ---------------------------------------------------------------------------

/**
 * "Digital ou Face ID" instead of the accurate "chave de acesso"/"passkey":
 * the label has to name what the person is about to do with their hand, and
 * nobody in the field calls it a passkey.
 */
export const CAMPAIGN_BIOMETRIC_LOGIN_LABEL = 'Entrar com digital ou Face ID'

export const CAMPAIGN_BIOMETRIC_SECTION_TITLE = 'Acesso por biometria'

export const CAMPAIGN_BIOMETRIC_SECTION_DESCRIPTION =
  'Entre com a digital ou o Face ID deste aparelho, sem digitar a senha.'

/**
 * The one sentence that keeps "biometria" from being read as a biometric
 * database. It is a legal statement as much as a reassurance: the fingerprint
 * never leaves the device, so this opens no LGPD art. 11 question.
 */
export const CAMPAIGN_BIOMETRIC_PRIVACY_NOTE =
  'Sua digital não sai do aparelho e não é enviada para a campanha — guardamos apenas uma chave de acesso deste aparelho.'

export const CAMPAIGN_BIOMETRIC_ENROLL_LABEL = 'Ativar neste aparelho'

export const CAMPAIGN_BIOMETRIC_TOAST_TITLE = 'Entre sem digitar a senha'

export const CAMPAIGN_BIOMETRIC_TOAST_DESCRIPTION = 'Use a digital ou o Face ID deste aparelho'

/** The prompt was dismissed by the person; not an error worth a red message. */
export const CAMPAIGN_BIOMETRIC_CANCELLED_MESSAGE = 'Confirmação cancelada.'

export const CAMPAIGN_BIOMETRIC_UNSUPPORTED_MESSAGE =
  'Este aparelho não tem digital ou Face ID disponível para o navegador.'

/**
 * Outcomes both halves have to be able to say. The browser reaches some of them
 * without asking the server (the OS refuses a second credential for a device it
 * already holds) and falls back to others when a route answers without a safe
 * message, so a single spelling is what keeps the two from drifting apart.
 */
export const CAMPAIGN_BIOMETRIC_DUPLICATE_DEVICE_MESSAGE = 'Este aparelho já está cadastrado.'

export const CAMPAIGN_BIOMETRIC_ENROLLED_MESSAGE =
  'Aparelho cadastrado. Na próxima vez, entre com a biometria.'

export const CAMPAIGN_BIOMETRIC_ENROLL_ERROR_MESSAGE =
  'Não foi possível cadastrar este aparelho. Tente novamente.'

export const CAMPAIGN_BIOMETRIC_REMOVED_MESSAGE =
  'Aparelho removido. Ele não entra mais com biometria.'

export const CAMPAIGN_BIOMETRIC_REMOVE_ERROR_MESSAGE =
  'Não foi possível remover este aparelho. Tente novamente.'

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
