/**
 * B17 — which columns of a `CampaignTable` the actor chose to hide.
 *
 * Pure and client-safe: the picker (client) serializes, the list surfaces
 * (RSC) parse and filter. Persistence is a cookie rather than `localStorage`
 * because the column array never crosses the server/client boundary
 * (`CampaignTableColumn.cell` is a function), so the server is the only place
 * that can drop a column — and a cookie is the only per-device preference the
 * server can read on the first paint, with no flash of the full table.
 */

export const CAMPAIGN_COLUMNS_COOKIE = 'campaign_columns'
/** Scoped like the campaign session cookie: the picker only exists under /campanha. */
export const CAMPAIGN_COLUMNS_COOKIE_PATH = '/campanha'
export const CAMPAIGN_COLUMNS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** A malformed or oversized cookie shows the full table instead of guessing. */
const MAX_COOKIE_LENGTH = 2048

const CAMPAIGN_LIST_IDS = [
  'municipios',
  'liderancas',
  'dobradinhas',
  'organizacoes',
  'demandas',
  'apoiadores',
  'territorios',
  'assessores',
] as const

export type CampaignListId = (typeof CAMPAIGN_LIST_IDS)[number]

export type CampaignHiddenColumns = Partial<Record<CampaignListId, string[]>>

/**
 * What one list surface needs to run the picker, as ONE value. The id is what
 * the cookie is keyed by and what the picker writes back, so the reader and
 * the table must agree on it — as two props they could disagree between two
 * perfectly valid ids, and the only symptom would be a picker that does nothing.
 */
export type CampaignColumnVisibility = {
  listId: CampaignListId
  hiddenColumnIds: readonly string[]
}

/**
 * `listId:colA~colB|otherList:colC`. Every character here is legal in a
 * cookie value (RFC 6265 forbids comma, semicolon, whitespace, quotes and
 * backslash), so nothing is percent-encoded — which matters because
 * `document.cookie` and Next's `cookies()` disagree about decoding.
 */
const LIST_SEPARATOR = '|'
const LIST_ID_SEPARATOR = ':'
const COLUMN_SEPARATOR = '~'
const COLUMN_ID_PATTERN = /^[A-Za-z0-9_-]+$/

const isCampaignListId = (value: string): value is CampaignListId =>
  CAMPAIGN_LIST_IDS.some((listId) => listId === value)

export const parseCampaignHiddenColumns = (raw: string | undefined): CampaignHiddenColumns => {
  if (!raw || raw.length > MAX_COOKIE_LENGTH) return {}

  const parsed: CampaignHiddenColumns = {}

  for (const entry of raw.split(LIST_SEPARATOR)) {
    const separatorIndex = entry.indexOf(LIST_ID_SEPARATOR)
    if (separatorIndex <= 0) continue

    const listId = entry.slice(0, separatorIndex)
    if (!isCampaignListId(listId)) continue

    // An id matching nothing on the table is inert, so the length cap above is
    // the only bound worth having — a per-list one would also have to be
    // mirrored in `serialize`, or writing 41 and reading back 40 would differ.
    const columnIds = [
      ...new Set(
        entry
          .slice(separatorIndex + 1)
          .split(COLUMN_SEPARATOR)
          .filter((columnId) => COLUMN_ID_PATTERN.test(columnId)),
      ),
    ]

    if (columnIds.length) parsed[listId] = columnIds
  }

  return parsed
}

export const serializeCampaignHiddenColumns = (value: CampaignHiddenColumns): string =>
  CAMPAIGN_LIST_IDS.flatMap((listId) => {
    const columnIds = (value[listId] ?? []).filter((columnId) => COLUMN_ID_PATTERN.test(columnId))
    if (!columnIds.length) return []
    return [`${listId}${LIST_ID_SEPARATOR}${columnIds.join(COLUMN_SEPARATOR)}`]
  }).join(LIST_SEPARATOR)

/**
 * Records one toggle. Hiding is stored (never the visible set), so a column
 * shipped by a later item — E9's derived signals, E14's level — is visible to
 * everyone who never touched the picker, which is the contract those items
 * assumed.
 */
export const toggleHiddenColumn = (
  hiddenColumnIds: readonly string[],
  columnId: string,
  visible: boolean,
): string[] => {
  const without = hiddenColumnIds.filter((id) => id !== columnId)
  return visible ? without : [...without, columnId]
}

type HideableColumn = { id: string; mandatory?: boolean }

/**
 * A `mandatory` column is never dropped, whatever the cookie says — an actor
 * who lands with a stale cookie must not end up with a table he cannot read
 * (or, on `/campanha/municipios`, without the only linked name in the row).
 */
export const resolveVisibleColumns = <Column extends HideableColumn>(
  columns: readonly Column[],
  hiddenColumnIds: readonly string[] | undefined,
): readonly Column[] => {
  if (!hiddenColumnIds?.length) return columns

  const hidden = new Set(hiddenColumnIds)
  return columns.filter((column) => column.mandatory || !hidden.has(column.id))
}
