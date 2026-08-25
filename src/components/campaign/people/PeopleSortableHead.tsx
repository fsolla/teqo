import type { ReactNode } from 'react'

import { CampaignSortableHead } from '@/components/campaign/shared/CampaignSortableHead'
import {
  buildPeopleSortHref,
  defaultPeopleListSortDir,
  peopleListSortLabels,
  resolvePeopleListSort,
  type PeopleListSortKey,
  type PeopleListState,
} from '@/utilities/people/peopleListUrl'

type PeopleSortableHeadProps = {
  state: PeopleListState
  sortKey: PeopleListSortKey
  children?: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
}

/** Sortable header for the people table (C117). People filters live in the
 * omnibox only — no header filter popovers, so this is the bare shell form
 * (StateDeputy precedent, minus the filter slot). */
export const PeopleSortableHead = ({
  state,
  sortKey,
  children,
  align = 'left',
  className,
}: PeopleSortableHeadProps) => {
  const { sort: activeSort, dir } = resolvePeopleListSort(state)
  const active = activeSort === sortKey
  const nextDir = active ? (dir === 'asc' ? 'desc' : 'asc') : defaultPeopleListSortDir(sortKey)

  return (
    <CampaignSortableHead
      active={active}
      align={align}
      className={className}
      dir={dir}
      href={buildPeopleSortHref(state, sortKey)}
      nextDir={nextDir}
      sortLabel={peopleListSortLabels[sortKey]}
    >
      {children ?? peopleListSortLabels[sortKey]}
    </CampaignSortableHead>
  )
}
