/**
 * B161 — shared contract for the incremental loading of the campaign table
 * lists. Each list exposes a `fetchNextXListPage` server action that re-runs
 * the page's own loader under the session's user (access preserved) and
 * returns serialized view models; the `CampaignInfiniteTable` primitive
 * appends them. Fail-closed: a missing session answers `error`, never rows.
 */
export type CampaignListNextPageResult<Row> =
  | { status: 'ok'; rows: readonly Row[]; totalDocs: number; hasMore: boolean }
  | { status: 'error'; message: string }

export const CAMPAIGN_LIST_SESSION_EXPIRED_MESSAGE =
  'Sua sessão expirou. Entre novamente para continuar.'
export const CAMPAIGN_LIST_LOAD_ERROR_MESSAGE = 'Não foi possível carregar mais linhas.'
