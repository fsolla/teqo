'use client'

import { useCallback, useMemo } from 'react'

import {
  RelationChipCell,
  type RelationChip,
  type RelationChipCellCopy,
  type RelationSearchHit,
} from '@/components/campaign/shared/RelationChipCell'
import { matchesNormalizedAtWordStart, normalizeSearchPhrase } from '@/lib/wordStartFilter'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

export type RelationCellItem = {
  id: number
  label: string
  href: string
  party?: string
}

export type RelationCellOption = {
  id: number
  searchLabel: string
  item: RelationCellItem
}

type LeadershipStateDeputyRelationDirection = 'fromLeadership' | 'fromStateDeputy'

type LeadershipStateDeputyRelationCellProps = {
  direction: LeadershipStateDeputyRelationDirection
  fixedId: number
  /** Whose relation this is — spoken in the aria-labels and the Drawer. */
  ownerName: string
  items: RelationCellItem[]
  options: RelationCellOption[]
  membershipAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  /** Clamp rest chips to 3 rows + "Ver mais…". Default true; pass false when few chips are expected. */
  measureOverflow?: boolean
}

const itemLabel = (item: RelationCellItem): string =>
  item.party ? `${item.label} (${item.party})` : item.label

/**
 * Normalized search labels, once per `options` array rather than per row: the
 * RSC builds one array and every row of the table gets that same reference, so a
 * `WeakMap` shares the work where a per-row `useMemo` would repeat it (same
 * reasoning as `municipalityPortfolio`'s derivation cache).
 */
const normalizedLabelsByOptions = new WeakMap<readonly RelationCellOption[], Map<number, string>>()

const normalizedOptionLabels = (options: readonly RelationCellOption[]): Map<number, string> => {
  const cached = normalizedLabelsByOptions.get(options)
  if (cached) return cached

  const normalized = new Map(
    options.map((option) => [option.id, normalizeSearchPhrase(option.searchLabel)] as const),
  )
  normalizedLabelsByOptions.set(options, normalized)
  return normalized
}

const DIRECTION_COPY: Record<
  LeadershipStateDeputyRelationDirection,
  {
    drawerTitle: string
    triggerVerb: string
    emptyDrawerMessage: string
    searchPlaceholder: string
    searchLabel: string
    suggestionsLabel: string
    savingMessage: string
    savedMessage: string
    removedMessage: (count: number) => string
    updateErrorMessage: string
  }
> = {
  fromLeadership: {
    drawerTitle: 'Dobradinhas da liderança',
    triggerVerb: 'dobradinhas',
    emptyDrawerMessage: 'Nenhuma dobradinha vinculada.',
    searchPlaceholder: 'Buscar deputado estadual…',
    searchLabel: 'Buscar deputado estadual',
    suggestionsLabel: 'Sugestões de deputados estaduais',
    savingMessage: 'Salvando dobradinhas.',
    savedMessage: 'Dobradinhas salvas.',
    removedMessage: (count) =>
      count === 1 ? 'Dobradinha removida.' : `${count} dobradinhas removidas.`,
    updateErrorMessage: 'Não foi possível atualizar as dobradinhas. Tente novamente.',
  },
  fromStateDeputy: {
    drawerTitle: 'Lideranças da dobradinha',
    triggerVerb: 'lideranças',
    emptyDrawerMessage: 'Nenhuma liderança vinculada.',
    searchPlaceholder: 'Buscar liderança…',
    searchLabel: 'Buscar liderança',
    suggestionsLabel: 'Sugestões de lideranças',
    savingMessage: 'Salvando lideranças.',
    savedMessage: 'Lideranças salvas.',
    removedMessage: (count) =>
      count === 1 ? 'Liderança removida.' : `${count} lideranças removidas.`,
    updateErrorMessage: 'Não foi possível atualizar as lideranças. Tente novamente.',
  },
}

/**
 * Bidirectional `leadership.stateDeputies` edge, on the same `RelationChipCell`
 * that serves município portfolios (B37). Both directions write
 * `leadershipId`/`stateDeputyId`/`assigned` through the same membership action;
 * every chip here is a single item — no batch, no floor/ceiling.
 */
export const LeadershipStateDeputyRelationCell = ({
  direction,
  fixedId,
  ownerName,
  items,
  options,
  membershipAction,
  measureOverflow = true,
}: LeadershipStateDeputyRelationCellProps) => {
  const copy = DIRECTION_COPY[direction]

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  // Additions resolve through `options` (the addable catalog), same asymmetry
  // as the município cell's `optionById`: only what can still be added needs to
  // be looked up there, and a removal always has its item in `items` already.
  const optionItemById = useMemo(
    () => new Map(options.map((option) => [option.id, option.item])),
    [options],
  )

  const buildChips = useCallback(
    (ids: number[]): RelationChip[] => {
      const chips: RelationChip[] = []
      for (const id of ids) {
        const item = itemById.get(id) ?? optionItemById.get(id)
        if (!item) continue
        chips.push({ key: String(id), label: itemLabel(item), href: item.href, ids: [id] })
      }
      return chips
    },
    [itemById, optionItemById],
  )

  const searchHits = useCallback(
    (query: string, assignedIds: ReadonlySet<number>): RelationSearchHit[] => {
      // Normalize the query ONCE and read pre-normalized labels, instead of an
      // NFD pass plus three Unicode-property regexes per candidate per
      // keystroke — the cost `wordStartFilter`'s own doc comment warns about,
      // and which matters here because `options` in the `fromStateDeputy`
      // direction is the whole (unpaginated) leadership catalog.
      const normalizedQuery = normalizeSearchPhrase(query)
      const normalizedLabels = normalizedOptionLabels(options)
      const hits: RelationSearchHit[] = []
      for (const option of options) {
        if (assignedIds.has(option.id)) continue
        if (!matchesNormalizedAtWordStart(normalizedLabels.get(option.id) ?? '', normalizedQuery)) {
          continue
        }
        hits.push({ key: String(option.id), label: option.searchLabel, ids: [option.id] })
      }
      return hits
    },
    [options],
  )

  const buildFormData = useCallback(
    (changedIds: number[], assigned: boolean) => {
      const itemId = changedIds[0]
      const formData = new FormData()
      if (direction === 'fromLeadership') {
        formData.set('leadershipId', String(fixedId))
        formData.set('stateDeputyId', String(itemId))
      } else {
        formData.set('leadershipId', String(itemId))
        formData.set('stateDeputyId', String(fixedId))
      }
      formData.set('assigned', assigned ? 'true' : 'false')
      return formData
    },
    [direction, fixedId],
  )

  const chipCellCopy = useMemo<RelationChipCellCopy>(
    () => ({
      searchPlaceholder: copy.searchPlaceholder,
      searchLabel: copy.searchLabel,
      suggestionsLabel: copy.suggestionsLabel,
      emptyDrawerMessage: copy.emptyDrawerMessage,
      savingMessage: copy.savingMessage,
      savedMessage: copy.savedMessage,
      removedMessage: copy.removedMessage,
    }),
    [copy],
  )

  return (
    <RelationChipCell
      ownerId={fixedId}
      ownerName={ownerName}
      ids={items.map((item) => item.id)}
      buildChips={buildChips}
      searchHits={searchHits}
      buildFormData={buildFormData}
      commitAction={membershipAction}
      drawerTitle={copy.drawerTitle}
      triggerLabel={`Editar ${copy.triggerVerb} de ${ownerName}`}
      updateErrorMessage={copy.updateErrorMessage}
      copy={chipCellCopy}
      measureOverflow={measureOverflow}
    />
  )
}
