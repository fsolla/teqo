import type { ReactNode } from 'react'

import { CampaignSortableHead } from '@/components/campaign/shared/CampaignSortableHead'
import { StateDeputyHeaderFilter } from '@/components/campaign/stateDeputy/StateDeputyHeaderFilter'
import type { StateDeputyFilterOption } from '@/utilities/stateDeputyListFilters'
import {
  buildStateDeputySortHref,
  defaultStateDeputyListSortDir,
  resolveStateDeputyListSort,
  stateDeputyListSortLabels,
  type StateDeputyListSortKey,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

type StateDeputySortableHeadProps = {
  state: StateDeputyListState
  sortKey: StateDeputyListSortKey
  children?: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
} &
  // Only one filterable column exists (Partido) — presence of `filterOptions`
  // is the discriminant, unlike Territory's region|coverage `filterParam`.
  (| { filterOptions: StateDeputyFilterOption[]; hasNoPartyOption: boolean }
    | { filterOptions?: undefined; hasNoPartyOption?: undefined }
  )

export const StateDeputySortableHead = ({
  state,
  sortKey,
  children,
  align = 'left',
  className,
  filterOptions,
  hasNoPartyOption,
}: StateDeputySortableHeadProps) => {
  const { sort: activeSort, dir } = resolveStateDeputyListSort(state)
  const active = activeSort === sortKey
  const nextDir = active ? (dir === 'asc' ? 'desc' : 'asc') : defaultStateDeputyListSortDir()

  return (
    <CampaignSortableHead
      active={active}
      align={align}
      className={className}
      dir={dir}
      href={buildStateDeputySortHref(state, sortKey)}
      nextDir={nextDir}
      sortLabel={stateDeputyListSortLabels[sortKey]}
      filter={
        filterOptions ? (
          <StateDeputyHeaderFilter
            state={state}
            options={filterOptions}
            hasNoParty={hasNoPartyOption}
          />
        ) : null
      }
    >
      {children ?? stateDeputyListSortLabels[sortKey]}
    </CampaignSortableHead>
  )
}
