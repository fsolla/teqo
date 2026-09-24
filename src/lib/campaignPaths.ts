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

/** Communication vertical (C154) — home redirects to the acervo. */
export const CAMPAIGN_COMMUNICATION_HOME = '/campanha/comunicacao' as const

export const CAMPAIGN_COMMUNICATION_ACERVO = '/campanha/comunicacao/acervo' as const

/** C168 — library of cuts made from the acervo (list + `/<id>` detail). */
export const CAMPAIGN_COMMUNICATION_CORTES = '/campanha/comunicacao/acervo/cortes' as const

/** C194 — private library of reels (list + `/<id>` detail). */
export const CAMPAIGN_COMMUNICATION_REELS = '/campanha/comunicacao/reels' as const

/** C194 — internal detail of one reel (id is immutable). */
export const campaignReelDetailHref = (id: number): string =>
  `${CAMPAIGN_COMMUNICATION_REELS}/${id}`

/** C194 — JSON endpoint the detail's kill switch calls to publish/unpublish. */
export const campaignReelPublicationHref = (id: number): string =>
  `${campaignReelDetailHref(id)}/publicacao`

/** C168/C174 — internal detail of one cut in the library (id is immutable). */
export const campaignSpeechCutDetailHref = (id: number): string =>
  `${CAMPAIGN_COMMUNICATION_CORTES}/${id}`

/** C183 — JSON endpoints the library card and the detail call to remove/retry a cut. */
export const campaignSpeechCutDeleteHref = (id: number): string =>
  `${campaignSpeechCutDetailHref(id)}/apagar`

export const campaignSpeechCutRetryHref = (id: number): string =>
  `${campaignSpeechCutDetailHref(id)}/retry`

/** C199 — "Gravações enviadas" source inside the acervo (list + `/<id>` detail). */
export const CAMPAIGN_COMMUNICATION_ACERVO_GRAVACOES =
  `${CAMPAIGN_COMMUNICATION_ACERVO}/gravacoes` as const

/** C216 — "Falas na internet" detail (the list stays at `?source=internet`). */
const CAMPAIGN_COMMUNICATION_ACERVO_INTERNET = `${CAMPAIGN_COMMUNICATION_ACERVO}/internet` as const

export const campaignInternetSpeechHref = (id: number): string =>
  `${CAMPAIGN_COMMUNICATION_ACERVO_INTERNET}/${id}`

/** C216 — the authenticated private media routes of one web speech. */
export const campaignInternetSpeechFileHref = (id: number, download = false): string =>
  `${campaignInternetSpeechHref(id)}/arquivo${download ? '?download=1' : ''}`

export const campaignInternetSpeechCoverHref = (id: number): string =>
  `${campaignInternetSpeechHref(id)}/capa`

/** C211 — internal Central de Conteúdos (list + `/<id>` ficha). */
export const CAMPAIGN_COMMUNICATION_CONTEUDOS = '/campanha/comunicacao/conteudos' as const

const campaignContentPieceDetailHref = (id: number): string =>
  `${CAMPAIGN_COMMUNICATION_CONTEUDOS}/${id}`

/** C211 — JSON endpoints of a piece (upload/link/status/retry/publication/file). */
export const CAMPAIGN_CONTENT_PIECE_UPLOAD_HREF =
  `${CAMPAIGN_COMMUNICATION_CONTEUDOS}/enviar` as const

export const CAMPAIGN_CONTENT_PIECE_LINK_HREF = `${CAMPAIGN_COMMUNICATION_CONTEUDOS}/link` as const

export const CAMPAIGN_CONTENT_PIECE_STATUS_HREF =
  `${CAMPAIGN_COMMUNICATION_CONTEUDOS}/status` as const

export const campaignContentPieceFileHref = (id: number, download = false): string =>
  `${campaignContentPieceDetailHref(id)}/arquivo${download ? '?download=1' : ''}`

export const campaignContentPieceRetryHref = (id: number): string =>
  `${campaignContentPieceDetailHref(id)}/retry`

export const campaignContentPiecePublicationHref = (id: number): string =>
  `${campaignContentPieceDetailHref(id)}/publicacao`

const campaignRecordingDetailHref = (id: number): string =>
  `${CAMPAIGN_COMMUNICATION_ACERVO_GRAVACOES}/${id}`

/** C199 — JSON endpoints of the recording detail (send/status/retry/delete). */
export const CAMPAIGN_RECORDING_UPLOAD_HREF =
  `${CAMPAIGN_COMMUNICATION_ACERVO_GRAVACOES}/enviar` as const

export const CAMPAIGN_RECORDING_STATUS_HREF =
  `${CAMPAIGN_COMMUNICATION_ACERVO_GRAVACOES}/status` as const

export const campaignRecordingFileHref = (id: number, download = false): string =>
  `${campaignRecordingDetailHref(id)}/arquivo${download ? '?download=1' : ''}`

export const campaignRecordingRetryHref = (id: number): string =>
  `${campaignRecordingDetailHref(id)}/retry`

export const campaignRecordingDeleteHref = (id: number): string =>
  `${campaignRecordingDetailHref(id)}/apagar`

/** C200 — human identification of one speaker cluster of a recording. */
export const campaignRecordingSpeakersHref = (id: number): string =>
  `${campaignRecordingDetailHref(id)}/falantes`

export const CAMPAIGN_UPDATES_HREF = '/campanha/atualizacoes' as const
