'use client'

import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { Button } from '@/components/ui/button'
import {
  buildLeadershipFilterHref,
  clearLeadershipListFilters,
  formatLeadershipActiveFiltersSummary,
} from '@/utilities/leadership/leadershipListFilters'
import { type LeadershipListState } from '@/utilities/leadership/leadershipListUrl'

export const LeadershipFilters = ({
  state,
  municipalityLabelsById,
}: {
  state: LeadershipListState
  /** Labels for the active municipality filter chips in the summary. */
  municipalityLabelsById?: Readonly<Record<number, string>>
}) => {
  const { search, onSearchChange, draftQ, isPending, navigateWithSearch, clearSearchAndNavigate } =
    useCampaignListFilterNavigation({ state, toHref: buildLeadershipFilterHref })
  const activeSummary = formatLeadershipActiveFiltersSummary(
    { ...state, q: draftQ },
    municipalityLabelsById,
  )

  return (
    <form
      role="search"
      className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault()
        navigateWithSearch(state)
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <CampaignSearchInput
          id="leadership-search"
          label="Buscar liderança por nome"
          placeholder="Buscar por nome…"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        {activeSummary ? (
          <p className="hidden min-w-0 flex-1 text-sm text-muted-foreground md:block md:self-center md:pb-2">
            {activeSummary}
          </p>
        ) : null}
        {activeSummary ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 md:self-end"
            onClick={() => clearSearchAndNavigate(clearLeadershipListFilters(state))}
          >
            Limpar
          </Button>
        ) : null}
      </div>

      {activeSummary ? (
        <p className="text-sm text-muted-foreground md:hidden">{activeSummary}</p>
      ) : null}
    </form>
  )
}
