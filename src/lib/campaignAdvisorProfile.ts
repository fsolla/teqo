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
