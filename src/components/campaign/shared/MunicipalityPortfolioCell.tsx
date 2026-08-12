'use client'

import { MapPinIcon } from 'lucide-react'
import { useCallback, useMemo } from 'react'

import {
  RelationChipCell,
  type RelationChip,
  type RelationChipCellCopy,
  type RelationSearchHit,
} from '@/components/campaign/shared/RelationChipCell'
import {
  buildMunicipalityPortfolioChips,
  expandMunicipalityPortfolioChips,
  scopedPortfolioIndex,
  searchMunicipalityPortfolio,
  type MunicipalityPortfolioChip,
  type MunicipalityPortfolioIndexEntry,
  type MunicipalityPortfolioSearchHit,
} from '@/lib/municipalityPortfolio'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const hitDescription = (hit: MunicipalityPortfolioSearchHit): string => {
  if (hit.kind === 'municipality') return 'Município'
  if (hit.kind === 'city') return 'Todas as zonas'
  if (hit.kind === 'territory') return `Território · ${hit.count} municípios`
  return `Zona eleitoral · ${hit.count} municípios`
}

const toRelationChip = (chip: MunicipalityPortfolioChip): RelationChip =>
  chip.kind === 'territory' || chip.kind === 'city'
    ? {
        key: chip.key,
        label: chip.label,
        icon: <MapPinIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />,
        trailingLabel: String(chip.municipalityIds.length),
        ids: chip.municipalityIds,
        removalSuffix: ` — ${chip.municipalityIds.length} municípios`,
      }
    : {
        key: chip.key,
        label: chip.label,
        href: `/campanha/municipios/${chip.slug}`,
        ids: [chip.municipalityId],
      }

const toRelationHit = (hit: MunicipalityPortfolioSearchHit): RelationSearchHit => ({
  key: hit.key,
  label: hit.label,
  description: hitDescription(hit),
  ids: hit.kind === 'municipality' ? [hit.municipalityId] : hit.municipalityIds,
})

type MunicipalityPortfolioCellProps = {
  /** `null` in draft mode (a row that does not exist yet). */
  ownerId: number | null
  /** Whose portfolio this is — spoken in the aria-labels and the Drawer. */
  ownerName: string
  municipalityIds: number[]
  municipalityIndex: readonly MunicipalityPortfolioIndexEntry[]
  /**
   * Ids the actor may ADD. Omit for "the whole catalog". Chips always render from
   * the full index: an advisor must see (and be able to drop) a link outside
   * their portfolio, they just cannot create one.
   */
  addableIds?: ReadonlySet<number>
  /** Floor the relation enforces server-side — 1 for `leadership.municipalities`. */
  minItems?: number
  /** Ceiling the relation enforces server-side. */
  maxItems?: number
  /** Draft mode (new row): keep changes local and report them upward. */
  draft?: boolean
  onDraftChange?: (municipalityIds: number[]) => void
  /** Sends `ownerId`, repeated `municipalityIds` and `assigned`. */
  commitAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  drawerTitle: string
  updateErrorMessage: string
  /** C116 quiet cell — see `RelationChipCell.quiet`. */
  quiet?: boolean
  /** C116 expanded batch keys (territory / zone-city) — see `expandMunicipalityPortfolioChips`. */
  expandedKeys?: ReadonlySet<string>
  /** C116 — click on a collapsed batch chip (key like `territory:Irecê`), for the wrapper to expand it. */
  onChipClick?: (chipKey: string) => void
  /** C116 — "+N" overflow label — see `RelationChipCell.overflowToggleLabel`. */
  overflowToggleLabel?: (hiddenCount: number) => string
  /** C116 — read-only chips (actor may see the relation but not edit it). */
  readOnly?: boolean
  /**
   * C128 — extra static fields appended to every commit FormData (e.g.
   * `contactId` for the person-centric people-list actions).
   */
  extraFormFields?: Record<string, string | number>
  /**
   * C128 — commit even with a `null` owner: the people-list cells keep the
   * null owner while the entity does not exist yet, and the server-side person
   * action creates it. See `RelationChipCell.commitWithNullOwner`.
   */
  commitWithNullOwner?: boolean
  /**
   * C128 — destructive-exit guard before the optimistic apply. See
   * `RelationChipCell.commitGuard`.
   */
  commitGuard?: (delta: {
    changedIds: number[]
    assigned: boolean
    currentIds: number[]
  }) => Promise<boolean | 'destructive'>
}

/**
 * Município specialization of `RelationChipCell`: territory/ZE chips collapse a
 * complete membership into one batch chip, and every município chip links to
 * its detail page. All of the interaction machine (optimistic delta, undo,
 * combobox, floor/ceiling, pointer-fine/coarse split) lives in the shared cell.
 */
export const MunicipalityPortfolioCell = ({
  ownerId,
  ownerName,
  municipalityIds,
  municipalityIndex,
  addableIds,
  minItems = 0,
  maxItems,
  draft = false,
  onDraftChange,
  commitAction,
  drawerTitle,
  updateErrorMessage,
  quiet = false,
  expandedKeys,
  onChipClick,
  overflowToggleLabel,
  readOnly = false,
  extraFormFields,
  commitWithNullOwner = false,
  commitGuard,
}: MunicipalityPortfolioCellProps) => {
  /**
   * `addableIds` also hides: an advisor's `canUpdateMunicipality` is scoped to
   * `municipality.advisors`, so a município this relation holds outside that
   * scope cannot be removed either — the write would silently no-op at the
   * document level with no way for the cell to explain why. Rather than let
   * that failure surface, the chip for it never renders for the advisor at
   * all; staff (`addableIds` undefined) still see and can remove every link.
   */
  const visibleIds = useMemo(
    () => (addableIds ? municipalityIds.filter((id) => addableIds.has(id)) : municipalityIds),
    [municipalityIds, addableIds],
  )

  /**
   * Suggestions are scoped, chips are not: filtering the index the search reads
   * also shrinks the território / ZE hits to what the actor may actually add,
   * instead of offering a batch the server would reject halfway. Memoized by
   * `(index, addableIds)` rather than per row so all rows share one array — see
   * `scopedPortfolioIndex`.
   */
  const searchIndex = useMemo(
    () => scopedPortfolioIndex(municipalityIndex, addableIds),
    [addableIds, municipalityIndex],
  )

  const buildChips = useCallback(
    (ids: number[]) => {
      const base = buildMunicipalityPortfolioChips(ids, municipalityIndex)
      return (
        expandedKeys
          ? expandMunicipalityPortfolioChips(base, expandedKeys, municipalityIndex)
          : base
      ).map(toRelationChip)
    },
    [municipalityIndex, expandedKeys],
  )

  const searchHits = useCallback(
    (query: string, assignedIds: ReadonlySet<number>) =>
      searchMunicipalityPortfolio(query, searchIndex, assignedIds).map(toRelationHit),
    [searchIndex],
  )

  const buildFormData = useCallback(
    (changedIds: number[], assigned: boolean) => {
      const formData = new FormData()
      formData.set('ownerId', String(ownerId))
      for (const [name, value] of Object.entries(extraFormFields ?? {})) {
        formData.set(name, String(value))
      }
      formData.set('assigned', assigned ? 'true' : 'false')
      for (const id of changedIds) formData.append('municipalityIds', String(id))
      return formData
    },
    [ownerId, extraFormFields],
  )

  const copy = useMemo<RelationChipCellCopy>(
    () => ({
      searchPlaceholder: 'Buscar município, território ou ZE…',
      searchLabel: 'Buscar município, território de identidade ou zona eleitoral',
      suggestionsLabel: 'Sugestões de municípios',
      emptyDrawerMessage: 'Nenhum município vinculado.',
      savingMessage: 'Salvando municípios…',
      savedMessage: 'Municípios salvos.',
      removedMessage: (count) => `${count} municípios removidos.`,
      floorMessage: (min) =>
        `${ownerName} precisa de pelo menos ${min === 1 ? 'um município' : `${min} municípios`}`,
      capMessage: (max) => `${ownerName} aceita no máximo ${max} municípios.`,
    }),
    [ownerName],
  )

  return (
    <RelationChipCell
      ownerId={ownerId}
      ownerName={ownerName}
      ids={visibleIds}
      buildChips={buildChips}
      searchHits={searchHits}
      minItems={minItems}
      maxItems={maxItems}
      draft={draft}
      onDraftChange={onDraftChange}
      buildFormData={buildFormData}
      commitAction={commitAction}
      drawerTitle={drawerTitle}
      triggerLabel={`Editar municípios de ${ownerName}`}
      updateErrorMessage={updateErrorMessage}
      copy={copy}
      quiet={quiet}
      overflowToggleLabel={overflowToggleLabel}
      onChipClick={onChipClick ? (chip) => onChipClick(chip.key) : undefined}
      readOnly={readOnly}
      commitWithNullOwner={commitWithNullOwner}
      commitGuard={commitGuard}
    />
  )
}
