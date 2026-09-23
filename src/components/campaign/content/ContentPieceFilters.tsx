'use client'

import { useOptimistic, useState, type ReactNode } from 'react'

import {
  CampaignHeaderFilterPopover,
  type CampaignHeaderFilterRow,
} from '@/components/campaign/shared/CampaignHeaderFilterPopover'
import {
  CampaignListOmnibox,
  campaignListOmniboxFormClassName,
} from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import {
  CONTENT_PIECE_PROCESSING_STATUSES,
  CONTENT_PIECE_STATUSES,
  CONTENT_PIECE_TYPES,
  contentPieceProcessingStatusLabels,
  contentPieceStatusLabels,
  contentPieceTypeLabels,
  isContentPieceProcessingStatus,
  isContentPieceStatus,
  isContentPieceType,
} from '@/lib/contentPiece'
import {
  buildContentPieceListHref,
  clearContentPieceListFilters,
  toggleContentPieceProcessing,
  toggleContentPieceStatus,
  toggleContentPieceType,
  type ContentPieceListState,
} from '@/utilities/content/contentPieceListUrl'

type FacetKey = 'types' | 'statuses' | 'processing'

const FACETS = [
  {
    key: 'types',
    id: 'content-piece-filter-type',
    label: 'Tipo',
    options: CONTENT_PIECE_TYPES.map((value) => ({ value, label: contentPieceTypeLabels[value] })),
    toggle: toggleContentPieceType,
  },
  {
    key: 'statuses',
    id: 'content-piece-filter-status',
    label: 'Publicação',
    options: CONTENT_PIECE_STATUSES.map((value) => ({
      value,
      label: contentPieceStatusLabels[value],
    })),
    toggle: toggleContentPieceStatus,
  },
  {
    key: 'processing',
    id: 'content-piece-filter-processing',
    label: 'Processamento',
    options: CONTENT_PIECE_PROCESSING_STATUSES.map((value) => ({
      value,
      label: contentPieceProcessingStatusLabels[value],
    })),
    toggle: toggleContentPieceProcessing,
  },
] as const

const chipLabelFor = (state: ContentPieceListState): { id: string; label: string }[] => {
  const chips: { id: string; label: string }[] = []
  if (state.q) chips.push({ id: 'q', label: `Busca: ${state.q}` })
  for (const value of state.types ?? []) {
    chips.push({ id: `types:${value}`, label: `Tipo: ${contentPieceTypeLabels[value]}` })
  }
  for (const value of state.statuses ?? []) {
    chips.push({
      id: `statuses:${value}`,
      label: `Publicação: ${contentPieceStatusLabels[value]}`,
    })
  }
  for (const value of state.processing ?? []) {
    chips.push({
      id: `processing:${value}`,
      label: `Processamento: ${contentPieceProcessingStatusLabels[value]}`,
    })
  }
  return chips
}

const removeChip = (state: ContentPieceListState, chipId: string): ContentPieceListState => {
  if (chipId === 'q') return { ...state, page: 1, q: undefined }

  const [facet, value] = chipId.split(':') as [FacetKey, string]
  if (facet === 'types' && isContentPieceType(value)) return toggleContentPieceType(state, value)
  if (facet === 'statuses' && isContentPieceStatus(value)) {
    return toggleContentPieceStatus(state, value)
  }
  if (facet === 'processing' && isContentPieceProcessingStatus(value)) {
    return toggleContentPieceProcessing(state, value)
  }
  return state
}

const selectedCount = (state: ContentPieceListState): number =>
  (state.types?.length ?? 0) + (state.statuses?.length ?? 0) + (state.processing?.length ?? 0)

/**
 * C211 — the search bar and the single "Filtros" trigger of the Central list
 * (approved design scene 1): the three facets are groups inside one popover,
 * each a multi-select over the shared row primitive.
 */
export const ContentPieceFilters = ({
  state,
  trailing,
}: {
  state: ContentPieceListState
  /** The column picker (B17/B137) mounted in the omnibox row. */
  trailing?: ReactNode
}) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildContentPieceListHref(next, 1),
  })
  const [viewState, setOptimisticState] = useOptimistic(state)
  // The field is a draft: the committed term lives in the URL and shows as a chip.
  const [draftQuery, setDraftQuery] = useState('')

  const runState = (next: ContentPieceListState) => {
    setOptimisticState(next)
    navigate(next)
  }

  const sections = FACETS.map((facet) => {
    const selected = (viewState[facet.key] ?? []) as readonly string[]
    return {
      label: facet.label,
      rows: facet.options.map((option) => {
        const next = (
          facet.toggle as (state: ContentPieceListState, value: string) => ContentPieceListState
        )(viewState, option.value)
        return {
          value: option.value,
          label: option.label,
          href: buildContentPieceListHref(next, 1),
          selected: selected.includes(option.value),
          checkbox: true,
          onChoose: () => setOptimisticState(next),
        } satisfies CampaignHeaderFilterRow
      }),
    }
  })

  const active = selectedCount(viewState)

  return (
    <form
      role="search"
      className={campaignListOmniboxFormClassName}
      onSubmit={(event) => {
        event.preventDefault()
        const term = draftQuery.trim()
        setDraftQuery('')
        runState({ ...viewState, page: 1, q: term || undefined })
      }}
    >
      <CampaignListOmnibox
        label="Buscar conteúdos"
        placeholder="Buscar por título, tema ou cidade…"
        chips={chipLabelFor(viewState)}
        suggestions={[]}
        query={draftQuery}
        onQueryChange={setDraftQuery}
        onSelectSuggestion={() => undefined}
        onRemoveChip={(chipId) => runState(removeChip({ ...viewState, page: 1 }, chipId))}
        onCommitQuery={(text) => {
          const term = text.trim()
          setDraftQuery('')
          runState({ ...viewState, page: 1, q: term || undefined })
        }}
        onClearAll={() => {
          setDraftQuery('')
          runState(clearContentPieceListFilters())
        }}
        isPending={isPending}
        // The omnibox owns the desktop trailing cluster (mobile filters live in
        // the list header, per the approved design): the "Filtros" trigger and
        // the column picker ride it together.
        trailing={
          <>
            <div role="group" aria-label="Filtrar conteúdos">
              <CampaignHeaderFilterPopover
                id="content-piece-filters"
                label="Filtros"
                triggerVariant="chip"
                triggerLabel={active > 0 ? `Filtros: ${active}` : 'Filtros'}
                active={active > 0}
                closeOnChoose={false}
                emptyLabel="Nenhuma peça neste recorte."
                optionRows={[]}
                sections={sections}
                clear={
                  active > 0
                    ? {
                        href: buildContentPieceListHref(clearContentPieceListFilters(), 1),
                        onChoose: () => setOptimisticState(clearContentPieceListFilters()),
                      }
                    : undefined
                }
              />
            </div>
            {trailing}
          </>
        }
      />
    </form>
  )
}
