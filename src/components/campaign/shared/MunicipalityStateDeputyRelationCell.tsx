'use client'

import { useCallback, useMemo, type ReactElement } from 'react'

import type { MunicipalityStateDeputyCreateResult } from '@/app/(campaign)/campanha/actions/stateDeputy'
import type { CampaignCellEditOverlayVariant } from '@/components/campaign/shared/CampaignCellEditOverlay'
import {
  RelationChipCell,
  type RelationChip,
  type RelationChipCellCopy,
  type RelationSearchHit,
} from '@/components/campaign/shared/RelationChipCell'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { stateDeputyDisplayName } from '@/lib/stateDeputyNameParty'
import { matchesNormalizedAtWordStart, normalizeSearchPhrase } from '@/lib/wordStartFilter'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { StateDeputyRelationOption } from '@/utilities/campaignRelationOptions'
import { campaignUserInitials } from '@/utilities/campaignUserProfile'

const MAX_VISIBLE_AVATARS = 3

/** "Cicrano (PCdoB)" → "C" — parenthesized party never leaks into the initials. */
const deputyInitials = (label: string): string => {
  const withoutParty = label.replace(/\([^()]*\)/g, '').trim()
  return campaignUserInitials(withoutParty || label)
}

/**
 * The closed-cell display of the "Dobradinhas" column (B157): the same avatar
 * stack as the advisors column — overlapping initials circles, hover reads the
 * names — with "—" for an empty município. The detail ("Fulano (PT)") lives in
 * the trigger tooltip and in the editor's removable chips, which link to the
 * ficha (same contract as advisors: no links inside the closed cell).
 */
const StateDeputyAvatarStack = ({ chips }: { chips: RelationChip[] }) => {
  if (chips.length === 0) return <span className="text-sm text-muted-foreground">—</span>

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {chips.slice(0, MAX_VISIBLE_AVATARS).map((chip) => (
          <Avatar key={chip.key} className="size-8 border-2 border-background">
            <AvatarFallback>{deputyInitials(chip.label)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
    </div>
  )
}

/** One "Nome (Partido)" per line — the hover read of the closed cell. */
const formatStateDeputyNamesTooltip = (chips: RelationChip[]): ReactElement | null =>
  chips.length === 0 ? null : (
    <div className="flex flex-col">
      {chips.map((chip) => (
        <span key={chip.key}>{chip.label}</span>
      ))}
    </div>
  )

/**
 * Normalized search labels, once per `options` array rather than per row: the
 * RSC builds one array and every row of the table gets that same reference, so
 * a `WeakMap` shares the work where a per-row `useMemo` would repeat it (same
 * reasoning as `LeadershipStateDeputyRelationCell`).
 */
const normalizedLabelsByOptions = new WeakMap<
  readonly StateDeputyRelationOption[],
  Map<number, string>
>()

const normalizedOptionLabels = (
  options: readonly StateDeputyRelationOption[],
): Map<number, string> => {
  const cached = normalizedLabelsByOptions.get(options)
  if (cached) return cached

  // Name AND party are searchable ("PT" finds "Fulano (PT)" — B157 aceite).
  const normalized = new Map(
    options.map(
      (option) =>
        [option.id, normalizeSearchPhrase(`${option.plainName} ${option.party ?? ''}`)] as const,
    ),
  )
  normalizedLabelsByOptions.set(options, normalized)
  return normalized
}

/** Same WeakMap sharing for the id→option lookup the chips are built from. */
const optionByIdByOptions = new WeakMap<
  readonly StateDeputyRelationOption[],
  Map<number, StateDeputyRelationOption>
>()

const optionByIdFor = (
  options: readonly StateDeputyRelationOption[],
): Map<number, StateDeputyRelationOption> => {
  const cached = optionByIdByOptions.get(options)
  if (cached) return cached
  const byId = new Map(options.map((option) => [option.id, option]))
  optionByIdByOptions.set(options, byId)
  return byId
}

type MunicipalityStateDeputyRelationCellProps = {
  municipalityId: number
  municipalityName: string
  stateDeputyIDs: number[]
  options: StateDeputyRelationOption[]
  commitAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  createAction: MunicipalityStateDeputyCreateAction
  editorVariant: CampaignCellEditOverlayVariant
}

/**
 * The inline-create form action as the cell consumes it — the success state
 * carries the created deputy so the cell can swap its optimistic chip without
 * waiting for the RSC refresh. Exported once so the list and the mobile cards
 * share the same type instead of re-declaring it.
 */
export type MunicipalityStateDeputyCreateAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<
  CampaignFormActionState & { stateDeputy?: MunicipalityStateDeputyCreateResult['stateDeputy'] }
>

const CREATE_LABEL = (rawName: string) => `Criar dobradinha “${rawName}”`

const chipOf = (option: StateDeputyRelationOption): RelationChip => ({
  key: String(option.id),
  // `option.name` already folds the party (the loader's single spelling).
  label: option.name,
  href: `/campanha/dobradinhas/${option.slug}`,
  ids: [option.id],
})

/**
 * B157 — the "Dobradinhas" column of `/campanha/municipios`: a thin domain
 * shell over `RelationChipCell` in trigger mode. The closed cell is the
 * advisors-style avatar stack (hover reads "Nome (Partido)"); the editor opens
 * in a Popover (desktop) / Drawer (mobile) with removable chips, a combobox
 * that searches name AND party, and inline create ("Criar dobradinha 'texto'",
 * `Nome (PARTIDO)` syntax). Every write goes through the same actions the
 * `/campanha/dobradinhas` list already uses — nothing new on the server side
 * for toggles.
 */
export const MunicipalityStateDeputyRelationCell = ({
  municipalityId,
  municipalityName,
  stateDeputyIDs,
  options,
  commitAction,
  createAction,
  editorVariant,
}: MunicipalityStateDeputyRelationCellProps) => {
  // Same WeakMap sharing as the normalized labels above: the RSC builds ONE
  // options array for every row, so the id→option map is computed once per
  // request instead of per row (25 × catalog-size inserts otherwise).
  const optionById = optionByIdFor(options)

  const buildChips = useCallback(
    (ids: number[]): RelationChip[] => {
      const chips: RelationChip[] = []
      for (const id of ids) {
        const option = optionById.get(id)
        if (!option) continue
        chips.push(chipOf(option))
      }
      return chips
    },
    [optionById],
  )

  const searchHits = useCallback(
    (query: string, assignedIds: ReadonlySet<number>): RelationSearchHit[] => {
      const normalizedQuery = normalizeSearchPhrase(query)
      const normalizedLabels = normalizedOptionLabels(options)
      const hits: RelationSearchHit[] = []
      for (const option of options) {
        if (assignedIds.has(option.id)) continue
        if (!matchesNormalizedAtWordStart(normalizedLabels.get(option.id) ?? '', normalizedQuery)) {
          continue
        }
        hits.push({ key: String(option.id), label: option.name, ids: [option.id] })
      }
      return hits
    },
    [options],
  )

  const buildFormData = useCallback(
    (changedIds: number[], assigned: boolean) => {
      const formData = new FormData()
      formData.set('municipalityId', String(municipalityId))
      formData.set('stateDeputyId', String(changedIds[0]))
      formData.set('assigned', assigned ? 'true' : 'false')
      return formData
    },
    [municipalityId],
  )

  const buildCreateFormData = useCallback(
    (rawName: string) => {
      const formData = new FormData()
      formData.set('municipalityId', String(municipalityId))
      formData.set('rawName', rawName)
      return formData
    },
    [municipalityId],
  )

  /** Maps the action's `stateDeputy` payload to the cell's `createdChip`. */
  const createActionWithChip = useCallback(
    async (
      state: CampaignFormActionState,
      formData: FormData,
    ): Promise<CampaignFormActionState & { createdChip?: RelationChip }> => {
      const result = await createAction(state, formData)
      if (result.status !== 'success' || !result.stateDeputy) return result
      const created = result.stateDeputy
      return {
        ...result,
        createdChip: {
          key: String(created.id),
          label: stateDeputyDisplayName(created.name, created.party),
          href: `/campanha/dobradinhas/${created.slug}`,
          ids: [created.id],
        },
      }
    },
    [createAction],
  )

  const copy = useMemo<RelationChipCellCopy>(
    () => ({
      searchPlaceholder: 'Buscar dobradinha…',
      searchLabel: 'Buscar dobradinha',
      suggestionsLabel: 'Sugestões de dobradinhas',
      emptyDrawerMessage: 'Nenhuma dobradinha vinculada.',
      savingMessage: 'Salvando dobradinhas.',
      savedMessage: 'Dobradinhas salvas.',
      removedMessage: (count) =>
        count === 1 ? 'Dobradinha removida.' : `${count} dobradinhas removidas.`,
      createHintMessage: 'Nenhum resultado — opção de criar dobradinha disponível.',
    }),
    [],
  )

  return (
    <RelationChipCell
      ownerId={municipalityId}
      ownerName={municipalityName}
      ids={stateDeputyIDs}
      buildChips={buildChips}
      searchHits={searchHits}
      buildFormData={buildFormData}
      commitAction={commitAction}
      drawerTitle="Dobradinhas do município"
      // The advisor twin's contract: the names ride in the trigger's label so
      // a screen reader reads WHO is assigned without opening the editor (the
      // hover tooltip is pointer-only).
      triggerLabel={(chips) =>
        `Editar dobradinhas em ${municipalityName}${chips.length ? ` — ${chips.map((chip) => chip.label).join(', ')}` : ''}`
      }
      updateErrorMessage="Não foi possível atualizar as dobradinhas. Tente novamente."
      copy={copy}
      measureOverflow={false}
      trigger={(chips) => <StateDeputyAvatarStack chips={chips} />}
      triggerTooltip={formatStateDeputyNamesTooltip}
      editorVariant={editorVariant}
      createAction={createActionWithChip}
      buildCreateFormData={buildCreateFormData}
      createLabel={CREATE_LABEL}
      createErrorMessage="Não foi possível criar a dobradinha. Tente novamente."
    />
  )
}
