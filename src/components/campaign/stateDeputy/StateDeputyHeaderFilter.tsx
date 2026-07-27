'use client'

import { useOptimistic } from 'react'

import {
  CampaignHeaderFilterPopover,
  type CampaignHeaderFilterRow,
} from '@/components/campaign/shared/CampaignHeaderFilterPopover'
import {
  buildStateDeputyFilterHref,
  buildStateDeputyPartyOptions,
  clearStateDeputyPartyFilter,
  isStateDeputyPartyFilterActive,
  toggleStateDeputyPartyFilter,
  type StateDeputyFilterOption,
} from '@/utilities/stateDeputyListFilters'
import { type StateDeputyListState } from '@/utilities/stateDeputyListUrl'

export const StateDeputyHeaderFilter = ({
  state,
  options,
  hasNoParty,
}: {
  state: StateDeputyListState
  /** Distinct party names present under the current search (server-computed facet). */
  options: StateDeputyFilterOption[]
  /** Whether at least one facet-matching row has no party — gates the "Sem partido" row. */
  hasNoParty: boolean
}) => {
  const [viewState, setOptimisticState] = useOptimistic(state)
  const active = isStateDeputyPartyFilterActive(viewState)

  const allOptions = buildStateDeputyPartyOptions(options, hasNoParty)

  const rows: CampaignHeaderFilterRow[] = allOptions.map((option) => {
    const next = toggleStateDeputyPartyFilter(viewState, option.value)
    return {
      value: option.value,
      label: option.label,
      href: buildStateDeputyFilterHref(next),
      selected: Boolean(viewState.parties?.includes(option.value)),
      checkbox: true,
      onChoose: () => setOptimisticState(next),
    }
  })

  const clearedState = clearStateDeputyPartyFilter(viewState)

  return (
    <CampaignHeaderFilterPopover
      id="state-deputy-filter-party"
      label="Partido"
      active={active}
      optionRows={rows}
      clear={
        active
          ? {
              href: buildStateDeputyFilterHref(clearedState),
              onChoose: () => setOptimisticState(clearedState),
            }
          : undefined
      }
    />
  )
}
