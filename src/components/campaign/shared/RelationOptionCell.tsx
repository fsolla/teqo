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
  href?: string
  party?: string
}

export type RelationCellOption = {
  id: number
  searchLabel: string
  item: RelationCellItem
}

type RelationOptionCellProps = {
  /** `null` in draft mode (a row that does not exist yet). */
  ownerId: number | null
  /** Whose relation this is — spoken in the aria-labels and the Drawer. */
  ownerName: string
  items: RelationCellItem[]
  options: RelationCellOption[]
  buildFormData: (changedIds: number[], assigned: boolean) => FormData
  commitAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  copy: RelationChipCellCopy
  drawerTitle: string
  triggerLabel: string
  updateErrorMessage: string
  /** Clamp rest chips to 3 rows + "Ver mais…". Default true; pass false when few chips are expected. */
  measureOverflow?: boolean
  /** Read-only rendering (B156): linked chips, no search/remove/Drawer affordances. */
  readOnly?: boolean
  /** C116 quiet cell — see `RelationChipCell.quiet`. */
  quiet?: boolean
  /** C116 — "+N" overflow label — see `RelationChipCell.overflowToggleLabel`. */
  overflowToggleLabel?: (hiddenCount: number) => string
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

/**
 * Generic "items + options + membership action" specialization of
 * `RelationChipCell` (extracted at B156, the second use of the
 * leadership↔dobradinha shape): every chip is a single linked item from `items`
 * (additions resolve through `options`, so an optimistic add labels from the
 * addable catalog), search matches `options` at normalized word start, and the
 * write is one `changedId` delta through `commitAction`. All that differs
 * between relations — chips' href, the write's field names, copy — arrives as
 * props; nothing domain-specific lives here.
 */
export const RelationOptionCell = ({
  ownerId,
  ownerName,
  items,
  options,
  buildFormData,
  commitAction,
  copy,
  drawerTitle,
  triggerLabel,
  updateErrorMessage,
  measureOverflow = true,
  readOnly = false,
  quiet = false,
  overflowToggleLabel,
}: RelationOptionCellProps) => {
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
      // keystroke — the cost `wordStartFilter`'s own doc comment warns about.
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

  return (
    <RelationChipCell
      ownerId={ownerId}
      ownerName={ownerName}
      ids={items.map((item) => item.id)}
      buildChips={buildChips}
      searchHits={searchHits}
      buildFormData={buildFormData}
      commitAction={commitAction}
      drawerTitle={drawerTitle}
      triggerLabel={triggerLabel}
      updateErrorMessage={updateErrorMessage}
      copy={copy}
      measureOverflow={measureOverflow}
      readOnly={readOnly}
      quiet={quiet}
      overflowToggleLabel={overflowToggleLabel}
    />
  )
}
