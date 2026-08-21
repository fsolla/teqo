/**
 * C141 — the advisor permission profile (Visão × Edição), configured by
 * coordinator/candidate on `/campanha/assessores`. Client-safe: options,
 * labels and the coherence rule ship to the permission editor UI; the
 * enforcement reads the same field values in `src/utilities/access/*`.
 *
 * Default profile (new and existing accounts): Carteira · Edita carteira —
 * exactly today's behavior, until someone configures otherwise.
 */
export const ADVISOR_VISIBILITY_VALUES = ['carteira', 'tudo'] as const
export type AdvisorVisibility = (typeof ADVISOR_VISIBILITY_VALUES)[number]

export const ADVISOR_EDITING_VALUES = ['carteira', 'tudo', 'somente_leitura'] as const
export type AdvisorEditing = (typeof ADVISOR_EDITING_VALUES)[number]

export type AdvisorVisibilityOption = {
  value: AdvisorVisibility
  label: string
  description: string
}

export type AdvisorEditingOption = {
  value: AdvisorEditing
  label: string
  description: string
}

export const ADVISOR_VISIBILITY_OPTIONS: readonly AdvisorVisibilityOption[] = [
  {
    value: 'carteira',
    label: 'Carteira',
    description: 'Municípios que administra',
  },
  {
    value: 'tudo',
    label: 'Tudo',
    description: 'Enxerga todos os municípios e lideranças',
  },
]

export const ADVISOR_EDITING_OPTIONS: readonly AdvisorEditingOption[] = [
  {
    value: 'carteira',
    label: 'Edita carteira',
    description: 'Edita só o que administra',
  },
  {
    value: 'tudo',
    label: 'Edita tudo',
    description:
      'Edita tudo o que vê — contas, carteiras, nível de envolvimento e demandas escaladas seguem com a coordenação',
  },
  {
    value: 'somente_leitura',
    label: 'Somente leitura',
    description: 'Nenhum controle de edição em lugar nenhum',
  },
]

const visibilityLabel: Record<AdvisorVisibility, string> = Object.fromEntries(
  ADVISOR_VISIBILITY_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<AdvisorVisibility, string>

const editingLabel: Record<AdvisorEditing, string> = Object.fromEntries(
  ADVISOR_EDITING_OPTIONS.map(({ value, label }) => [value, label]),
) as Record<AdvisorEditing, string>

/** Short badge label, e.g. "Tudo · Somente leitura". */
export const advisorProfileLabel = (
  visibility: AdvisorVisibility,
  editing: AdvisorEditing,
): string => `${visibilityLabel[visibility]} · ${editingLabel[editing]}`

/**
 * The incoherent combination (editing more than one sees) is never offered in
 * the UI and is rejected server-side too — `editing === 'tudo'` requires
 * `visibility === 'tudo'`.
 */
export const isCoherentAdvisorProfile = (
  visibility: AdvisorVisibility,
  editing: AdvisorEditing,
): boolean => editing !== 'tudo' || visibility === 'tudo'

export const isAdvisorVisibilityValue = (value: unknown): value is AdvisorVisibility =>
  ADVISOR_VISIBILITY_VALUES.includes(value as AdvisorVisibility)

export const isAdvisorEditingValue = (value: unknown): value is AdvisorEditing =>
  ADVISOR_EDITING_VALUES.includes(value as AdvisorEditing)

/**
 * C142 — the Edição axis as a write-scope decision, client-safe mirror of the
 * advisor branch of the server `advisorEditingAccess` (`src/utilities/access/
 * shared.ts` delegates here so the axis semantics live once). `somente_leitura`
 * → 'none' (no writes anywhere), `tudo` → 'tudo', anything else → 'carteira'.
 * Fails closed on the incoherent combination (editing more than one sees): the
 * collection hook rejects it at write, but a defensively-typed caller must
 * never widen a write scope from a stored contradiction.
 */
export const advisorEditingScope = (
  visibility: AdvisorVisibility | null | undefined,
  editing: AdvisorEditing | null | undefined,
): AdvisorEditingScope => {
  if (editing === 'somente_leitura') return 'none'
  if (editing === 'tudo' && visibility !== 'tudo') return 'none'
  if (editing === 'tudo') return 'tudo'
  return 'carteira'
}

/**
 * C142 — the per-row presentation rule for lists where Visão "Tudo" meets
 * Edição "Carteira": rows inside the portfolio stay editable, rows outside
 * render read-only. `none` → never; `tudo` → always; `carteira` → the row
 * intersects the portfolio (`portfolioMunicipalityIDs === null` = everything
 * is editable). Rows always carry at least one municipality in the surfaces
 * that use this helper, so an empty `rowMunicipalityIDs` is not editable under
 * a carteira scope.
 */
export const rowEditingAllowed = (
  editingScope: AdvisorEditingScope,
  portfolioMunicipalityIDs: readonly number[] | null,
  rowMunicipalityIDs: readonly number[] | null,
): boolean => {
  if (editingScope === 'none') return false
  if (editingScope === 'tudo') return true
  if (portfolioMunicipalityIDs === null) return true
  if (!rowMunicipalityIDs || rowMunicipalityIDs.length === 0) return false
  const portfolio = new Set(portfolioMunicipalityIDs)
  return rowMunicipalityIDs.some((id) => portfolio.has(id))
}

export type AdvisorEditingScope = 'none' | 'carteira' | 'tudo'
