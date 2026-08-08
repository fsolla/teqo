'use client'

import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CampaignUpdatesCreateModal } from '@/components/campaign/municipality/CampaignUpdatesCreateModal'
import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { Button } from '@/components/ui/button'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import type { CampaignUpdatesFeedFacets } from '@/utilities/municipality/campaignUpdatesFeedData'
import {
  buildCampaignUpdatesFeedHref,
  type CampaignUpdatesFeedState,
} from '@/utilities/municipality/municipalityUpdateListUrl'
import {
  applyCampaignUpdatesFeedSuggestion,
  buildCampaignUpdatesFeedChips,
  buildCampaignUpdatesFeedSuggestionSeeds,
  clearCampaignUpdatesFeedFilters,
  filterCampaignUpdatesFeedSuggestions,
  removeCampaignUpdatesFeedChip,
  type CampaignUpdatesFeedOmniboxAction,
} from '@/utilities/municipality/municipalityUpdateOmnibox'

type CampaignUpdatesFiltersProps = {
  state: CampaignUpdatesFeedState
  facets: CampaignUpdatesFeedFacets
  isStaff: boolean
}

export const CampaignUpdatesFilters = ({
  state,
  facets,
  isStaff,
}: CampaignUpdatesFiltersProps) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: (next) => buildCampaignUpdatesFeedHref(next, 1),
  })
  const [query, setQuery] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  const municipalitySlugOptions = useMemo(
    () => facets.municipalities.map((municipality) => municipality.slug),
    [facets.municipalities],
  )

  const municipalityNameBySlug = useMemo(
    () =>
      new Map(
        facets.municipalities.map(({ slug }) => [
          slug,
          getMunicipalityCatalogEntry(slug)?.name ?? slug,
        ]),
      ),
    [facets.municipalities],
  )

  const authorNameById = useMemo(
    () => new Map(facets.authorOptions.map((option) => [Number(option.value), option.label])),
    [facets.authorOptions],
  )

  const chips = useMemo(
    () =>
      buildCampaignUpdatesFeedChips({
        state,
        municipalityNameBySlug,
        authorNameById,
      }),
    [state, municipalityNameBySlug, authorNameById],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildCampaignUpdatesFeedSuggestionSeeds({
        municipalitySlugOptions,
        authorOptions: facets.authorOptions,
      }),
    [municipalitySlugOptions, facets.authorOptions],
  )

  const suggestions = useMemo(
    () => filterCampaignUpdatesFeedSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: CampaignUpdatesFeedOmniboxAction) => {
    if (action.kind === 'clear') {
      setQuery('')
      navigate(action.state)
      return
    }
    navigate(action.state)
  }

  const prefillSlug = state.slugs?.length === 1 ? state.slugs[0] : undefined

  return (
    <>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
        }}
      >
        <CampaignListOmnibox
          id="campaign-updates-omnibox"
        label="Filtrar atualizações"
        placeholder="Digite para filtrar (município, polaridade, autor…)"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyCampaignUpdatesFeedSuggestion({ state, suggestionId }))
        }}
        onCommitQuery={(text) => {
          runAction(applyCampaignUpdatesFeedSuggestion({ state, suggestionId: `q:${text}` }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeCampaignUpdatesFeedChip({ state, chipId }))
        }}
        onClearAll={() => {
          runAction(clearCampaignUpdatesFeedFilters())
        }}
        trailing={
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0 gap-2"
            onClick={() => setCreateOpen(true)}
          >
            <Plus aria-hidden="true" />
            Nova atualização
          </Button>
        }
      />
      </form>
      <CampaignUpdatesCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        municipalities={facets.municipalities}
        isStaff={isStaff}
        prefillSlug={prefillSlug}
      />
    </>
  )
}
