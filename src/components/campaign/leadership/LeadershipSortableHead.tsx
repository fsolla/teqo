'use client'

import type { ReactNode } from 'react'

import { LeadershipHeaderFilter } from '@/components/campaign/leadership/LeadershipHeaderFilter'
import { CampaignSortableHead } from '@/components/campaign/shared/CampaignSortableHead'
import { CampaignTableHead } from '@/components/campaign/shared/CampaignTable'
import type {
  LeadershipFilterOption,
  LeadershipFilterParam,
} from '@/utilities/leadershipListFilters'
import {
  buildLeadershipSortHref,
  defaultLeadershipListSortDir,
  leadershipListSortLabels,
  resolveLeadershipListSort,
  type LeadershipListSortKey,
  type LeadershipListState,
} from '@/utilities/leadershipListUrl'

type LeadershipSortableHeadProps = {
  state: LeadershipListState
  sortKey: LeadershipListSortKey
  children?: ReactNode
  align?: 'left' | 'center' | 'right'
  className?: string
  filterParam?: LeadershipFilterParam
  filterOptions?: LeadershipFilterOption[]
}

export const LeadershipSortableHead = ({
  state,
  sortKey,
  children,
  align = 'left',
  className,
  filterParam,
  filterOptions,
}: LeadershipSortableHeadProps) => {
  const { sort: activeSort, dir } = resolveLeadershipListSort(state)
  const active = activeSort === sortKey
  const nextDir = active ? (dir === 'asc' ? 'desc' : 'asc') : defaultLeadershipListSortDir(sortKey)

  return (
    <CampaignSortableHead
      active={active}
      align={align}
      className={className}
      dir={dir}
      href={buildLeadershipSortHref(state, sortKey)}
      nextDir={nextDir}
      sortLabel={leadershipListSortLabels[sortKey]}
      filter={
        filterParam ? (
          <LeadershipHeaderFilter state={state} filterParam={filterParam} options={filterOptions} />
        ) : null
      }
    >
      {children ?? leadershipListSortLabels[sortKey]}
    </CampaignSortableHead>
  )
}

/** Filter-only column head (Municípios / Acesso) — no sort control. */
export const LeadershipFilterHead = ({
  state,
  filterParam,
  children,
  options,
  description,
}: {
  state: LeadershipListState
  filterParam: LeadershipFilterParam
  children: ReactNode
  options?: LeadershipFilterOption[]
  description?: ReactNode
}) => (
  <CampaignTableHead
    description={description}
    filter={<LeadershipHeaderFilter state={state} filterParam={filterParam} options={options} />}
  >
    {children}
  </CampaignTableHead>
)
