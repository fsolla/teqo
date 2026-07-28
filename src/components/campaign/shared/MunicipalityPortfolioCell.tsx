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
  scopedPortfolioIndex,
  searchMunicipalityPortfolio,
  type MunicipalityPortfolioChip,
  type MunicipalityPortfolioIndexEntry,
  type MunicipalityPortfolioSearchHit,
} from '@/lib/municipalityPortfolio'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const hitDescription = (hit: MunicipalityPortfolioSearchHit): string => {
  if (hit.kind === 'municipality') return 'Município'
  if (hit.kind === 'territory') return `Território · ${hit.count} municípios`
  return `Zona eleitoral · ${hit.count} municípios`
}

const toRelationChip = (chip: MunicipalityPortfolioChip): RelationChip =>
  chip.kind === 'territory'
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
    (ids: number[]) => buildMunicipalityPortfolioChips(ids, municipalityIndex).map(toRelationChip),
    [municipalityIndex],
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
      formData.set('assigned', assigned ? 'true' : 'false')
      for (const id of changedIds) formData.append('municipalityIds', String(id))
      return formData
    },
    [ownerId],
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
    />
  )
}
