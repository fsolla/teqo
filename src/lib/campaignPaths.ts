/** Client-safe `/campanha` route paths shared by nav, gates, and home actions. */
export const CAMPAIGN_HOME = '/campanha' as const

export const CAMPAIGN_TERRITORIES_HOME = '/campanha/territorios' as const

export const CAMPAIGN_DEMANDS_HOME = '/campanha/demandas' as const

export const CAMPAIGN_ADVISORS_HOME = '/campanha/assessores' as const

export const CAMPAIGN_SUPPORTERS_HOME = '/campanha/apoiadores' as const

export const CAMPAIGN_AGENDA_HOME = '/campanha/agenda' as const

/** Staff page for the `Contact` ficha (C139). */
export const CAMPAIGN_CONTACTS_HOME = '/campanha/contatos' as const

/** Leader's own supporter contact tool (B43) — moved here by C139 so staff
 * and leader no longer share the `/campanha/contatos` route. */
export const LEADER_CONTACTS_HOME = '/campanha/meus-contatos' as const

export const CAMPAIGN_PROFILE_HOME = '/campanha/perfil' as const

export const CAMPAIGN_UPDATES_HREF = '/campanha/atualizacoes' as const
