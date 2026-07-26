/** Server action `createCampaignInvite` throws this when the consent key is missing. */
export const CREATE_CAMPAIGN_INVITE_MISSING_CONSENT_MESSAGE =
  'Consentimento ainda não configurado.' as const

export const mapCreateCampaignInviteError = (cause: unknown): string => {
  if (cause instanceof Error && cause.message === CREATE_CAMPAIGN_INVITE_MISSING_CONSENT_MESSAGE) {
    return 'Consentimento ainda não configurado — peça a um admin para criar o texto de consentimento antes de convidar.'
  }
  return 'Não foi possível gerar o convite. Verifique seu acesso e tente novamente.'
}
